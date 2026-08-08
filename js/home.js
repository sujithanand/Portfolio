(function () {
	const topbar = document.querySelector('.topbar');
	const counters = Array.from(document.querySelectorAll('.counter-value'));
	const progressTrack = document.querySelector('.scroll-progress');
	const progressBar = document.getElementById('scroll-progress-bar');
	const articlesViewport = document.querySelector('.articles-viewport');
	const articlesFade = document.querySelector('.articles-fade');
	const btnMore = document.getElementById('articles-show-more');
	const btnLess = document.getElementById('articles-show-less');
	if (articlesViewport && btnMore && btnLess) {
		btnMore.addEventListener('click', () => {
			articlesViewport.classList.remove('collapsed');
			if (articlesFade) articlesFade.remove();
			btnMore.style.display = 'none';
			btnLess.style.display = 'inline-flex';
		});
		btnLess.addEventListener('click', () => {
			articlesViewport.classList.add('collapsed');
			btnLess.style.display = 'none';
			btnMore.style.display = 'inline-flex';
			// no fade on collapse per requirement
			articlesViewport.scrollIntoView({ behavior: 'smooth', block: 'start' });
		});
	}
	if (!progressBar || !topbar || !progressTrack) return;

	const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
	const storageKey = 'home-highlight-counters-seen';

	function syncTopbarHeight() {
		document.documentElement.style.setProperty('--topbar-height', `${topbar.offsetHeight}px`);
	}

	function renderCounter(el, value) {
		const prefix = el.dataset.prefix || '';
		const suffix = el.dataset.suffix || '';
		el.textContent = `${prefix}${value}${suffix}`;
	}

	function animateCounter(el) {
		const target = Number(el.dataset.target || 0);
		const duration = 1200;
		const start = performance.now();

		function tick(now) {
			const progress = Math.min(1, (now - start) / duration);
			const eased = 1 - Math.pow(1 - progress, 3);
			const value = Math.round(target * eased);
			renderCounter(el, value);
			if (progress < 1) {
				requestAnimationFrame(tick);
			}
		}

		requestAnimationFrame(tick);
	}

	function setFinalCounters() {
		counters.forEach((el) => renderCounter(el, el.dataset.target || '0'));
	}

	function runCountersIfNeeded() {
		if (motionQuery.matches) {
			setFinalCounters();
			return;
		}

		if (localStorage.getItem(storageKey) === '1') {
			setFinalCounters();
			return;
		}

		setFinalCounters();
		requestAnimationFrame(() => {
			counters.forEach(animateCounter);
		});
		localStorage.setItem(storageKey, '1');
	}

	function updateProgress() {
		const doc = document.documentElement;
		const maxScroll = doc.scrollHeight - window.innerHeight;
		const progress = maxScroll > 0 ? (window.scrollY / maxScroll) * 100 : 0;
		const isScrolled = window.scrollY > 8;
		progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
		topbar.classList.toggle('is-scrolled', isScrolled);
		progressTrack.classList.toggle('is-visible', isScrolled);
	}

	syncTopbarHeight();
	runCountersIfNeeded();
	updateProgress();
	window.addEventListener('resize', syncTopbarHeight);
	window.addEventListener('scroll', updateProgress, { passive: true });
	window.addEventListener('resize', updateProgress);
})();
