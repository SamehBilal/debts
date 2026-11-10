/* Service worker: the app opens and works with no connection.
   - The app itself (page, scripts, styles, icons): precached at install, served from the cache at
     once and refreshed in the background. A new VERSION means a new install, and the app offers
     «Update now» (pwa.js).
   - Fonts and the map's code (Leaflet): kept once fetched.
   - Map tiles: kept as they are seen (at most TILE_MAX), so the places you've looked at open offline.
   Your debts are never here: they live in localStorage, not in a cache.
   VERSION and PRECACHE are rewritten by tools/build-sw.js — run it after changing files. */
'use strict';

var VERSION = 'debts-15ec43a014';
var PRECACHE = [
	'./',
	'index.html',
	'manifest.webmanifest',
	'assets/js/app.js',
	'assets/js/i18n.js',
	'assets/js/jar.js',
	'assets/js/modal.js',
	'assets/js/notify.js',
	'assets/js/places.js',
	'assets/js/plan.js',
	'assets/js/pwa.js',
	'assets/js/roller.js',
	'assets/js/store.js',
	'assets/css/app.css',
	'assets/img/icons/icon-192.png',
	'assets/img/icons/icon-512.png',
	'assets/img/icons/icon.svg',
	'assets/img/icons/maskable-192.png',
	'assets/img/icons/maskable-512.png',
	'assets/img/icons/maskable.svg'
];

var SHELL = 'debts-shell-' + VERSION;
var RUNTIME = 'debts-runtime';
var TILES = 'debts-tiles';
var TILE_MAX = 600;

self.addEventListener('install', function (ev) {
	ev.waitUntil(caches.open(SHELL).then(function (c) {
		/* one missing file shouldn't stop the whole install */
		return Promise.all(PRECACHE.map(function (u) {
			return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
		}));
	}));
});

self.addEventListener('activate', function (ev) {
	ev.waitUntil(caches.keys().then(function (keys) {
		return Promise.all(keys.filter(function (k) { return k.indexOf('debts-shell-') === 0 && k !== SHELL; }).map(function (k) { return caches.delete(k); }));
	}).then(function () { return self.clients.claim(); }));
});

self.addEventListener('message', function (ev) {
	if (ev.data === 'skipWaiting') self.skipWaiting();
});

/* the app's own files: this version's copy at once (the page whatever its query, ?source=pwa),
   else the network, else — for the page — index.html */
function shell(req) {
	return caches.open(SHELL).then(function (c) {
		return c.match(req, { ignoreSearch: true }).then(function (hit) {
			if (hit) return hit;
			return fetch(req).catch(function () {
				return req.mode === 'navigate' ? c.match('index.html') : new Response('', { status: 504 });
			});
		});
	});
}

function keep(req, cacheName, max) {
	return caches.open(cacheName).then(function (c) {
		return c.match(req).then(function (hit) {
			if (hit) return hit;
			return fetch(req).then(function (res) {
				if (res && (res.ok || res.type === 'opaque')) {
					c.put(req, res.clone());
					if (max) c.keys().then(function (keys) { if (keys.length > max) c.delete(keys[0]); });
				}
				return res;
			}).catch(function () { return new Response('', { status: 504 }); });
		});
	});
}

self.addEventListener('fetch', function (ev) {
	var req = ev.request;
	if (req.method !== 'GET') return;
	var url = new URL(req.url);
	if (url.origin === self.location.origin) { ev.respondWith(shell(req)); return; }
	if (/(^|\.)tile\.openstreetmap\.org$/.test(url.hostname)) { ev.respondWith(keep(req, TILES, TILE_MAX)); return; }
	if (/^(fonts\.(googleapis|gstatic)\.com|unpkg\.com)$/.test(url.hostname)) { ev.respondWith(keep(req, RUNTIME)); return; }
});
