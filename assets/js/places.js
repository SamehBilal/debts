/* Where a debt was made — the shop that owes you the change, the kiosk where you owe it.
   Places.here() asks the device for its location (only when the reader taps for it); the map is
   Leaflet with OpenStreetMap tiles, loaded the first time a map is needed (and kept by the service
   worker, tiles too, so a map you have seen opens offline).
   Places.picker(el, place, onChange) — a map to tap a pin on;  Places.overview(el, debts, onOpen) —
   every debt with a place;  Places.nearby(debts) — the open debts within 200 m of where you are,
   checked when the app opens if «remind me near» is on and the browser already allows location. */
(function () {
	'use strict';

	var LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist/';
	var TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
	var ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
	var loading = null;

	function leaflet() {
		if (window.L_ && window.L_.map) return Promise.resolve(window.L_);
		if (loading) return loading;
		loading = new Promise(function (resolve, reject) {
			var css = document.createElement('link');
			css.rel = 'stylesheet'; css.href = LEAFLET + 'leaflet.css'; css.crossOrigin = '';
			document.head.appendChild(css);
			/* the app's L(ar, en) is a global, so Leaflet's own «L» is moved aside as L_ */
			var mine = window.L;
			var s = document.createElement('script');
			s.src = LEAFLET + 'leaflet.js'; s.crossOrigin = '';
			s.onload = function () { window.L_ = window.L; window.L = mine; resolve(window.L_); };
			s.onerror = function () { window.L = mine; loading = null; reject(new Error('map')); };
			document.head.appendChild(s);
		});
		return loading;
	}

	function here(opts) {
		return new Promise(function (resolve, reject) {
			if (!navigator.geolocation) return reject(new Error('unsupported'));
			navigator.geolocation.getCurrentPosition(function (p) {
				resolve({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), acc: p.coords.accuracy });
			}, reject, Object.assign({ enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }, opts || {}));
		});
	}

	/* metres between two points */
	function distance(a, b) {
		var R = 6371000, rad = Math.PI / 180;
		var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
		var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
		return 2 * R * Math.asin(Math.sqrt(h));
	}
	function fmtDistance(m) { return m < 1000 ? I18n.num(Math.round(m / 10) * 10) + L(' م', ' m') : I18n.num(m / 1000) + L(' كم', ' km'); }

	function mapsLink(p) { return 'https://www.openstreetmap.org/?mlat=' + p.lat + '&mlon=' + p.lng + '#map=18/' + p.lat + '/' + p.lng; }
	function directionsLink(p) { return 'https://www.google.com/maps/dir/?api=1&destination=' + p.lat + ',' + p.lng; }

	function pin(Lf, cls) {
		return Lf.divIcon({ className: 'pin ' + (cls || ''), html: '<span></span>', iconSize: [28, 36], iconAnchor: [14, 34], popupAnchor: [0, -30] });
	}
	function failMap(el) {
		el.innerHTML = '<p class="map-off">' + L('الخريطة تحتاج إلى الإنترنت أول مرة. المكان محفوظ بإحداثياته على أي حال.', 'The map needs the internet the first time. The place is still saved by its coordinates.') + '</p>';
	}

	/* a map to choose a place: tap to drop the pin, drag it, or «use where I am» */
	function picker(el, place, onChange) {
		var api = { map: null, set: function () {} };
		leaflet().then(function (Lf) {
			var start = place || null;
			var map = Lf.map(el, { zoomControl: true, attributionControl: true }).setView(start ? [start.lat, start.lng] : [30.0444, 31.2357], start ? 17 : 3);
			Lf.tileLayer(TILES, { maxZoom: 19, attribution: ATTR, crossOrigin: true }).addTo(map);
			var marker = null;
			function set(p, pan) {
				if (!marker) {
					marker = Lf.marker([p.lat, p.lng], { draggable: true, icon: pin(Lf) }).addTo(map);
					marker.on('dragend', function () { var ll = marker.getLatLng(); onChange({ lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6) }); });
				} else marker.setLatLng([p.lat, p.lng]);
				if (pan) map.setView([p.lat, p.lng], Math.max(map.getZoom(), 17));
			}
			if (start) set(start);
			map.on('click', function (ev) {
				var p = { lat: +ev.latlng.lat.toFixed(6), lng: +ev.latlng.lng.toFixed(6) };
				set(p); onChange(p);
				/* far out, a tap is only roughly right: come closer to place it */
				if (map.getZoom() < 15) map.setView([p.lat, p.lng], Math.min(map.getZoom() + 4, 17));
			});
			api.map = map; api.set = set;
			setTimeout(function () { map.invalidateSize(); }, 200);
		}).catch(function () { failMap(el); });
		return api;
	}

	/* every debt with a place, on one map */
	function overview(el, debts, onOpen) {
		var api = { map: null };
		leaflet().then(function (Lf) {
			var map = api.map = Lf.map(el).setView([30.0444, 31.2357], 3);
			Lf.tileLayer(TILES, { maxZoom: 19, attribution: ATTR, crossOrigin: true }).addTo(map);
			var pts = [];
			debts.forEach(function (d) {
				if (!Store.located(d)) return;
				var bal = Store.balance(d);
				var m = Lf.marker([d.place.lat, d.place.lng], { icon: pin(Lf, bal > 0 ? '' : 'paid') }).addTo(map);
				m.bindPopup('<b>' + I18n.esc(d.name) + '</b><br>' + (d.place.label ? I18n.esc(d.place.label) + '<br>' : '') +
					(bal > 0 ? I18n.money(bal) : L('مسدَّد', 'Paid off')) + '<br><button type="button" class="link" data-open="' + d.id + '">' + L('افتح', 'Open') + '</button>');
				pts.push([d.place.lat, d.place.lng]);
			});
			map.on('popupopen', function (ev) {
				var b = ev.popup.getElement().querySelector('[data-open]');
				if (b) b.addEventListener('click', function () { onOpen(b.getAttribute('data-open')); });
			});
			if (pts.length === 1) map.setView(pts[0], 16);
			else if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 17 });
			setTimeout(function () { map.invalidateSize(); }, 200);
			/* where you are, if the browser already allows it */
			allowed().then(function (ok) {
				if (!ok) return;
				here({ enableHighAccuracy: false }).then(function (p) {
					Lf.circleMarker([p.lat, p.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#2f6fd0', fillOpacity: 1 }).addTo(map).bindTooltip(L('أنت هنا', 'You are here'));
				}).catch(function () {});
			});
		}).catch(function () { failMap(el); });
		return api;
	}

	function allowed() {
		if (!navigator.permissions || !navigator.permissions.query) return Promise.resolve(false);
		return navigator.permissions.query({ name: 'geolocation' }).then(function (r) { return r.state === 'granted'; }).catch(function () { return false; });
	}

	function nearby(debts, radius) {
		return here({ enableHighAccuracy: false }).then(function (p) {
			return debts.filter(function (d) { return Store.located(d) && Store.balance(d) > 0; })
				.map(function (d) { return { debt: d, m: distance(p, d.place) }; })
				.filter(function (x) { return x.m <= (radius || 200); })
				.sort(function (a, b) { return a.m - b.m; });
		});
	}

	window.Places = { here: here, picker: picker, overview: overview, nearby: nearby, allowed: allowed, distance: distance, fmtDistance: fmtDistance, mapsLink: mapsLink, directionsLink: directionsLink };
})();
