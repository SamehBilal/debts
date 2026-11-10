/* Everything the app knows, kept in this browser (localStorage, key «debts-state»), nowhere else.
   Store.state = { version, settings, debts, meta }:
     settings — lang, theme, currency, budget (a month, for the plan), strategy, order (custom plan order), nearby,
                who (who carries the sack: man, boy or girl)
     debts    — { id, name, kind, amount, apr, minPay, due, note, place, entries, created, updated, closed }
                kind: person | store | card | loan | other;   place: { lat, lng, label } or null
                entries: [{ id, type: 'pay' | 'borrow', amount, date, note }] — the balance is
                amount + borrowed − paid, never below zero
     meta     — peak: the most owed since the last time it all went to zero (the jar's «peak» mark)
   Changes go through the functions below, which save and tell the app (Store.on). Export / import
   as JSON (and CSV out) so it can move to another device. */
(function () {
	'use strict';

	var KEY = 'debts-state', VERSION = 1;
	var listeners = [];

	function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
	function today() { var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
	function money(n) { n = +n; return isFinite(n) ? Math.round(n * 100) / 100 : 0; }

	function blank() {
		return {
			version: VERSION,
			settings: { lang: '', theme: 'auto', currency: '', budget: 0, strategy: 'snowball', order: [], nearby: false, who: 'man' },
			debts: [],
			meta: { peak: 0, created: new Date().toISOString() }
		};
	}

	/* bring any saved or imported shape up to today's, dropping what doesn't fit */
	function clean(raw) {
		var s = blank();
		if (!raw || typeof raw !== 'object') return s;
		var st = raw.settings || {};
		s.settings.lang = st.lang === 'ar' || st.lang === 'en' ? st.lang : '';
		s.settings.theme = ['auto', 'light', 'dark'].indexOf(st.theme) >= 0 ? st.theme : 'auto';
		s.settings.currency = /^[A-Z]{3}$/.test(st.currency || '') ? st.currency : '';
		s.settings.budget = Math.max(0, money(st.budget));
		s.settings.strategy = ['snowball', 'avalanche', 'due', 'custom'].indexOf(st.strategy) >= 0 ? st.strategy : 'snowball';
		s.settings.order = Array.isArray(st.order) ? st.order.filter(function (x) { return typeof x === 'string'; }) : [];
		s.settings.nearby = !!st.nearby;
		s.settings.who = ['man', 'boy', 'girl'].indexOf(st.who) >= 0 ? st.who : 'man';
		s.debts = (Array.isArray(raw.debts) ? raw.debts : []).filter(function (d) { return d && d.name; }).map(cleanDebt);
		s.meta.peak = Math.max(0, money(raw.meta && raw.meta.peak));
		if (raw.meta && raw.meta.created) s.meta.created = raw.meta.created;
		return s;
	}
	function cleanDebt(d) {
		/* a place has coordinates, a name, or both */
		var p = null;
		if (d.place) {
			var ok = d.place.lat != null && d.place.lng != null && d.place.lat !== '' && isFinite(+d.place.lat) && isFinite(+d.place.lng);
			var label = String(d.place.label || '').trim().slice(0, 120);
			if (ok || label) p = { lat: ok ? +d.place.lat : null, lng: ok ? +d.place.lng : null, label: label };
		}
		return {
			id: String(d.id || uid()),
			name: String(d.name).slice(0, 80),
			kind: ['person', 'store', 'card', 'loan', 'other'].indexOf(d.kind) >= 0 ? d.kind : 'other',
			amount: Math.max(0, money(d.amount)),
			apr: Math.max(0, Math.min(200, +d.apr || 0)),
			minPay: Math.max(0, money(d.minPay)),
			due: /^\d{4}-\d{2}-\d{2}$/.test(d.due || '') ? d.due : '',
			note: String(d.note || '').slice(0, 500),
			place: p,
			entries: (Array.isArray(d.entries) ? d.entries : []).filter(function (e) { return e && (e.type === 'pay' || e.type === 'borrow') && +e.amount > 0; }).map(function (e) {
				return { id: String(e.id || uid()), type: e.type, amount: money(e.amount), date: /^\d{4}-\d{2}-\d{2}$/.test(e.date || '') ? e.date : today(), note: String(e.note || '').slice(0, 200) };
			}),
			created: d.created || new Date().toISOString(),
			updated: d.updated || d.created || new Date().toISOString(),
			closed: d.closed || ''
		};
	}

	function load() {
		try { return clean(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { return blank(); }
	}

	var Store = { state: load(), uid: uid, today: today };

	/* ---------- reading ---------- */

	Store.balance = function (d) {
		var b = d.amount;
		d.entries.forEach(function (e) { b += e.type === 'borrow' ? e.amount : -e.amount; });
		return Math.max(0, money(b));
	};
	Store.borrowed = function (d) { return money(d.entries.reduce(function (s, e) { return s + (e.type === 'borrow' ? e.amount : 0); }, d.amount)); };
	Store.paid = function (d) { return money(d.entries.reduce(function (s, e) { return s + (e.type === 'pay' ? e.amount : 0); }, 0)); };
	Store.open = function () { return Store.state.debts.filter(function (d) { return Store.balance(d) > 0; }); };
	Store.done = function () { return Store.state.debts.filter(function (d) { return Store.balance(d) <= 0; }); };
	Store.total = function () { return money(Store.open().reduce(function (s, d) { return s + Store.balance(d); }, 0)); };
	/* a place you can put on a map */
	Store.located = function (d) { return !!(d && d.place && d.place.lat != null && d.place.lng != null); };
	Store.get = function (id) { return Store.state.debts.filter(function (d) { return d.id === id; })[0] || null; };
	/* days until it's due (negative: overdue); null when it has no date or is paid */
	Store.dueIn = function (d) {
		if (!d.due || Store.balance(d) <= 0) return null;
		return Math.round((new Date(d.due + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 864e5);
	};
	Store.overdue = function () { return Store.open().filter(function (d) { var n = Store.dueIn(d); return n != null && n < 0; }); };

	/* ---------- changing ---------- */

	Store.on = function (fn) { listeners.push(fn); };
	function commit(what, detail) {
		var t = Store.total();
		if (t <= 0) Store.state.meta.peak = 0;
		else if (t > Store.state.meta.peak) Store.state.meta.peak = t;
		try { localStorage.setItem(KEY, JSON.stringify(Store.state)); } catch (e) {}
		listeners.forEach(function (fn) { try { fn(what, detail); } catch (e) { console.error(e); } });
	}
	Store.save = function () { commit('settings'); };

	Store.addDebt = function (data) {
		var d = cleanDebt(Object.assign({}, data, { id: uid(), entries: [], created: new Date().toISOString() }));
		Store.state.debts.unshift(d);
		Store.last = { debt: d.id, type: 'new', amount: d.amount };
		commit('add', d);
		return d;
	};
	Store.updateDebt = function (id, data) {
		var d = Store.get(id);
		if (!d) return null;
		var before = Store.balance(d);
		var next = cleanDebt(Object.assign({}, d, data, { id: d.id, entries: d.entries, created: d.created, updated: new Date().toISOString() }));
		Object.assign(d, next);
		syncClosed(d);
		var after = Store.balance(d);
		commit(after > before ? 'borrow' : after < before ? (after <= 0 ? 'paidoff' : 'pay') : 'edit', d);
		return d;
	};
	Store.removeDebt = function (id) {
		var d = Store.get(id);
		Store.state.debts = Store.state.debts.filter(function (x) { return x.id !== id; });
		Store.state.settings.order = Store.state.settings.order.filter(function (x) { return x !== id; });
		commit('remove', d);
	};
	/* a payment or more borrowed; returns what happened: pay | paidoff | borrow */
	Store.addEntry = function (id, type, amount, date, note) {
		var d = Store.get(id);
		amount = money(amount);
		if (!d || !(amount > 0)) return null;
		if (type === 'pay') amount = Math.min(amount, Store.balance(d));
		if (!(amount > 0)) return null;
		var entry = { id: uid(), type: type, amount: amount, date: date || today(), note: String(note || '').slice(0, 200) };
		d.entries.push(entry);
		/* the last entry, so a quick payment can be undone */
		Store.last = { debt: d.id, entry: entry.id, amount: amount, type: type };
		d.entries.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
		d.updated = new Date().toISOString();
		syncClosed(d);
		var what = type === 'borrow' ? 'borrow' : Store.balance(d) <= 0 ? 'paidoff' : 'pay';
		commit(what, d);
		return what;
	};
	Store.removeEntry = function (id, entryId) {
		var d = Store.get(id);
		if (!d) return;
		d.entries = d.entries.filter(function (e) { return e.id !== entryId; });
		syncClosed(d);
		commit('edit', d);
	};
	function syncClosed(d) {
		if (Store.balance(d) <= 0) { if (!d.closed) d.closed = new Date().toISOString(); }
		else d.closed = '';
	}

	/* ---------- export / import ---------- */

	Store.exportJSON = function () {
		return JSON.stringify({ app: 'debts', version: VERSION, exported: new Date().toISOString(), state: Store.state }, null, 2);
	};
	Store.exportCSV = function () {
		var q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
		var rows = [['debt', 'kind', 'type', 'amount', 'date', 'balance_now', 'apr', 'min_payment', 'due', 'place', 'lat', 'lng', 'note']];
		Store.state.debts.forEach(function (d) {
			var p = d.place || {};
			rows.push([d.name, d.kind, 'start', d.amount, d.created.slice(0, 10), Store.balance(d), d.apr, d.minPay, d.due, p.label || '', p.lat || '', p.lng || '', d.note]);
			d.entries.forEach(function (e) { rows.push([d.name, d.kind, e.type, e.amount, e.date, '', '', '', '', '', '', '', e.note]); });
		});
		return '﻿' + rows.map(function (r) { return r.map(q).join(','); }).join('\n');
	};
	/* throws when the text isn't one of ours */
	Store.importJSON = function (text) {
		var raw = JSON.parse(text);
		if (!raw || raw.app !== 'debts' || !raw.state) throw new Error('not a debts export');
		Store.state = clean(raw.state);
		commit('import');
	};
	Store.reset = function () {
		var keep = Store.state.settings;
		Store.state = blank();
		Store.state.settings.lang = keep.lang; Store.state.settings.theme = keep.theme; Store.state.settings.currency = keep.currency; Store.state.settings.who = keep.who;
		commit('import');
	};

	/* ask the browser not to clear this data when space runs low */
	if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(function (p) { if (!p) navigator.storage.persist(); }).catch(function () {});

	/* another tab changed it */
	window.addEventListener('storage', function (ev) {
		if (ev.key !== KEY) return;
		Store.state = load();
		listeners.forEach(function (fn) { try { fn('import'); } catch (e) {} });
	});

	window.Store = Store;
})();
