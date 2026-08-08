/* ==========================================================================
   Ask AI endpoint configuration.

   This file is PUBLIC. It ships to every visitor. Never put the BotDojo API
   key, or any other secret, in here or anywhere else the browser can load.

   Why there is no key in the front end at all:
   GitHub Pages serves static files. A GitHub Actions secret exists only while
   the build runs, so substituting it into a file at build time writes the
   secret into the published JavaScript, where anyone can read it from view
   source. Secrets belong on a server that can hold them at runtime.

   CHAT_ENDPOINT points at a proxy that holds the key server side and forwards
   to BotDojo. See functions/api/ask.js for the handler and README.md for the
   deployment options.

     null                     Ask AI is hidden. Correct for a static-only
                              deploy with no proxy running yet.
     "/api/ask"               Same origin. Correct for local development with
                              tools/dev-proxy.py, and for any host that runs
                              the site and the function together.
     "https://host/api/ask"   Absolute URL. Correct when the site is on
                              GitHub Pages and the proxy lives elsewhere.
                              That host must allow this origin via CORS.
   ========================================================================== */
/* --- Production: BotDojo public embed ------------------------------------
   BotDojo's embedded widget uses a PUBLIC embed key, meant for client side
   HTML. It is not the server API key and must never be replaced with one.
   Get it from the BotDojo console under Deploy, Embedded Widget, then paste
   the whole iframe URL here:

       window.CHAT_EMBED_URL =
           "https://embed.botdojo.com/embed/chat?key=YOUR_PUBLIC_EMBED_KEY";

   With this set, the Ask AI panel hosts BotDojo's chat directly, so the site
   needs no proxy and holds no secret. Leave it null to keep the panel hidden
   in production.

   Worth confirming in the BotDojo console: whether the embed key can be
   restricted to sujithanand.com. Without a domain restriction anyone who
   reads the page can point the key at your flow, which costs you usage. */
window.CHAT_EMBED_URL = null;

/* --- Local development ----------------------------------------------------
   Hosts where the site is served as static files with no proxy behind it.
   The custom chat UI removes itself there and the embed above takes over if
   configured. Everywhere else it assumes a proxy on the same origin, so it
   stays visible during local development however the page is opened. */
var STATIC_ONLY_HOSTS = [
	"sujithanand.com",
	"www.sujithanand.com",
	"sujithanand.github.io"
];

window.CHAT_ENDPOINT =
	STATIC_ONLY_HOSTS.indexOf(location.hostname) === -1 ? "/api/ask" : null;
