/* ==========================================================================
   Ask AI configuration.

   This file is PUBLIC. Whatever ends up in the deployed copy is readable by
   anyone who views source.

   Two modes:

   LOCAL       The page talks to tools/dev-proxy.py on the same origin. The key
               stays in .env, inside that process, and never reaches the
               browser. Unchanged, and this is what runs on localhost.

   PRODUCTION  The page talks to BotDojo directly. The placeholder below is
               substituted at deploy time by .github/workflows/deploy.yml,
               which reads BOTDOJO_API_KEY from GitHub Actions secrets. The
               repository never contains the key. The deployed site does,
               because a static page has nowhere else to keep it.

   Two things must be true for production to work:

     1. sujithanand.com has to be on BotDojo's allowed origins list. The API
        currently answers "Not allowed by CORS https://sujithanand.com", and a
        browser cannot work around that. Set it in the BotDojo console.

     2. The key is public once deployed. Keep it on the personal account,
        scoped to this one flow, and treat rotation as routine.
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
	/* Deployed: call BotDojo from the browser. If the placeholder was never
	   substituted there is no usable key, so the button hides rather than
	   offering a control that cannot work. */
	window.CHAT_ENDPOINT = null;
	window.CHAT_DIRECT = BOTDOJO_API_KEY.indexOf("__") === 0 ? null : {
		url: BOTDOJO.baseUrl + "/accounts/" + BOTDOJO.accountId +
			"/projects/" + BOTDOJO.projectId + "/flows/" + BOTDOJO.flowId + "/run",
		key: BOTDOJO_API_KEY
	};
}
