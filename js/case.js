/* Case study page interactions. All optional: the page reads fine without JS.

   A trimmed version of js/landing.js. No count-up (case metrics are ranges
   like "20 to 5", which do not animate), no pointer sheen, and no section
   spy (the nav here points back at the landing page). */
(function () {
	"use strict";

	var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	/* --- Reveal on scroll -------------------------------------------------- */
	var revealables = document.querySelectorAll(".reveal");

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

		/* Safety net. Content starts at opacity 0, so anything not revealed by
		   now is shown unconditionally. Copy must never be permanently
		   invisible. */
		window.setTimeout(function () {
			revealables.forEach(function (el) { el.classList.add("in"); });
		}, 4000);
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

	/* --- Scrollable tables ------------------------------------------------- */

	/* A table that overflows needs to be reachable by keyboard, and it should
	   only advertise itself as scrollable when it actually is. */
	function syncTables() {
		document.querySelectorAll(".matrix-scroll").forEach(function (el) {
			var scrollable = el.scrollWidth > el.clientWidth + 1;
			if (scrollable) {
				el.setAttribute("tabindex", "0");
				el.setAttribute("role", "region");
			} else {
				el.removeAttribute("tabindex");
				el.removeAttribute("role");
			}
		});
	}

	syncTables();
	window.addEventListener("resize", syncTables, { passive: true });
})();
