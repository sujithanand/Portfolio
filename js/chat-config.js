/* ==========================================================================
   Ask AI configuration.

   This file is PUBLIC. Whatever ends up in the deployed copy is readable by
   anyone who views source.

   Two modes:

   LOCAL       The page talks to tools/dev-proxy.py on the same origin. The key
               stays in .env, inside that process, and never reaches the
               browser. Unchanged, and this is what runs on localhost.

   PRODUCTION  The panel loads BotDojo's embedded widget in an iframe. The
               key is substituted at deploy time by
               .github/workflows/deploy.yml, which reads BOTDOJO_API_KEY from
               GitHub Actions secrets, so the repository stays clean.

               Calling api.botdojo.com from the page is not an option: that
               API only accepts browser requests from BotDojo's own domains
               and answers "Not allowed by CORS https://sujithanand.com".
               The widget is served from embed.botdojo.com, which is allowed.

               The key is public once deployed, which is inherent to the
               embed snippet BotDojo issues. Keep it on the personal account
               and treat rotation as routine.
   ========================================================================== */

/* Substituted during deploy. Left as this literal placeholder in the
   repository, so nothing secret is ever committed. */
var BOTDOJO_API_KEY = "__BOTDOJO_API_KEY__";

/* Not secrets. These identify the flow and are useless without a key. */
var BOTDOJO = {
	baseUrl: "https://api.botdojo.com/api/v1",
	accountId: "a558d7f0-9317-11f1-b612-07ceb417b5d8",
	projectId: "a63db9b0-9317-11f1-b612-07ceb417b5d8",
	flowId: "c9212701-9317-11f1-8468-3f6dc86f4517"
};

/* Hosts served as static files, with no proxy behind them. */
var STATIC_ONLY_HOSTS = [
	"sujithanand.com",
	"www.sujithanand.com",
	"sujithanand.github.io"
];

if (STATIC_ONLY_HOSTS.indexOf(location.hostname) === -1) {
	/* Local, and anywhere else: through the proxy, exactly as before. */
	window.CHAT_ENDPOINT = "/api/ask";
	window.CHAT_DIRECT = null;
} else {
	/* Deployed: BotDojo's embedded widget, loaded into the Ask AI panel.

	   Not a direct API call. api.botdojo.com only accepts browser requests
	   from BotDojo's own domains, so a call from this site is rejected with
	   "Not allowed by CORS" no matter what key it carries. The widget is
	   served from embed.botdojo.com, which is on that allowlist, so framing
	   it works where calling the API does not.

	   Same key as the API, which is how BotDojo's embed snippet is issued.
	   Substituted at deploy time, so the repository stays clean. */
	window.CHAT_ENDPOINT = null;
	window.CHAT_DIRECT = null;
	window.CHAT_EMBED_URL = BOTDOJO_API_KEY.indexOf("__") === 0 ? null :
		"https://embed.botdojo.com/embed/chat?key=" + encodeURIComponent(BOTDOJO_API_KEY);
}
