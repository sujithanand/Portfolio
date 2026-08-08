/* Production proxy for the Ask AI chat.
 *
 * Written for Cloudflare Pages Functions, which passes `env` from the host's
 * environment variables. The same handler body ports to a Vercel or Netlify
 * function with only the signature changed.
 *
 * Set these as environment variables on the host, never in the repo:
 *   BOTDOJO_API_KEY, BOTDOJO_ACCOUNT_ID, BOTDOJO_PROJECT_ID,
 *   BOTDOJO_FLOW_ID, BOTDOJO_BASE_URL
 *
 * The key is read here and never sent to the browser.
 */

const MAX_MESSAGE = 2000;

function json(body, status) {
	return new Response(JSON.stringify(body), {
		status: status || 200,
		headers: { "Content-Type": "application/json" }
	});
}

export async function onRequestPost({ request, env }) {
	const required = [
		"BOTDOJO_API_KEY", "BOTDOJO_ACCOUNT_ID",
		"BOTDOJO_PROJECT_ID", "BOTDOJO_FLOW_ID", "BOTDOJO_BASE_URL"
	];
	if (required.some((k) => !env[k])) {
		return json({ error: "The assistant is not configured." }, 500);
	}

	let payload;
	try {
		payload = await request.json();
	} catch (e) {
		return json({ error: "Could not parse the request." }, 400);
	}

	const message = String((payload && payload.message) || "").trim();
	const sessionId = (payload && payload.sessionId) || null;

	if (!message) return json({ error: "Message is required." }, 400);
	if (message.length > MAX_MESSAGE) return json({ error: "Message is too long." }, 400);

	const url = `${env.BOTDOJO_BASE_URL}/accounts/${env.BOTDOJO_ACCOUNT_ID}` +
		`/projects/${env.BOTDOJO_PROJECT_ID}/flows/${env.BOTDOJO_FLOW_ID}/run`;

	/* Conversation memory lives on BotDojo's side, keyed by flow_session_id.
	   Omitting it starts a new session; passing one back continues that
	   conversation, so prior turns do not need replaying. */
	const options = { stream: "none" };
	if (sessionId) options.flow_session_id = sessionId;

	let data;
	try {
		const upstream = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": env.BOTDOJO_API_KEY
			},
			body: JSON.stringify({ options, body: { user_message: message } })
		});

		if (!upstream.ok) {
			const detail = await upstream.text().catch(() => "");

			/* A session BotDojo no longer knows about. Tell the client so it can
			   drop the stale id and start fresh, rather than wedging. */
			if (sessionId && /error loading session/i.test(detail)) {
				return json({
					error: "That conversation expired. Starting a new one.",
					code: "session_invalid"
				}, 409);
			}

			return json({ error: `The assistant is unavailable (${upstream.status}).` }, 502);
		}
		data = await upstream.json();
	} catch (e) {
		return json({ error: "Could not reach the assistant." }, 502);
	}

	const reply = String(
		(data && data.response && data.response.text_output) ||
		(data && data.aiMessage && data.aiMessage.content) || ""
	).trim();

	if (!reply) return json({ error: "The assistant returned an empty response." }, 502);

	return json({ reply, sessionId: data && data.flow_session_id });
}
