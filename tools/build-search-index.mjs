#!/usr/bin/env node
// Builds search-index.json from the exported HTML pages.
//
// Webflow's site search runs on Webflow's hosting and does not survive an
// export, so the index is generated here at build time and queried in the
// browser by js/site-search.js. The Dockerfile runs this, which is what keeps
// the index from drifting out of sync with the pages after a re-export.

import { readFile, writeFile, readdir } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const OUT = join(ROOT, 'search-index.json')

// Directories that are never part of the public site. forms-api is a backend
// service that happens to live in this repo, not indexable page content.
const SKIP_DIRS = new Set([
  '.git', '.github', 'docs', 'node_modules', 'tools',
  'css', 'js', 'fonts', 'images', 'forms-api',
])

// Pages with no place in results: error pages, the search page itself, and
// leftover duplicates from the export.
const SKIP_PAGES = new Set(['401.html', '404.html', 'search.html', 'pricing/pricing-1-copy.html'])

// NOTE: the index still covers the pages gated by basic_auth in the Caddyfile
// (company/, pricing/, products/, support*, solutions/{pubs,entertainment}),
// and stores their extracted body text. That is intended — search runs on
// /search, which is behind the same gate, so results may reference them.
// It also means search-index.json is as sensitive as those pages: it is served
// from a path the gate covers, and must stay that way. Before exposing /search
// publicly, add the gated pages to SKIP_PAGES above, or the index will hand
// their contents to anyone who requests the JSON.

// Boilerplate the template shipped on pages that were never given real
// metadata. Indexing it makes every such page match "module", "webflow" and
// "landing", which is worse than having no description at all.
const BOILERPLATE = [
  /^Module consists of a series of landing and support pages/i,
  /Webflow HTML website template/i,
]

const TITLE_SUFFIX = /\s*[·|–-]\s*Module\s*[–-]\s*Webflow HTML website template\s*$/i

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
])

// Content-free tags, and the site chrome that repeats on every page. Without
// the chrome exclusions every page contains the full nav and footer text, so
// every page matches nearly every query.
const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'svg', 'head', 'nav', 'header', 'footer', 'template'])
const SKIP_ROLES = new Set(['banner', 'contentinfo', 'navigation'])
const SKIP_CLASS_PREFIXES = ['navbar', 'nav-menu', 'mega-menu', 'footer', 'preloader', 'w-nav-overlay']

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', middot: '·', copy: '©', reg: '®', trade: '™',
}

function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return Object.prototype.hasOwnProperty.call(ENTITIES, body) ? ENTITIES[body] : match
  })
}

const squash = (s) => decodeEntities(s).replace(/\s+/g, ' ').trim()

// Minimal tag-aware scanner. Attribute values are quote-aware so a ">" inside
// an attribute doesn't end the tag early.
function* tokenize(html) {
  let i = 0
  while (i < html.length) {
    const lt = html.indexOf('<', i)
    if (lt === -1) {
      yield { type: 'text', value: html.slice(i) }
      return
    }
    if (lt > i) yield { type: 'text', value: html.slice(i, lt) }

    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt)
      i = end === -1 ? html.length : end + 3
      continue
    }
    if (html.startsWith('<!', lt)) {
      const end = html.indexOf('>', lt)
      i = end === -1 ? html.length : end + 1
      continue
    }

    let j = lt + 1
    let quote = null
    while (j < html.length) {
      const c = html[j]
      if (quote) {
        if (c === quote) quote = null
      } else if (c === '"' || c === "'") {
        quote = c
      } else if (c === '>') {
        break
      }
      j++
    }
    yield { type: 'tag', raw: html.slice(lt + 1, j) }
    i = j + 1
  }
}

function parseTag(raw) {
  const closing = raw[0] === '/'
  const body = closing ? raw.slice(1) : raw
  const name = (body.match(/^([a-zA-Z][a-zA-Z0-9-]*)/) || [, ''])[1].toLowerCase()
  return {
    name,
    closing,
    selfClosing: raw.trimEnd().endsWith('/'),
    attrs: closing ? '' : body.slice(name.length),
  }
}

const attr = (attrs, name) => {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'))
  return m ? (m[2] ?? m[3] ?? '') : ''
}

function isChrome(name, attrs) {
  if (SKIP_TAGS.has(name)) return true
  if (SKIP_ROLES.has(attr(attrs, 'role').toLowerCase())) return true
  if (attr(attrs, 'aria-hidden').toLowerCase() === 'true') return true
  const classes = attr(attrs, 'class').toLowerCase().split(/\s+/)
  return classes.some((c) => c && SKIP_CLASS_PREFIXES.some((p) => c.startsWith(p)))
}

