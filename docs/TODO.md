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

---

*Out of scope for this list but found in the same audit — tracked separately: three bugs in the
pricing calculator (`payAtEnd` has no recalculation listener, a literal `'RESULT'` placeholder
string renders to users, and an unguarded `prices[n]` lookup throws for `n < 5`), the four contact
forms being tethered to Webflow's hosted form API, and the unpinned `@latest` third-party gradient
script loaded from a personal GitHub repo with no SRI.*
