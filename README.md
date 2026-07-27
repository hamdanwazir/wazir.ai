# Rahmat Ullah & Abdullah Atta Dealers

A responsive grocery storefront with WhatsApp ordering, a Waziristan Journal, SEO metadata, and an optional Node.js admin dashboard.

## Hosting choices

| Host | Public shop | Admin editing | Best use |
| --- | --- | --- | --- |
| Vercel | Yes | No persistent editing with the included JSON store | Recommended free public launch |
| Netlify | Yes | No persistent editing with the included JSON store | Simple static alternative |
| GitHub Pages | Yes | No server-side admin/API | Free public static site |
| Node host with persistent disk | Yes | Yes | Use when the included admin dashboard is required |

The public product cards have a static fallback, so the storefront remains usable on static hosts. The included admin panel writes to `data/store.json`; serverless/static platforms do not provide safe persistent local storage, so do **not** use it there for live edits.

## Deploy free on Vercel (recommended)

1. Create a GitHub account and a new repository.
2. Upload this project to the repository. Do not upload `.env`.
3. Sign in to [Vercel](https://vercel.com), choose **Add New → Project**, and import the repository.
4. Keep the project root as the repository root and leave the build command/output directory blank.
5. Click **Deploy**. Vercel gives you a public `https://…vercel.app` address.
6. Test the home page, Services, Waziristan Journal, WhatsApp links, `/robots.txt`, `/sitemap.xml`, and a non-existent URL for the 404 page.
7. Replace every occurrence of `https://rahmat-ullah-atta-dealers.vercel.app` in `index.html`, `services.html`, `waziristan.html`, `robots.txt`, and `sitemap.xml` with your final Vercel/custom-domain URL. Commit and deploy again.

## Deploy free on Netlify

1. Push the project to GitHub.
2. In Netlify, choose **Add new site → Import an existing project** and select the repository.
3. Set the publish directory to `.`. No build command is needed.
4. Deploy, test the same URLs above, then replace the placeholder site URL in the five SEO files listed in the Vercel steps.

## Deploy free on GitHub Pages

1. Push the project to a GitHub repository with the default branch named `main`.
2. Go to **Settings → Pages**, set **Source** to **GitHub Actions**.
3. The included workflow `.github/workflows/deploy-pages.yml` publishes the project after the next push to `main`.
4. Open the URL shown in the workflow run or in **Settings → Pages**.
5. Update the canonical URLs and sitemap after you know the final address. For a project site, use the full address including the repository name.

## Optional Node admin backend

Use this only on a Node-capable host with persistent storage. It is not suitable for GitHub Pages, and its JSON storage is not durable on serverless hosts.

1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Set a long, unique `ADMIN_PASSWORD` and a random `SESSION_SECRET` of at least 32 characters.
4. Run `npm start`.
5. Use `/admin.html` to update products and store details.
6. Set `NODE_ENV=production` behind HTTPS before publishing. The app reads the platform `PORT` environment variable automatically.

## Custom domain

1. Buy or use a domain from any registrar.
2. In your host dashboard, add the domain under **Domains**.
3. Add the exact DNS record shown by the host. Usually `www` uses a CNAME, while the root/apex domain uses A/ALIAS/ANAME records provided by the host.
4. Wait for DNS and SSL certificate issuance, then set your preferred domain as the primary domain and force HTTPS.
5. Update canonical URLs, Open Graph `og:url`, JSON-LD `url`, `robots.txt`, and `sitemap.xml` to use the final `https://` domain.

GitHub Pages supports HTTPS for correctly configured custom domains; enable **Enforce HTTPS** after its certificate is ready. See [GitHub’s HTTPS guide](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).

## Google Search Console

1. Open [Google Search Console](https://search.google.com/search-console) and add a **Domain** property (recommended) or a URL-prefix property.
2. Verify ownership. For a domain property, add the DNS TXT record Google provides at your domain registrar.
3. After verification, open **Sitemaps**, enter `sitemap.xml`, and submit it.
4. Use **URL Inspection** for the homepage and choose **Request indexing** after the site is publicly live.
5. Check the Pages/Indexing reports periodically.

Google recommends absolute canonical URLs in sitemaps and supports submitting them through Search Console; review its [sitemap documentation](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) and [Search Console guide](https://developers.google.com/search/docs/monitor-debug/search-console-start).

## Security and maintenance

- Never commit `.env`, passwords, or third-party API keys.
- Keep Node.js updated and use HTTPS in production.
- The server adds security headers, signed HttpOnly same-site sessions, CSRF checks, input validation, and login rate limiting.
- Back up `data/store.json` before changing products on a Node host.
- Replace external Unsplash images with optimized, rights-cleared local WebP images when available for the best performance and reliability.
