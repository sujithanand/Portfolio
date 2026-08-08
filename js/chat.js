/* ==========================================================================
   Ask AI chat.

   The browser never sees the API key. It posts to a small proxy endpoint
   (see functions/api/ask.js for production, tools/dev-proxy.py for local),
   which reads the key from an environment variable and calls BotDojo.

   Conversation memory lives on BotDojo's side. Each reply carries a
   flow_session_id; sending it back on the next turn continues that same
   conversation. The id is stored so a reload resumes where it left off, and
   is cleared only by New chat. The transcript kept here is for redrawing the
   panel, not for feeding the model.
   ========================================================================== */
(function () {
	"use strict";

	/* Set in js/chat-config.js. Null means no proxy is reachable from this
	   origin, so the feature hides itself rather than offering a button that
	   can only fail. */
	var ENDPOINT = typeof window.CHAT_ENDPOINT === "undefined" ? "/api/ask" : window.CHAT_ENDPOINT;
	var STORE_KEY = "askai:transcript:v1";
	var SESSION_KEY = "askai:session:v1";
	var MAX_CHARS = 2000;

	var root = document.getElementById("chat-root");
	var panel = document.getElementById("chat-panel");
	var log = document.getElementById("chat-log");
	var form = document.getElementById("chat-form");
	var input = document.getElementById("chat-input");
	var sendBtn = document.getElementById("chat-send");
	var resetBtn = document.getElementById("chat-reset");
	var count = document.getElementById("chat-count");
	var opener = document.getElementById("ask-ai");

	if (!root || !opener) return;

	/* Production path: BotDojo's own chat, loaded into this panel from a public
	   embed URL. Keeps the button and the panel chrome, needs no proxy, and
	   puts no secret in the page. */
	var EMBED = window.CHAT_EMBED_URL || null;
	var DIRECT = window.CHAT_DIRECT || null;

	if (!ENDPOINT && !DIRECT && !EMBED) {
		/* Nothing to talk to. Remove the entry point: a visible button that
		   always errors is worse than no button. */
		opener.remove();
		root.remove();
		return;
	}

	if (!ENDPOINT && !DIRECT && EMBED) {
		mountEmbed();
		return;
	}

	function mountEmbed() {
		var panelEl = document.getElementById("chat-panel");
		panelEl.classList.add("is-embed");

		/* The composer, the reset button and the disclaimer all belong to the
		   custom UI. BotDojo's widget brings its own. */
		var composer = panelEl.querySelector(".chat-composer");
		if (composer) composer.remove();
		if (resetBtn) resetBtn.remove();

		/* Our greeting, in our type and our gradient, above the provider's chat.
		   The widget's own welcome message should be left short or empty in the
		   BotDojo console, or the reader is welcomed twice. */
		var hello = document.createElement("div");
		hello.className = "chat-embed-hello";
		hello.innerHTML =
			'<h3>Hello. Ask me about <span class="g">design leadership</span>.</h3>' +
			"<p>How I lead teams, the systems I own, and the products my team designs.</p>";
		log.parentNode.insertBefore(hello, log);

		var frame = document.createElement("iframe");
		frame.className = "chat-frame";
		frame.title = "Ask AI";
		frame.setAttribute("loading", "lazy");
		frame.setAttribute("allow", "clipboard-write");
		log.replaceWith(frame);

		function openEmbed() {
			lastFocus = document.activeElement;
			root.hidden = false;
			requestAnimationFrame(function () { root.classList.add("is-open"); });
			opener.setAttribute("aria-expanded", "true");
			document.body.style.overflow = "hidden";
			/* Loaded on first open rather than on page load, so the widget costs
			   nothing to a visitor who never opens it. */
			if (!frame.src) frame.src = EMBED;
		}

		function closeEmbed() {
			root.classList.remove("is-open");
			opener.setAttribute("aria-expanded", "false");
			document.body.style.overflow = "";
			window.setTimeout(function () { root.hidden = true; }, reduced ? 0 : 260);
			if (lastFocus && lastFocus.focus) lastFocus.focus();
		}

		opener.addEventListener("click", function () {
			if (root.hidden) openEmbed();
			else closeEmbed();
		});

		Array.prototype.forEach.call(root.querySelectorAll("[data-chat-close]"), function (el) {
			el.addEventListener("click", closeEmbed);
		});

		document.addEventListener("keydown", function (e) {
			if (!root.hidden && e.key === "Escape") {
				e.preventDefault();
				closeEmbed();
			}
		});

		if (window.location.hash === "#ask") openEmbed();
	}

	var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	var messages = [];       /* {role, content} */
	var busy = false;
	var controller = null;   /* AbortController for the in-flight request */
	var typer = null;        /* rAF id for the reveal animation */
	var lastFocus = null;
	var sessionId = null;    /* BotDojo flow_session_id, the server side thread */

	var SUGGESTIONS = [
		"How do your designers ship front end code themselves?",
		"How do you run a design team across 13 products?",
		"What does the design system cover?",
		"How do you use AI in design work?"
	];

	/* --- Storage ----------------------------------------------------------- */

	function load() {
		try {
			var raw = localStorage.getItem(STORE_KEY);
			var parsed = raw ? JSON.parse(raw) : [];
			return Array.isArray(parsed) ? parsed : [];
		} catch (e) {
			return [];
		}
	}

	function save() {
		try {
			localStorage.setItem(STORE_KEY, JSON.stringify(messages));
		} catch (e) {
			/* Private mode or quota. Chat still works, it just will not persist. */
		}
	}

	function loadSession() {
		try {
			return localStorage.getItem(SESSION_KEY) || null;
		} catch (e) {
			return null;
		}
	}

	function saveSession(id) {
		sessionId = id || null;
		try {
			if (sessionId) localStorage.setItem(SESSION_KEY, sessionId);
			else localStorage.removeItem(SESSION_KEY);
		} catch (e) { }
	}

	/* --- Rendering --------------------------------------------------------- */

	function escapeHtml(str) {
		return str
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	}

	/* Small subset of Markdown. Everything is escaped first, so nothing the
	   model returns can inject markup. */
	function renderMarkdown(src) {
		var text = escapeHtml(src);
		var blocks = [];

		/* Fenced code, pulled out first so its contents are left alone. The
		   placeholder uses a control character so it can never collide with a
		   number that happens to appear in the answer. */
		text = text.replace(/```(?:\w+)?\n?([\s\S]*?)```/g, function (m, code) {
			blocks.push("<pre><code>" + code.replace(/\n$/, "") + "</code></pre>");
			return "\u0000" + (blocks.length - 1) + "\u0000";
		});

		text = text
			.replace(/`([^`\n]+)`/g, "<code>$1</code>")
			.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
			.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>")
			.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
				'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

		var html = text.split(/\n{2,}/).map(function (para) {
			var lines = para.split("\n");

			if (lines.every(function (l) { return /^\s*[-*]\s+/.test(l); })) {
				return "<ul>" + lines.map(function (l) {
					return "<li>" + l.replace(/^\s*[-*]\s+/, "") + "</li>";
				}).join("") + "</ul>";
			}

			if (lines.every(function (l) { return /^\s*\d+[.)]\s+/.test(l); })) {
				return "<ol>" + lines.map(function (l) {
					return "<li>" + l.replace(/^\s*\d+[.)]\s+/, "") + "</li>";
				}).join("") + "</ol>";
			}

			if (/^\u0000\d+\u0000$/.test(para.trim())) return para;

			return "<p>" + lines.join("<br>") + "</p>";
		}).join("");

		return html.replace(/\u0000(\d+)\u0000/g, function (m, i) { return blocks[i]; });
	}

	function botAvatar() {
		return '<span class="chat-avatar" aria-hidden="true">' +
			'<svg width="18" height="18" viewBox="0 0 24 24" fill="none">' +
			'<path d="M12 2.5c.75 5.15 3.85 8.25 9 9-5.15.75-8.25 3.85-9 9-.75-5.15-3.85-8.25-9-9 5.15-.75 8.25-3.85 9-9Z" fill="url(#chatSparkA)"/>' +
			"</svg></span>";
	}

	function addMessageEl(role, html) {
		var wrap = document.createElement("div");
		wrap.className = "chat-msg " + role;

		if (role === "bot") wrap.innerHTML = botAvatar();

		var bubble = document.createElement("div");
		bubble.className = "chat-bubble";
		bubble.innerHTML = html;

		/* Caps the bubble width without letting the flex item shrink below its
		   content, which is what broke short words across lines. */
		var col = document.createElement("div");
		col.style.maxWidth = "84%";
		col.appendChild(bubble);
		wrap.appendChild(col);

		log.appendChild(wrap);
		scrollToEnd();
		return { wrap: wrap, bubble: bubble, col: col };
	}

	function addCopyAction(node, getText) {
		var bar = document.createElement("div");
		bar.className = "chat-actions";

		var btn = document.createElement("button");
		btn.type = "button";
		btn.className = "chat-mini";
		btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
			'<rect x="9" y="9" width="12" height="12" rx="2.5" stroke="currentColor" stroke-width="2"/>' +
			'<path d="M15 5.5A2.5 2.5 0 0 0 12.5 3H5.5A2.5 2.5 0 0 0 3 5.5v7A2.5 2.5 0 0 0 5.5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
			"</svg><span>Copy</span>";

		btn.addEventListener("click", function () {
			var text = getText();
			var done = function () {
				btn.querySelector("span").textContent = "Copied";
				window.setTimeout(function () {
					btn.querySelector("span").textContent = "Copy";
				}, 1600);
			};
			if (navigator.clipboard && navigator.clipboard.writeText) {
				navigator.clipboard.writeText(text).then(done, function () { });
			} else {
				var ta = document.createElement("textarea");
				ta.value = text;
				document.body.appendChild(ta);
				ta.select();
				try { document.execCommand("copy"); done(); } catch (e) { }
				document.body.removeChild(ta);
			}
		});

		bar.appendChild(btn);
		node.appendChild(bar);
	}

	function scrollToEnd() {
		log.scrollTop = log.scrollHeight;
	}

	function renderGreeting() {
		var el = document.createElement("div");
		el.className = "chat-greeting";
		el.innerHTML =
			'<h3>Hello. Ask me about <span class="g">design leadership</span>.</h3>' +
			"<p>This assistant answers questions about how I lead teams, the systems I own, " +
			"and the products my team designs.</p>";

		var chips = document.createElement("div");
		chips.className = "chat-suggestions";

		SUGGESTIONS.forEach(function (text) {
			var chip = document.createElement("button");
			chip.type = "button";
			chip.className = "chat-chip";
			chip.textContent = text;
			chip.addEventListener("click", function () { submit(text); });
			chips.appendChild(chip);
		});

		el.appendChild(chips);
		log.appendChild(el);
	}

	function renderAll() {
		log.innerHTML = "";

		if (!messages.length) {
			renderGreeting();
			return;
		}

		messages.forEach(function (m) {
			if (m.role === "user") {
				addMessageEl("user", escapeHtml(m.content).replace(/\n/g, "<br>"));
			} else {
				var node = addMessageEl("bot", renderMarkdown(m.content));
				addCopyAction(node.col, function () { return m.content; });
			}
		});

		scrollToEnd();
	}

	/* --- Sending ----------------------------------------------------------- */

	function setBusy(state) {
		busy = state;
		resetBtn.disabled = state;
		sendBtn.classList.toggle("is-stop", state);
		sendBtn.setAttribute("aria-label", state ? "Stop generating" : "Send message");
		sendBtn.innerHTML = state
			? '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="3" fill="currentColor"/></svg>'
			: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
		sendBtn.disabled = state ? false : !input.value.trim();
	}

	function showThinking() {
		var node = addMessageEl("bot", '<div class="chat-dots"><i></i><i></i><i></i></div>');
		return node;
	}

	function showError(message, retry) {
		var el = document.createElement("div");
		el.className = "chat-error";
		el.setAttribute("role", "alert");

		var text = document.createElement("span");
		text.style.flex = "1";
		text.textContent = message + " ";
		el.appendChild(text);

		if (retry) {
			var btn = document.createElement("button");
			btn.type = "button";
			btn.textContent = "Retry";
			btn.addEventListener("click", function () {
				el.remove();
				retry();
			});
			el.appendChild(btn);
		}

		log.appendChild(el);
		scrollToEnd();
	}

	/* Reveals the answer a few characters at a time. The API returns the whole
	   string at once, so this is presentation, not real streaming. */
	function reveal(bubble, text, onDone) {
		if (reduced) {
			bubble.innerHTML = renderMarkdown(text);
			scrollToEnd();
			onDone();
			return;
		}

		var i = 0;
		bubble.classList.add("is-typing");

		function step() {
			i = Math.min(text.length, i + Math.max(2, Math.round(text.length / 240)));
			bubble.innerHTML = renderMarkdown(text.slice(0, i));
			scrollToEnd();

			if (i < text.length) {
				typer = requestAnimationFrame(step);
			} else {
				bubble.classList.remove("is-typing");
				typer = null;
				onDone();
			}
		}

		typer = requestAnimationFrame(step);
	}

	function stopTyping() {
		if (typer) {
			cancelAnimationFrame(typer);
			typer = null;
		}
	}

	function submit(text) {
		text = (text || "").trim();
		if (!text || busy) return;

		var greeting = log.querySelector(".chat-greeting");
		if (greeting) greeting.remove();

		messages.push({ role: "user", content: text });
		save();
		addMessageEl("user", escapeHtml(text).replace(/\n/g, "<br>"));

		input.value = "";
		autosize();
		updateCount();
		ask(text);
	}

	/* Two transports, one contract: resolve to {reply, sessionId}.

	   Through the proxy the server owns the BotDojo payload shape. Direct from
	   the browser this file owns it, so the request and response shapes below
	   mirror functions/api/ask.js deliberately. Change one, change both. */
	function send(text, signal) {
		if (DIRECT) {
			var options = { stream: "none" };
			if (sessionId) options.flow_session_id = sessionId;

			return fetch(DIRECT.url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": DIRECT.key
				},
				body: JSON.stringify({ options: options, body: { user_message: text } }),
				signal: signal
			}).then(function (res) {
				if (!res.ok) {
					return res.text().then(function (detail) {
						var error = new Error(
							/not allowed by cors/i.test(detail)
								? "This site is not on the assistant's allowed origins list yet."
								: "The assistant is unavailable (" + res.status + ").");
						/* A session the server has forgotten. Same contract as the proxy. */
						if (sessionId && /error loading session/i.test(detail)) {
							error.code = "session_invalid";
						}
						throw error;
					});
				}
				return res.json();
			}).then(function (data) {
				return {
					reply: ((data.response && data.response.text_output) ||
						(data.aiMessage && data.aiMessage.content) || "").trim(),
					sessionId: data.flow_session_id
				};
			});
		}

		return fetch(ENDPOINT, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ message: text, sessionId: sessionId }),
			signal: signal
		}).then(function (res) {
			return res.json().then(function (data) {
				if (!res.ok) {
					var error = new Error(data && data.error ? data.error : "Request failed (" + res.status + ")");
					error.code = data && data.code;
					throw error;
				}
				return data;
			}, function () {
				throw new Error("The assistant returned an unreadable response.");
			});
		});
	}

	function ask(text, isRetryAfterExpiry) {
		var thinking = showThinking();
		setBusy(true);
		controller = new AbortController();

		send(text, controller.signal)
			.then(function (data) {
				/* Keep the thread id the server just handed back. */
				if (data && data.sessionId) saveSession(data.sessionId);

				var replyText = (data && data.reply || "").trim();
				if (!replyText) throw new Error("The assistant returned an empty response.");

				/* Recorded before the reveal animation, not after: closing the tab
				   mid-answer must not lose a reply the server already sent. */
				messages.push({ role: "assistant", content: replyText });
				save();

				thinking.bubble.innerHTML = "";
				reveal(thinking.bubble, replyText, function () {
					addCopyAction(thinking.col, function () { return replyText; });
					setBusy(false);
					controller = null;
				});
			})
			.catch(function (err) {
				thinking.wrap.remove();
				setBusy(false);
				controller = null;

				if (err && err.name === "AbortError") return;

				/* The stored session no longer exists on the server. Drop it and
				   try once more, so an expired thread costs the reader nothing
				   beyond losing the model's memory of earlier turns. */
				if (err && err.code === "session_invalid" && !isRetryAfterExpiry) {
					saveSession(null);
					ask(text, true);
					return;
				}

				showError(explain(err), function () { ask(text); });
			});
	}

	/* "Failed to fetch" on its own tells the reader nothing. The usual cause is
	   that the page was opened as a file, or served by something that does not
	   implement /api/ask, so name that case directly. */
	function explain(err) {
		if (navigator.onLine === false) return "You appear to be offline.";

		var isNetwork = err instanceof TypeError ||
			/failed to fetch|networkerror|load failed/i.test((err && err.message) || "");

		if (isNetwork) {
			if (window.location.protocol === "file:") {
				return "This page is open as a file, so it cannot reach the assistant. " +
					"Run python3 tools/dev-proxy.py and open http://localhost:8000 instead.";
			}
			if (DIRECT) {
				return "Could not reach the assistant. If this keeps happening, " +
					"this site may not be on its allowed origins list.";
			}
			return "Could not reach " + ENDPOINT + ". Is the proxy running? " +
				"Start it with python3 tools/dev-proxy.py";
		}

		return (err && err.message) || "Something went wrong.";
	}

	function stop() {
		if (controller) controller.abort();
		stopTyping();

		/* The full answer is already stored if one arrived, so stopping only
		   ends the animation. Show the whole reply rather than freezing it
		   part way, and drop the bubble if nothing had arrived yet. */
		var last = log.querySelector(".chat-msg.bot:last-child .chat-bubble");
		if (last) {
			last.classList.remove("is-typing");
			var newest = messages[messages.length - 1];

			if (newest && newest.role === "assistant") {
				last.innerHTML = renderMarkdown(newest.content);
			} else if (!last.textContent.trim()) {
				last.closest(".chat-msg").remove();
			}
		}

		setBusy(false);
		controller = null;
	}

	/* --- Composer ---------------------------------------------------------- */

	function autosize() {
		input.style.height = "auto";
		input.style.height = Math.min(132, input.scrollHeight) + "px";
	}

	function updateCount() {
		var len = input.value.length;
		var near = len > MAX_CHARS - 200;
		count.textContent = near ? len + " / " + MAX_CHARS : "";
		count.classList.toggle("is-over", len >= MAX_CHARS);
		if (!busy) sendBtn.disabled = !input.value.trim();
	}

	input.addEventListener("input", function () {
		autosize();
		updateCount();
	});

	input.addEventListener("keydown", function (e) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			if (!busy) submit(input.value);
		}
	});

	form.addEventListener("submit", function (e) {
		e.preventDefault();
		if (busy) stop();
		else submit(input.value);
	});

	/* New chat is the only thing that abandons the server side session. */
	resetBtn.addEventListener("click", function () {
		if (busy) return;
		messages = [];
		save();
		saveSession(null);
		renderAll();
		input.focus();
	});

	/* --- Open and close ---------------------------------------------------- */

	function focusables() {
		return Array.prototype.filter.call(
			panel.querySelectorAll('button, textarea, a[href], [tabindex]:not([tabindex="-1"])'),
			function (el) { return !el.disabled && el.offsetParent !== null; }
		);
	}

	function open() {
		lastFocus = document.activeElement;
		root.hidden = false;
		/* Next frame, so the transition has a starting state to animate from. */
		requestAnimationFrame(function () { root.classList.add("is-open"); });
		opener.setAttribute("aria-expanded", "true");
		document.body.style.overflow = "hidden";

		messages = load();
		sessionId = loadSession();
		renderAll();
		window.setTimeout(function () { input.focus(); }, 60);
	}

	function close() {
		if (busy) stop();
		root.classList.remove("is-open");
		opener.setAttribute("aria-expanded", "false");
		document.body.style.overflow = "";

		window.setTimeout(function () { root.hidden = true; }, reduced ? 0 : 260);
		if (lastFocus && lastFocus.focus) lastFocus.focus();
	}

	opener.addEventListener("click", function () {
		if (root.hidden) open();
		else close();
	});

	Array.prototype.forEach.call(root.querySelectorAll("[data-chat-close]"), function (el) {
		el.addEventListener("click", close);
	});

	document.addEventListener("keydown", function (e) {
		if (root.hidden) return;

		if (e.key === "Escape") {
			e.preventDefault();
			close();
			return;
		}

		if (e.key === "Tab") {
			var items = focusables();
			if (!items.length) return;
			var first = items[0];
			var last = items[items.length - 1];

			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}
	});

	/* --- Deep links -------------------------------------------------------- */

	/* #ask opens the panel. ?ask=... opens it and sends that question, which
	   makes a single question shareable as a link. */
	(function deepLink() {
		var params = new URLSearchParams(window.location.search);
		var question = (params.get("ask") || "").trim();

		if (question) {
			open();
			window.setTimeout(function () { submit(question.slice(0, MAX_CHARS)); }, 120);
		} else if (window.location.hash === "#ask") {
			open();
		}
	})();

	updateCount();
})();
