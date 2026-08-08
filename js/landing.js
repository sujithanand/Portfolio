/* Landing page interactions. All optional: the page reads fine without JS. */
(function () {
	"use strict";

	var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	/* --- Reveal on scroll -------------------------------------------------- */
	var revealables = document.querySelectorAll(".reveal, [data-stagger]");

	if (reduced || !("IntersectionObserver" in window)) {
		revealables.forEach(function (el) { el.classList.add("in"); });
	} else {
		var io = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				if (!entry.isIntersecting) return;
				entry.target.classList.add("in");
				io.unobserve(entry.target);
			});
		}, { rootMargin: "0px 0px -12% 0px", threshold: 0.12 });

		revealables.forEach(function (el) { io.observe(el); });

		/* Safety net. Content starts at opacity 0, so anything that has not been
		   revealed by now (deep anchor landing, observer quirk, slow frame) is
		   shown unconditionally. Copy must never be permanently invisible. */
		window.setTimeout(function () {
			revealables.forEach(function (el) { el.classList.add("in"); });
		}, 4000);
	}

	/* --- Count up ---------------------------------------------------------- */
	function format(el, value) {
		var prefix = el.dataset.prefix || "";
		var suffix = el.dataset.suffix || "";
		el.textContent = prefix + value + suffix;
	}

	function countUp(el) {
		var target = Number(el.dataset.count);
		if (!isFinite(target)) return;
		if (reduced) { format(el, target); return; }

		var duration = 1100;
		var start = performance.now();

		function tick(now) {
			var p = Math.min(1, (now - start) / duration);
			var eased = 1 - Math.pow(1 - p, 3);
			format(el, Math.round(target * eased));
			if (p < 1) requestAnimationFrame(tick);
		}
		requestAnimationFrame(tick);
	}

	var nums = document.querySelectorAll("[data-count]");
	if ("IntersectionObserver" in window && !reduced) {
		var numObserver = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				if (!entry.isIntersecting) return;
				countUp(entry.target);
				numObserver.unobserve(entry.target);
			});
		}, { threshold: 0.6 });
		nums.forEach(function (el) { numObserver.observe(el); });
	}

	/* --- Sticky nav state -------------------------------------------------- */
	var nav = document.getElementById("nav");
	var ticking = false;

	function onScroll() {
		if (ticking) return;
		ticking = true;
		requestAnimationFrame(function () {
			if (nav) nav.classList.toggle("is-stuck", window.scrollY > 12);
			ticking = false;
		});
	}
	window.addEventListener("scroll", onScroll, { passive: true });
	onScroll();

	/* --- Active section in nav --------------------------------------------- */
	var links = Array.prototype.slice.call(document.querySelectorAll(".nav-links a"));
	var sections = links
		/* Same-page anchors only. A cross-page href like "index.html#work" is a
		   valid selector that matches nothing, so it would just add dead work. */
		.filter(function (a) { return a.getAttribute("href").charAt(0) === "#"; })
		.map(function (a) { return document.querySelector(a.getAttribute("href")); })
		.filter(Boolean);

	if (sections.length && "IntersectionObserver" in window) {
		var spy = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				if (!entry.isIntersecting) return;
				links.forEach(function (a) {
					a.classList.toggle("active", a.getAttribute("href") === "#" + entry.target.id);
				});
			});
		}, { rootMargin: "-45% 0px -50% 0px" });
		sections.forEach(function (s) { spy.observe(s); });
	}

	/* --- Pointer sheen in the hero ----------------------------------------- */
	var hero = document.querySelector(".hero");
	var glow = document.getElementById("glow");

	if (hero && glow && !reduced && window.matchMedia("(hover: hover)").matches) {
		var pending = false;
		var lastX = 0;
		var lastY = 0;

		hero.addEventListener("pointermove", function (e) {
			var rect = hero.getBoundingClientRect();
			lastX = e.clientX - rect.left;
			lastY = e.clientY - rect.top;
			if (pending) return;
			pending = true;
			requestAnimationFrame(function () {
				glow.style.left = lastX + "px";
				glow.style.top = lastY + "px";
				pending = false;
			});
		});
	}
})();
