# TODO

## Dead Weight & Cleanup

Findings from a codebase audit of the Webflow static export (site ID `630694b36b7b3e62bb1cb0a6`,
published 22 Jul 2026). These are all removals or corrections — none change intended behaviour.

### Unused libraries

- [ ] **Remove slick-carousel — loaded but never initialized.** No `.slick()` call exists anywhere
      in the codebase, and there is no `slick-slider` / `slick-track` markup. Present on **17 pages**:
      `index.html`, `helpsupport.html`, all 4 `products/*.html`, and all 11 `solutions/*.html`.
      Each page pays ~47 KB of CDN payload (`slick.min.js` ~42 KB, `slick.css` ~2 KB,
      `slick-theme.css` ~3 KB) plus 3 extra render-blocking requests for nothing.
      Delete from each page:
  - `<link>` to `//cdn.jsdelivr.net/npm/slick-carousel@1.8.1/slick/slick.css` — e.g. [index.html:33](../index.html#L33)
  - `<link>` to `//cdn.jsdelivr.net/npm/slick-carousel@1.8.1/slick/slick-theme.css` — e.g. [index.html:34](../index.html#L34)
  - `<script>` to `cdn.jsdelivr.net/npm/slick-carousel@1.8.1/slick/slick.min.js` — e.g. [index.html:760](../index.html#L760)

### Orphaned pages (15 — unreachable from any link in the site)

Decide per page: link it into the nav, or delete it. Right now they ship, get crawled, and
appear in search results while being invisible to users.

- [ ] `products/` — all four are orphaned because the nav points to external product domains
      (`qrlab.com`, `nfclab.com`, `menulab.com`, `bookinglab.com`, `payd.in`) instead:
      [digital-menus.html](../products/digital-menus.html), [order-collect.html](../products/order-collect.html),
      [order-management.html](../products/order-management.html), [table-service.html](../products/table-service.html)
- [ ] `company/` — all four, and the nav labels them "Coming soon" with `href="#"`:
      [blog.html](../company/blog.html), [blog1.html](../company/blog1.html),
      [blog-section.html](../company/blog-section.html), [newsroom.html](../company/newsroom.html)
- [ ] `pricing/` — three of four are orphaned: [pricing.html](../pricing/pricing.html),
      [pricing-2.html](../pricing/pricing-2.html), [pricing-1-copy.html](../pricing/pricing-1-copy.html).
      `pricing-1-copy.html` in particular is an unversioned duplicate that should not be in the repo at all.
- [ ] [search.html](../search.html) and [support.html](../support.html) — note `helpsupport.html`
      is the one that *is* linked; `support.html` is a stale near-duplicate.
- [ ] [solutions/pubs.html](../solutions/pubs.html) and [solutions/entertainment.html](../solutions/entertainment.html)
      — the other 9 solutions pages are linked from the homepage; these two were missed.
      Their nav images (`images/pubs_1pubs.png`, `images/entertainment_1entertainment.png`) exist,
      so this looks like an oversight rather than a decision.
- [ ] [401.html](../401.html) / [404.html](../404.html) — orphaned by design (server-served), but they
      only work on Webflow hosting. Confirm the host is configured to serve them, else delete.

### Unreachable functionality

- [ ] **The pricing calculator is dead code in practice.** [pricing/pricing-1.html](../pricing/pricing-1.html)
      holds the only bespoke business logic in the repo (~195 lines, the 45-tier quote wizard), but
      it is linked *only* from other orphaned pages (`pricing.html`, `pricing-2.html`,
      `pricing-1-copy.html`, `search.html`, `support/contact-2.html`). Neither `index.html` nor
      `helpsupport.html` — the only two pages in the live nav graph — contains the string "pricing".
      Either add Pricing to the nav or accept that the calculator is unshipped.

### Leftover template / wrong-brand copy

- [ ] **Webflow template placeholder still live on 11 pages.** The footer paragraph reads
      *"Module consists of a series of landing and support pages which companies can use to promote
      new products and business launches."* — in `401.html`, `404.html`, `company/blog.html`,
      `company/blog1.html`, `company/newsroom.html`, all 4 `pricing/*.html`, `search.html`,
      `support/contact-2.html`.
- [ ] **Wrong copyright holder on 6 pages.** Footer says `© Copyright Menulab` instead of
      The Lab Group — all 4 `pricing/*.html`, `search.html`, `support/contact-2.html`.
- [ ] **Currency inconsistency.** The calculator quotes **GBP** (£29.99–£244.99), while
      [pricing/pricing.html](../pricing/pricing.html) and [pricing/pricing-2.html](../pricing/pricing-2.html)
      advertise **USD** ($16 / $36 / $149 / $249). Pick one before any pricing page goes live.
- [ ] **Dead footer links.** Multiple `href="#"` placeholders in the pricing-page footers for
      "Terms of use", "Terms of service", "Privacy policy", "Product", "Use Cases" — real pages
      exist under `footer/` and should be wired up (or the links removed).

### Duplicated inline code

- [ ] **`morphDropdown` mega-menu is copy-pasted into all 33 HTML files** (~150 lines of jQuery each,
      e.g. [index.html:164-330](../index.html#L164-L330)). Any nav change requires 33 edits and they
      will drift. Extract to `js/mega-menu.js` and include it once per page.

### Routing — open items

The redirect investigation is otherwise closed: the trailing-slash, `.html` and directory 404s
are fixed in the Caddyfile, and the Webflow 301 table turned out to be empty (below). What remains
are domain-level items that can't be settled from inside this repo — they need a decision about the
`www.thelabgroup.com` domain and access to wherever it is now hosted.

- [x] **The Webflow 301 redirect table is empty — nothing to migrate.** Established without needing
      the Webflow account, from two independent directions:
      1. The original site is still published at `thelabgroup.webflow.io` (identical `<title>`,
         404s on bogus paths, so its routing is live and readable). 82 distinct URLs were probed
         against it — every path the Wayback Machine ever captured on `thelabgroup.com`, plus 44
         plausible slugs (`/pricing`, `/contact`, `/blog`, `/cafes`, `/privacy-policy`, the
         un-prefixed product and solution names…). **Zero returned a redirect.**
      2. Every 3xx the archive holds for `thelabgroup.com` is infrastructure, not content:
         `http://` → `https://www.`, a Dan.com domain-parking redirect from Dec 2021 (the domain
         was for sale then — the Webflow site's tenure was short), and a 2002–03 ASP site
         unrelated to this business. **No path-level redirect was ever captured.**

      Two useful by-products of that probe. Webflow's own canonicalisation was
      `/solutions/cafes/` → 301 → `/solutions/cafes`, which the Caddyfile's trailing-slash rule now
      reproduces exactly; and `.html` URLs 404'd on Webflow, so the `.html` → extensionless 301 is
      strictly additive rather than a behaviour change. The 14 URLs the archive holds for the
      Webflow era are also an exact match for the 14 in `sitemap.xml`, which independently confirms
      the basic_auth gate isn't hiding anything that was ever publicly crawled.

      Residual caveat: this assumes Webflow surfaces a user-configured redirect table on the
      `.webflow.io` staging domain. If that assumption is wrong, direction 1 proves nothing — but
      direction 2 is independent of it and reaches the same conclusion.

- [ ] **`www.thelabgroup.com` no longer serves this site, and every old URL is now a soft 404.**
      That domain *was* this site's home — the archive has it serving the matching
      `<title>` ("Tech-enabled services for the hospitality sector") as late as 1 Jan 2026. It now
      serves a different, unrelated page ("Investing in exceptional hospitality businesses",
      9,338 bytes) from Cloudflare Pages, with a SPA-style catch-all: **all 14** previously-crawled
      URLs return `200` with that page instead of their content, verified 22 Jul 2026. Apex behaves
      identically.

      A soft 404 is worse than a 404. A visitor following an old link gets no signal the content
      moved, and search engines keep the URLs indexed against the wrong content rather than
      dropping or re-pointing them.

      **Deferred — not being actioned now (noted 26 Jul 2026).** Needs a decision first: is the
      Cloudflare Pages site a deliberate replacement, or did it displace this site without the
      redirects being planned? That answer picks the fix:
      - *If this Railway service is meant to be the live site:* point `www.thelabgroup.com` at it
        (and settle apex-vs-www canonicalisation, next item).
      - *If the Cloudflare page is intended to stay:* give it a real 404 for unknown paths, and add
        301s from the 14 old URLs to wherever that content now lives.

      Either way it is a domain/hosting change made outside this repo, not a Caddyfile edit — the
      Caddyfile only takes effect once traffic reaches this service. The 14 affected URLs are the
      `<loc>` entries in `sitemap.xml`.

- [ ] **Host canonicalisation, once a real domain is attached.** The archive shows the apex
      301'd to `https://www.`, so apex and `www` must not both serve. Railway terminates TLS and
      the Caddyfile runs `auto_https off`, so this is settled at the domain layer, and `SITE_URL`
      rebuilt to match (see `tools/build-sitemap.mjs`). Until then `sitemap.xml` points at the
      Railway service domain.
- [ ] **Content directory roots 404 — needs a destination decision, not a config change.**
      `/pricing`, `/solutions`, `/products`, `/company`, `/support` and `/footer` have no index
      page, so they 404. That is the correct default and was left deliberately: none of them has an
      unambiguous target, and redirecting a directory to an unrelated page (the homepage, say) is
      treated as a soft 404 by search engines, which is worse than the 404 itself. `/pricing` is
      the tempting exception — but per the pricing notes above, `pricing-1.html` is an unshipped
      calculator with three open bugs and a GBP/USD conflict, so pointing a public URL at it would
      surface exactly the page that is not ready. Either build real index pages for these folders
      (`/solutions` is the one with a genuine case — 11 live pages sit under it) or leave the 404s.
      Asset directories (`/css`, `/js`, `/images`, `/fonts`) are a separate matter and now return an
      explicit 404 rather than an incidental one.

---

*Out of scope for this list but found in the same audit — tracked separately: three bugs in the
pricing calculator (`payAtEnd` has no recalculation listener, a literal `'RESULT'` placeholder
string renders to users, and an unguarded `prices[n]` lookup throws for `n < 5`), the four contact
forms being tethered to Webflow's hosted form API, and the unpinned `@latest` third-party gradient
script loaded from a personal GitHub repo with no SRI.*

## Site search

Webflow's site search runs server-side on Webflow hosting and did not survive the static export.
Replaced with a client-side index (`tools/build-search-index.mjs` generates `search-index.json`;
[js/site-search.js](../js/site-search.js) queries it) in commit `2ad3f80`. Verified end-to-end in a
real browser: [search.html](../search.html) renders ranked results, accent folding and no-match
paths work, and every result link resolves. These are the remaining open items (noted 27 Jul 2026).

- [ ] **Not yet live.** The fix sits on `fix/site-search`; it reaches visitors only once that merges
      to `main` and Railway rebuilds. The rebuild is load-bearing: the [Dockerfile](../Dockerfile)
      regenerates `search-index.json` from the pages in the build, so the committed copy can be
      stale and still self-heal on deploy — but nothing happens until the merge and redeploy.
- [ ] **Search is credentialed-only right now — decision needed before it can go public.** `/search`
      sits behind the `basic_auth` gate restored in `d43bd20`, and the `/search*` matcher also covers
      `/search-index.json` (deliberately — the index stores extracted body text for every gated page,
      so exposing the JSON would leak their contents). A public visitor hitting `/search` therefore
      gets a login prompt. **If public search is wanted:** first rebuild the index to exclude the
      gated pages (add `company/`, `pricing/`, `products/`, `support*`, `solutions/{pubs,entertainment}`
      to `SKIP_PAGES` in `tools/build-search-index.mjs`), *then* lift `/search` out of the gate — never
      the other way round, or the JSON serves gated page text to anyone who requests it.
- [ ] **No entry point in the UI.** Nothing in the site nav or footer links to `/search` on any of the
      ~30 pages — it is reachable only by typing the URL. Moot while search is gated; revisit if it goes
      public. Adding a link touches every page's nav and needs a desktop-vs-mobile placement call, so it
      was left out rather than half-done — see the `morphDropdown` duplication note above: the nav is
      copy-pasted into all 33 files, so this is 33 edits until that is extracted.
