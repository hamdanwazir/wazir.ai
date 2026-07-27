"use strict";
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const root = process.cwd();
const dataFile = path.join(root, "data", "store.json");
const port = Number(process.env.PORT || 3000);
const production = process.env.NODE_ENV === "production";
const adminPassword = process.env.ADMIN_PASSWORD;
const sessionSecret = process.env.SESSION_SECRET;
if (!adminPassword || !sessionSecret || sessionSecret.length < 32) {
  console.error("Set ADMIN_PASSWORD and a SESSION_SECRET of at least 32 characters before starting.");
  process.exit(1);
}

const sessions = new Map();
const attempts = new Map();
const oneHour = 60 * 60 * 1000;
const fifteenMinutes = 15 * 60 * 1000;
const mime = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"application/javascript; charset=utf-8", ".json":"application/json; charset=utf-8", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".png":"image/png", ".svg":"image/svg+xml", ".ico":"image/x-icon" };

function securityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
}
function send(res, status, body, type="application/json; charset=utf-8") { securityHeaders(res); res.writeHead(status, { "Content-Type":type, "Cache-Control":"no-store" }); res.end(typeof body === "string" ? body : JSON.stringify(body)); }
function parseCookies(req) { return Object.fromEntries((req.headers.cookie || "").split(";").map(v => v.trim().split("=")).filter(v => v.length === 2).map(([k,v]) => [k, decodeURIComponent(v)])); }
function signature(value) { return crypto.createHmac("sha256", sessionSecret).update(value).digest("base64url"); }
function newToken(bytes=32) { return crypto.randomBytes(bytes).toString("base64url"); }
function setSessionCookie(res, id) { const value = `${id}.${signature(id)}`; res.setHeader("Set-Cookie", `session=${encodeURIComponent(value)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600${production ? "; Secure" : ""}`); }
function clearSessionCookie(res) { res.setHeader("Set-Cookie", `session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production ? "; Secure" : ""}`); }
function sessionFor(req) { const value = parseCookies(req).session || ""; const [id, sig] = value.split("."); const expected = id ? signature(id) : ""; if (!id || !sig || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null; const session = sessions.get(id); if (!session || session.expires < Date.now()) { sessions.delete(id); return null; } return { id, ...session }; }
function authorized(req, res) { const session = sessionFor(req); if (!session) { send(res, 401, {error:"Please sign in."}); return null; } if (["POST","PUT","DELETE"].includes(req.method) && req.headers["x-csrf-token"] !== session.csrf) { send(res, 403, {error:"Invalid request token."}); return null; } return session; }
async function body(req) { let raw=""; for await (const part of req) { raw += part; if (raw.length > 20000) throw Error("Request too large"); } try { return JSON.parse(raw || "{}"); } catch { throw Error("Invalid JSON"); } }
async function readData() { return JSON.parse(await fs.readFile(dataFile, "utf8")); }
async function writeData(data) { const temp = `${dataFile}.tmp`; await fs.writeFile(temp, JSON.stringify(data, null, 2), "utf8"); await fs.rename(temp, dataFile); }
function cleanText(value, max) { return typeof value === "string" ? value.trim().replace(/[<>]/g, "").slice(0,max) : ""; }
function validProduct(value) { const name=cleanText(value.name,60), price=cleanText(value.price,40), image=cleanText(value.image,500); if (!name || !price || !/^https:\/\//.test(image)) return null; return {id:cleanText(value.id,70).replace(/[^a-z0-9-]/gi,"-").toLowerCase() || crypto.randomUUID(), name, price, image}; }
function clientIp(req) { return (req.socket.remoteAddress || "unknown").slice(0,80); }
function loginAllowed(ip) { const state=attempts.get(ip); if (!state || state.until < Date.now()) return true; return state.count < 5; }
function failedLogin(ip) { const state=attempts.get(ip) || {count:0,until:Date.now()+fifteenMinutes}; state.count++; attempts.set(ip,state); }
function safePath(urlPath) { const requested = urlPath === "/" ? "/index.html" : decodeURIComponent(urlPath); const resolved = path.resolve(root, `.${requested}`); return resolved.startsWith(root + path.sep) ? resolved : null; }

const server = http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname === "/api/products" && req.method === "GET") return send(res,200,(await readData()).products);
    if (url.pathname === "/api/store" && req.method === "GET") return send(res,200,(await readData()).store);
    if (url.pathname === "/api/admin/login" && req.method === "POST") {
      const ip=clientIp(req); if (!loginAllowed(ip)) return send(res,429,{error:"Too many attempts. Please wait 15 minutes."});
      const input=cleanText((await body(req)).password,300); const equal=input.length === adminPassword.length && crypto.timingSafeEqual(Buffer.from(input),Buffer.from(adminPassword));
      if (!equal) { failedLogin(ip); return send(res,401,{error:"Incorrect password."}); }
      attempts.delete(ip); const id=newToken(), csrf=newToken(); sessions.set(id,{csrf,expires:Date.now()+oneHour}); setSessionCookie(res,id); return send(res,200,{csrf});
    }
    if (url.pathname === "/api/admin/logout" && req.method === "POST") { const session=authorized(req,res); if(!session)return; sessions.delete(session.id); clearSessionCookie(res); return send(res,200,{ok:true}); }
    if (url.pathname === "/api/admin/session" && req.method === "GET") { const session=authorized(req,res); if(!session)return; return send(res,200,{csrf:session.csrf,data:await readData()}); }
    if (url.pathname === "/api/admin/store" && req.method === "PUT") { if(!authorized(req,res))return; const input=await body(req), current=await readData(); const store={name:cleanText(input.name,100),phone:cleanText(input.phone,25),email:cleanText(input.email,100),address:cleanText(input.address,180),delivery:cleanText(input.delivery,250)}; if(Object.values(store).some(v=>!v))return send(res,400,{error:"All store fields are required."}); current.store=store; await writeData(current); return send(res,200,{store}); }
    if (url.pathname === "/api/admin/products" && req.method === "POST") { if(!authorized(req,res))return; const product=validProduct(await body(req)); if(!product)return send(res,400,{error:"Enter a name, price and valid HTTPS image URL."}); const current=await readData(); if(current.products.some(p=>p.id===product.id))product.id=`${product.id}-${Date.now()}`; current.products.push(product); await writeData(current); return send(res,201,{product}); }
    const match=url.pathname.match(/^\/api\/admin\/products\/([a-z0-9-]+)$/i);
    if (match && req.method === "PUT") { if(!authorized(req,res))return; const product=validProduct({...await body(req),id:match[1]}); if(!product)return send(res,400,{error:"Enter a name, price and valid HTTPS image URL."}); const current=await readData(), index=current.products.findIndex(p=>p.id===match[1]); if(index<0)return send(res,404,{error:"Product not found."}); current.products[index]=product; await writeData(current); return send(res,200,{product}); }
    if (match && req.method === "DELETE") { if(!authorized(req,res))return; const current=await readData(), before=current.products.length; current.products=current.products.filter(p=>p.id!==match[1]); if(before===current.products.length)return send(res,404,{error:"Product not found."}); await writeData(current); return send(res,200,{ok:true}); }
    if (req.method !== "GET" && req.method !== "HEAD") return send(res,405,{error:"Method not allowed."});
    const file=safePath(url.pathname); if(!file) return send(res,403,{error:"Forbidden"}); const ext=path.extname(file).toLowerCase(); const content=await fs.readFile(file); securityHeaders(res); res.writeHead(200,{"Content-Type":mime[ext]||"application/octet-stream", "Cache-Control":ext===".html"?"no-cache":"public, max-age=3600"}); res.end(req.method === "HEAD" ? undefined : content);
  } catch (error) {
    if (error.code === "ENOENT") {
      try {
        const notFound = await fs.readFile(path.join(root, "404.html"));
        securityHeaders(res); res.writeHead(404, { "Content-Type":"text/html; charset=utf-8", "Cache-Control":"no-store" }); res.end(notFound); return;
      } catch { return send(res,404,{error:"Not found"}); }
    }
    console.error(error); return send(res,500,{error:"Server error"});
  }
});
setInterval(() => { const now=Date.now(); for(const [id,s] of sessions)if(s.expires<now)sessions.delete(id); for(const [ip,a] of attempts)if(a.until<now)attempts.delete(ip); }, fifteenMinutes).unref();
module.exports = server;