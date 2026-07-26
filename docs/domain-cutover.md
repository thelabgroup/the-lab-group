# Domain cutover checklist

Things that must change when the site moves from its temporary Railway address
to a real domain. Nothing here is urgent *today* — the site works as-is — but
each item breaks or degrades quietly if it is missed at cutover.

Current address: `https://web-production-c6b60.up.railway.app`

---

## 1. Social share images (the one that needs explaining)

**Files:** [index.html](../index.html), [helpsupport.html](../helpsupport.html)

### Why these tags are different from every other link on the site

Everywhere else, the site links to its own files using *relative* paths:

```html
<img src="images/menulab.png">          <!-- "the images folder next to this page" -->
<link href="css/webflow.css">
```

Relative paths are self-adjusting. The browser already knows which site it is
on, so the same HTML works on `localhost`, on the Railway URL, and on the final
domain with no edits. This is why the rest of the export needed no changes.

**Social preview tags cannot work that way.** When someone pastes a link into
LinkedIn, WhatsApp or Slack, that company's server fetches the page from the
outside to build the preview card. It is not "on" the site, so it has no way to
resolve `images/og-image.png` — relative to *what*? Facebook and LinkedIn both
require the full address, starting with `https://`.

So these two tags are the only place in the codebase where the site's own
address is written down literally:

```html
<meta content="https://web-production-c6b60.up.railway.app/images/og-image.png" property="og:image">
<meta content="https://web-production-c6b60.up.railway.app/images/og-image.png" name="twitter:image">
```

### What actually happens if this is forgotten

Not an outage — which is exactly why it is easy to miss. After cutover, the page
is served from the new domain but still tells LinkedIn to fetch its preview
image from the old Railway address. That address keeps working, so **previews
keep rendering and nothing looks broken.** The damage is deferred:

- Previews break the day the Railway-generated domain is removed or changes
- The Railway hostname is exposed in the page source of every share
- Some scrapers and link-safety scanners downrank or skip cross-domain preview
  images, so some previews go blank while others do not — a confusing bug to
  chase months later

### The fix

- [ ] Replace both occurrences of `https://web-production-c6b60.up.railway.app`
      with the new domain, in the two files above. Four tags in total
      (`og:image` and `twitter:image` in each).
- [ ] Re-scrape so the cached preview updates — the old card is cached by each
      network until then:
  - LinkedIn: <https://www.linkedin.com/post-inspector/>
  - Facebook/WhatsApp: <https://developers.facebook.com/tools/debug/>
  - X: <https://cards-dev.twitter.com/validator>
- [ ] Consider generating these tags in the build step from a single
      `SITE_URL` value, so the address is written once rather than per page.
      Worth doing if more pages get share images — see the note in section 5.

### What does *not* need changing

The contact form posts to `/api/contact` — a relative path, deliberately. It
resolves against whatever domain the page is on, so it follows the site to the
new domain with no edit. Do not "fix" it into an absolute URL; that would add a
cross-origin request and a CORS preflight where currently there is neither.

---

## 2. Point the domain at Railway

- [ ] Railway → `web` service → Settings → Networking → **Custom Domain**
- [ ] Add the domain, then create the CNAME record Railway gives you
- [ ] Railway issues the TLS certificate automatically once DNS resolves
- [ ] Keep the `.up.railway.app` domain alive until section 1 is done and the
      previews have been re-scraped

⚠️ **`thelabgroup.com` currently serves a different site** — a page titled
*"The Lab Group · Investing in exceptional hospitality"*, behind Cloudflare, not
the Webflow build. Confirm which site is meant to live on the apex domain before
repointing anything. This is not a straight DNS swap.

---

## 3. DNS work worth doing at the same time

- [ ] **Fix the SPF record.** `thelabgroup.com` currently publishes
      `v=spf1 include:dc-aa8e722993._spfm.thelabgroup.com ~all`, and that
      include target does not exist (NXDOMAIN from both `8.8.8.8` and
      `1.1.1.1`). An unresolvable include is a permanent error, so the record
      authorises nothing — anyone can send mail as the domain, and legitimate
      mail is more likely to be junked. Needs a full list of sending systems
      before replacing.

---

## 4. The old Webflow site

- [ ] Decide what happens to `thelabgroup.webflow.io` and the Webflow
      subscription
- [ ] Before cancelling, confirm nothing still loads assets from
      `uploads-ssl.webflow.com`. As of the social-image fix this is zero, but
      re-check after any future re-export, because Webflow writes those
      absolute URLs back in every time.

---

## 5. Known gaps, not cutover-blocking

- **31 of 33 pages have no `og:image` at all.** Only [index.html](../index.html)
  and [helpsupport.html](../helpsupport.html) have one. Everything under
  [solutions/](../solutions/), [products/](../products/) and
  [pricing/](../pricing/) shares with no image.
- **No `sitemap.xml` or `robots.txt`** — Webflow generated both; exports do not
  include them. When these are added, the sitemap must contain absolute URLs,
  so it belongs in the build step alongside the `SITE_URL` idea in section 1.
