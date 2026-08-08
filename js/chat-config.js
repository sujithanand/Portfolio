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
/* Hosts where the site is served as static files with no proxy behind it.
   Ask AI removes itself there. Everywhere else it assumes a proxy on the same
   origin, so it stays visible during local development however the page is
   opened, and reports a useful message if the proxy is not running.

   When a proxy is deployed for production, replace this whole block with:
       window.CHAT_ENDPOINT = "https://your-proxy-host/api/ask";
   and allow this origin via CORS on that host. */
var STATIC_ONLY_HOSTS = [
	"sujithanand.com",
	"www.sujithanand.com",
	"sujithanand.github.io"
];

window.CHAT_ENDPOINT =
	STATIC_ONLY_HOSTS.indexOf(location.hostname) === -1 ? "/api/ask" : null;
