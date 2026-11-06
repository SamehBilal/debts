/* The app as an app: registers sw.js, shows the install key in the header (or the steps on
   iPhone/iPad), offers «Update now» when a new version is ready, and says when the connection
   drops or comes back. Loaded last. */
(function () {
	'use strict';
	var html = document.documentElement;
	var standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
	var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
	var deferred = null;
	var btn = document.getElementById('install');
	if (standalone) html.classList.add('is-app');

	/* ---------- install ---------- */
	function place() { btn.hidden = standalone || !(deferred || ios); }
	btn.addEventListener('click', function () {
		if (deferred) {
			deferred.prompt();
			deferred.userChoice.then(function () { deferred = null; place(); });
		} else if (ios) {
			Notify(L('في سفاري: اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».', 'In Safari, tap Share, then “Add to Home Screen”.'), { title: L('ثبّت ديوني', 'Install Debts'), ttl: 9000 });
		}
	});
	window.addEventListener('beforeinstallprompt', function (ev) { ev.preventDefault(); deferred = ev; place(); });
	window.addEventListener('appinstalled', function () {
		deferred = null; standalone = true; place();
		Notify(L('صار ديوني على شاشتك الرئيسية.', 'Debts is on your home screen now.'), { type: 'success' });
	});
	place();

	/* ---------- connection ---------- */
	window.addEventListener('offline', function () {
		Notify(L('انقطع الاتصال. التطبيق يعمل كما هو، والخرائط تعرض ما رأيته من قبل.', 'You’re offline. The app works as usual; maps show what you’ve seen before.'), { type: 'warning', ttl: 5000 });
	});
	window.addEventListener('online', function () { Notify(L('عاد الاتصال.', 'Back online.'), { type: 'success', ttl: 2000 }); });

	/* ---------- service worker and updates ---------- */
	if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
	/* while developing (localhost), no service worker — edits show at once; add ?sw to try it offline */
	if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !/[?&]sw\b/.test(location.search)) {
		navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); });
		return;
	}
	var reloading = false;
	navigator.serviceWorker.addEventListener('controllerchange', function () { if (reloading) location.reload(); });
	function offerUpdate(worker) {
		Notify(L('نسخة أحدث من التطبيق جاهزة.', 'A newer version of the app is ready.'), {
			title: L('تحديث', 'Update'), ttl: 0,
			actions: [{ label: L('حدّث الآن', 'Update now'), run: function () { reloading = true; worker.postMessage('skipWaiting'); } }]
		});
	}
	window.addEventListener('load', function () {
		navigator.serviceWorker.register('sw.js', { scope: './' }).then(function (reg) {
			if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
			reg.addEventListener('updatefound', function () {
				var w = reg.installing;
				if (!w) return;
				w.addEventListener('statechange', function () {
					/* only an update, not the first install */
					if (w.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(w);
				});
			});
			document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reg.update().catch(function () {}); });
		}).catch(function () {});
	});
})();
