# sujithanand.com

> **Status: the live site is intentionally blank while it is being rebuilt.**
> `index.html` is an empty placeholder. Every real page is still in the repository
> but is excluded from the published site by `_config.yml`, so nothing is lost.
> Restore instructions are in the comment at the top of `_config.yml`.

Portfolio of Sujith Anand, design leader working on AI-driven UX in governance,
risk, and compliance. Static site, no build step, served by GitHub Pages from
the repository root (`CNAME` → `sujithanand.com`).

## Structure

```
index.html                 New landing page (v2 UI, the rebuild starts here)
case-design-system.html    v2 case study (the template the others follow)
home.html                  The real homepage, currently unpublished
case-study-*.html          Long-form case studies (5)
article-*.html             Articles (8)
404.html                   Not-found page

css/
  design-system.css        v2 design system: tokens, reset, primitives (new UI)
  chrome.css               v2 shared chrome: nav, work cards, quote, contact, footer
  landing.css              v2 landing page (new UI)
  case.css                 v2 case study layout
  evidence.css             v2 evidence components: flows, matrices, decision logs
  chat.css                 Ask AI chat
  tokens.css               v1 design tokens, used by the unpublished pages
  base.css                 Reset, document defaults, shared primitives
  home.css                 Homepage layout
  article.css              Article layout
  case-study.css           Case study layout + shared components
  search-demo.css          Page-specific: the AI-search interactive demo

js/
  landing.js               v2 landing page interactions
  case.js                  v2 case study interactions (reveal, sticky nav, tables)
  chat.js                  Ask AI chat
  home.js                  Homepage interactions (scroll progress, counters, article expander)
  search-demo.js           The AI-search interactive demo

img/                       Images. og-cover.png is the social sharing card.
tools/og-cover.html        Source for og-cover.png (see below)
tools/export-content.py    Regenerates SITE-CONTENT.md from the HTML
SITE-CONTENT.md            All site copy in Markdown (content source of truth)
```

## Conventions

- **No em dashes in copy.** Use commas, colons, or full stops. Middle dots (`·`)
  separate metadata like dates and bylines.
- **Tokens first.** Colours, spacing, radii, and shadows live in
  `css/design-system.css`. Don't hardcode a value that already has a token.
  (`css/tokens.css` is the v1 equivalent, still used by the unpublished pages.)
- **Layout stylesheets may override `--container` and nothing else.**
- **v2 stylesheet order:** `design-system.css` → `chrome.css` → layout
  (`landing.css` or `case.css`) → `evidence.css` → `chat.css`.
  v1 pages still load `tokens.css` → `base.css` → their layout stylesheet.
- **Shared chrome lives in `css/chrome.css`**: nav, work cards, pull quote,
  contact block, footer. Anything appearing on more than one page belongs there,
  not in a page stylesheet.
- **No inline `<style>` or `<script>`** except for genuinely page-specific rules
  (currently only `404.html`).
- **Every page needs** a `<title>`, `<meta name="description">`, a canonical URL,
  the Open Graph / Twitter block, and a JSON-LD block. New pages must also be
  added to `sitemap.xml`.
- **Diagrams are HTML and CSS, not hand-positioned SVG text.** See the `.flow`
  and `.model` components in `css/evidence.css`. Hand-authored SVG labels do not
  wrap, do not survive a copy edit, and render at roughly 4px on a phone.
- **Every number needs a method.** Use `.metric-source` or `.measure-note`.
  A figure with no stated baseline and window does not ship.

## Local preview

```sh
python3 -m http.server 8000
# → http://localhost:8000
```

The Ask AI chat needs the proxy, so use this instead when working on it:

```sh
cp .env.example .env      # then fill in BOTDOJO_API_KEY
python3 tools/dev-proxy.py
# → http://localhost:8000, with POST /api/ask proxied to BotDojo
```

## Ask AI chat

