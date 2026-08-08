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
window.CHAT_ENDPOINT = location.hostname === "localhost" || location.hostname === "127.0.0.1"
	? "/api/ask"
	: null;
