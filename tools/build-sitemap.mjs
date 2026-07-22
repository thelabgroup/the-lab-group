#!/usr/bin/env node
// Builds sitemap.xml from the exported HTML pages.
//
// Webflow generated a sitemap on its own hosting and it did not survive the
// export. Without one, the canonical extensionless URLs the Caddyfile now
// redirects to have nothing advertising them to crawlers.
//
// Origin comes from SITE_URL. It defaults to the Railway service domain
// because that is the only origin currently serving this site — thelabgroup.com
// resolves to a different, unrelated page. Set SITE_URL when that changes;
// a sitemap listing the wrong origin is worse than no sitemap.

import { readFile, writeFile, readdir, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const OUT = join(ROOT, 'sitemap.xml')

const SITE_URL = (process.env.SITE_URL || 'https://web-production-c6b60.up.railway.app').replace(/\/+$/, '')

// Mirrors build-search-index.mjs — see the comment there.
const SKIP_DIRS = new Set([
  '.git', '.github', 'docs', 'node_modules', 'tools',
  'css', 'js', 'fonts', 'images', 'forms-api',
])

// Error pages, the search page itself, and a leftover export duplicate. None
// belong in results, so none belong in a sitemap.
const SKIP_PAGES = new Set(['401.html', '404.html', 'search.html', 'pricing/pricing-1-copy.html'])

// The basic_auth gate list is read out of the Caddyfile rather than restated
// here. A sitemap advertising a page that answers 401 is a crawl error on every
// fetch, and the two lists silently drifting apart is exactly how that happens.
async function gatedMatchers() {
  const caddyfile = await readFile(join(ROOT, 'Caddyfile'), 'utf8')
  const line = caddyfile.match(/^\s*@gated\s+path\s+(.+)$/m)
  if (!line) throw new Error('no "@gated path" line in Caddyfile — refusing to emit a sitemap that may list gated pages')
  return line[1].trim().split(/\s+/).map((pattern) => {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp('^' + escaped.replace(/\*/g, '.*') + '$', 'i')
  })
}

// index.html -> "/", products/digital-menus.html -> "/products/digital-menus".
function toUrl(relPath) {
  const posix = relPath.split(sep).join('/')
  if (posix === 'index.html') return '/'
  return '/' + posix.replace(/(\/index)?\.html$/, '')
}

async function collectPages(dir, found = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) await collectPages(full, found)
    else if (entry.name.endsWith('.html')) found.push(full)
  }
  return found
}

const gated = await gatedMatchers()
const files = (await collectPages(ROOT))
  .filter((f) => !SKIP_PAGES.has(relative(ROOT, f).split(sep).join('/')))
  .sort()

const entries = []
const excluded = []

for (const file of files) {
  const relPath = relative(ROOT, file).split(sep).join('/')
  const url = toUrl(relPath)

  // Check the .html form too: the gate runs before canonicalisation, so it is
  // written in terms of paths as requested, not the canonical URL.
  if (gated.some((re) => re.test(url) || re.test('/' + relPath))) {
    excluded.push(`${url} (gated)`)
    continue
  }

  const { mtime } = await stat(file)
  entries.push({ url, lastmod: mtime.toISOString().slice(0, 10) })
}

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...entries.map(({ url, lastmod }) =>
    `  <url>\n    <loc>${SITE_URL}${url}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`
  ),
  '</urlset>',
  '',
].join('\n')

await writeFile(OUT, xml)

// Stamp the same origin into robots.txt. Keeping SITE_URL in one place is the
// point: a Sitemap: line pointing at a different host than the <loc> entries is
// ignored outright by crawlers.
// Tolerate its absence: a missing robots.txt is a reason to skip the stamp, not
// to fail the image build over a sitemap that has already been written.
const ROBOTS = join(ROOT, 'robots.txt')
const robots = await readFile(ROBOTS, 'utf8').catch(() => null)
if (robots === null) {
  console.warn('robots.txt not found — skipped Sitemap: directive')
} else {
  const directive = `Sitemap: ${SITE_URL}/sitemap.xml`
  const updated = /^Sitemap:.*$/m.test(robots)
    ? robots.replace(/^Sitemap:.*$/m, directive)
    : robots.replace(/\s*$/, '\n') + `\n${directive}\n`
  if (updated !== robots) await writeFile(ROBOTS, updated)
}

console.log(`sitemap.xml: ${entries.length} public URLs at ${SITE_URL}`)
for (const url of entries) console.log(`  ${url.url}`)
if (excluded.length) console.log(`excluded ${excluded.length}:\n  ${excluded.join('\n  ')}`)