// Walks the body, dropping chrome subtrees, and returns the page's prose plus
// its headings (kept separate so they can be weighted higher when scoring).
function extractContent(body) {
  const text = []
  const headings = []
  const openStack = []

  let skipUntilDepth = -1
  let depth = 0
  let heading = null

  for (const token of tokenize(body)) {
    if (token.type === 'text') {
      if (skipUntilDepth !== -1) continue
      const value = squash(token.value)
      if (!value) continue
      text.push(value)
      if (heading) heading.push(value)
      continue
    }

    const { name, closing, selfClosing, attrs } = parseTag(token.raw)
    if (!name) continue

    if (closing) {
      // Unwind to the matching open tag; the export is well-formed, but a
      // stray close tag must not corrupt the depth counter.
      const at = openStack.lastIndexOf(name)
      if (at === -1) continue
      depth = at
      openStack.length = at
      if (skipUntilDepth !== -1 && depth <= skipUntilDepth) skipUntilDepth = -1
      if (heading && name === heading.tag) {
        const value = squash(heading.join(' '))
        if (value) headings.push(value)
        heading = null
      }
      continue
    }

    const isVoid = VOID_TAGS.has(name) || selfClosing

    if (skipUntilDepth === -1 && isChrome(name, attrs)) {
      // A void element can't open a subtree, so there is nothing to skip into.
      if (!isVoid) skipUntilDepth = depth
      else continue
    }

    if (isVoid) {
      if (skipUntilDepth === -1) {
        // Alt text is real page content and is often the only text on visual
        // sections. Field placeholders matter just as much: a contact or
        // support page can be entirely inputs, with no prose to index at all.
        const labels = name === 'img'
          ? [attr(attrs, 'alt')]
          : name === 'input'
            ? [attr(attrs, 'placeholder'), attr(attrs, 'aria-label'),
               attr(attrs, 'type').toLowerCase() === 'submit' ? attr(attrs, 'value') : '']
            : []
        for (const label of labels) {
          const value = squash(label)
          if (value) text.push(value)
        }
      }
      continue
    }

    if (skipUntilDepth === -1 && /^h[1-3]$/.test(name) && !heading) {
      heading = []
      heading.tag = name
    }

    openStack.push(name)
    depth = openStack.length
  }

  return {
    text: squash(text.join(' ')),
    headings: [...new Set(headings)],
  }
}

const isBoilerplate = (s) => !s || BOILERPLATE.some((re) => re.test(s))

// index.html -> "/", products/digital-menus.html -> "/products/digital-menus".
// Caddy's try_files serves the .html for the extensionless path.
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

const files = (await collectPages(ROOT))
  .filter((f) => !SKIP_PAGES.has(relative(ROOT, f).split(sep).join('/')))
  .sort()

const pages = []
const warnings = []

for (const file of files) {
  const relPath = relative(ROOT, file).split(sep).join('/')
  const html = await readFile(file, 'utf8')

  const head = (html.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [, ''])[1]
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  if (!bodyMatch) {
    warnings.push(`${relPath}: no <body>, skipped`)
    continue
  }

  // Several exported pages are shells whose <body> holds nothing but the
  // jQuery and webflow.js tags — the CMS collections behind them didn't come
  // across in the export. They render as a blank white page, so a result
  // pointing at one is worse than no result.
  const markup = bodyMatch[1]
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
  if (!/<[a-zA-Z]/.test(markup)) {
    warnings.push(`${relPath}: empty shell (no content elements), skipped`)
    continue
  }

  const { text, headings } = extractContent(bodyMatch[1])

  const rawTitle = squash((head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1])
  const metaDesc = squash(
    (head.match(/<meta[^>]+name=["']description["'][^>]*>/i) || [''])[0]
      .match(/content=["']([^"']*)["']/i)?.[1] || ''
  )

  // Fall back to the first heading when the export left the template's title
  // in place, so results don't all read "Module – Webflow HTML website template".
  const cleanTitle = rawTitle.replace(TITLE_SUFFIX, '').trim()
  const title = (!cleanTitle || isBoilerplate(rawTitle) ? '' : cleanTitle) || headings[0] || cleanTitle || relPath

  const description = isBoilerplate(metaDesc) ? '' : metaDesc

  if (!text) warnings.push(`${relPath}: no indexable body text`)

  pages.push({
    url: toUrl(relPath),
    title,
    description,
    headings,
    // Cap the stored prose. The tail of a long marketing page adds bulk to
    // every visitor's download for very little ranking value.
    text: text.slice(0, 6000),
  })
}

await writeFile(OUT, JSON.stringify({ pages }) + '\n', 'utf8')

const bytes = Buffer.byteLength(JSON.stringify({ pages }))
console.log(`search-index.json: ${pages.length} pages, ${(bytes / 1024).toFixed(1)} KB`)
for (const w of warnings) console.warn(`  warning: ${w}`)