| Piece | File |
| --- | --- |
| UI and conversation state | `js/chat.js`, `css/chat.css` |
| Markup | the `#chat-root` block in `index.html` |
| Local proxy | `tools/dev-proxy.py` |
| Production proxy | `functions/api/ask.js` |
| Credentials | `.env` (gitignored), template in `.env.example` |

The browser never holds the API key. It posts `{message, sessionId}` to
`/api/ask`, and the proxy adds the `Authorization` header server side.
Anything else would publish the key, since this is a static site.

### Sessions

Conversation memory lives on BotDojo's side. Every response carries a
`flow_session_id`; sending it back inside `options` on the next call continues
that same conversation. It must be nested, not top level:

```json
{ "options": { "stream": "none", "flow_session_id": "..." },
  "body": { "user_message": "..." } }
```

The client keeps that id in `localStorage`, so the thread survives a reload or
a closed tab. **New chat** is the only thing that discards it, which starts a
fresh session on the next message. If the server no longer recognises a stored
id it answers `409 {code: "session_invalid"}`, and the client silently drops the
id and retries once.

Documented at [docs.botdojo.com/docs/api/flowRequest](https://docs.botdojo.com/docs/api/flowRequest).

### Secrets and deployment

**A GitHub Actions secret cannot protect this key.** Actions secrets exist only
while a build runs. Substituting one into a file at build time writes it into
the published JavaScript, and GitHub Pages then serves it to every visitor.
That is identical to hardcoding it. There is no arrangement of GitHub Secrets
and GitHub Pages that keeps a key private, because Pages has no server.

The key has to live somewhere that holds it at runtime:

| Where the site lives | Where the key lives | `CHAT_ENDPOINT` |
| --- | --- | --- |
| Local dev proxy | `.env`, read by `tools/dev-proxy.py` | `/api/ask` |
| A host that runs functions | That host's environment variables | `/api/ask` |
| GitHub Pages + a proxy elsewhere | The proxy host's environment variables | the proxy's absolute URL |
| GitHub Pages, no proxy | Nowhere. Ask AI hides itself. | `null` |

A GitHub Actions secret is still the right store for *deploying* the proxy, for
example passing it to `wrangler secret put`. The rule is that it may reach the
server's environment and never a file in this repository.

Worth checking first: if BotDojo issues a browser-scoped key restricted to an
allowed domain, that key is designed to be public and can go straight into
`js/chat-config.js`. A standard server key cannot.

`js/chat-config.js` sets the endpoint and ships to the browser. It holds no
secret and must never hold one. When `CHAT_ENDPOINT` is `null`, `js/chat.js`
removes the Ask AI button and the dialog, so the site never shows a control
that can only fail.

### Guard

```sh
python3 tools/check-secrets.py
```

Scans every publishable file for credential-shaped strings and exits non-zero
on a hit. `.github/workflows/check-secrets.yml` runs it on every push. The
account, project and flow ids from `.env.example` are allowed through: they
identify the flow and are useless without the key.

Note that no deployment workflow is committed on purpose. Adding one replaces
the default Jekyll build, and `_config.yml` depends on that build to keep the
v1 pages out of the published site.

Deep links: `#ask` opens the panel, `?ask=your+question` opens it and sends
that question.

## Regenerating the social card

`img/og-cover.png` (1200×630) is rendered from `tools/og-cover.html`:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --hide-scrollbars --virtual-time-budget=8000 \
  --screenshot=img/og-cover.png --window-size=1200,630 \
  "file://$PWD/tools/og-cover.html"
```

Run it from the repository root. The card references `img/` relatively.

## Exporting the content

`SITE-CONTENT.md` holds every word on the site in Markdown: page metadata, all copy,
component data as tables, the SVG flow-diagram labels, and the search-demo records.
It is the content source of truth for rebuilding the site with a different UI.

Regenerate it after editing any page:

```sh
python3 tools/export-content.py
```

It reads the HTML directly, so it never drifts from what is published. `robots.txt`
excludes it from search engines so it is not indexed as duplicate content.
