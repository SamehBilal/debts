/* The app: one page, top to bottom —
     the stage      the man with his sack, and what is still owed on rolling reels
     the composer   «Add debt» or «Pay» (the dock keeps both in reach): who, then how much — tap or hold
                    − and +, drag the number, drag or flick the ruler, or a ready amount — then one tap
     #debts         every debt, each with ready «pay» buttons (undo in the note that follows)
     #plan          how much is paid since the peak (a gauge), the monthly budget, the strategy, the order
     #places        every debt with a place, on a map
     #settings      language, theme, currency, reminders, your data
   One debt opens in a sheet (a <dialog>), and so does the full form. Every change goes through Store,
   which saves and calls back here: the page is drawn again and the man reacts. */
(function () {
	'use strict';

	var S = window.Store, esc = I18n.esc;
	var money = function (n, s) { return I18n.money(n, s); };
	var $ = function (sel, root) { return (root || document).querySelector(sel); };
	var sheet = $('#sheet');

	var KINDS = {
		person: { icon: '👤', ar: 'شخص', en: 'Person' },
		store: { icon: '🏪', ar: 'محل', en: 'Store' },
		card: { icon: '💳', ar: 'بطاقة', en: 'Card' },
		loan: { icon: '🏦', ar: 'قرض', en: 'Loan' },
		other: { icon: '📌', ar: 'أخرى', en: 'Other' }
	};
	var STRATEGIES = {
		snowball: { ar: 'كرة الثلج', en: 'Snowball', why: ['الأصغر أولًا: كل دين يُغلق بسرعة يمنحك دفعة ويحرر قسطه لما بعده.', 'Smallest first: each quick win frees its payment for the next and keeps you going.'] },
		avalanche: { ar: 'الانهيار', en: 'Avalanche', why: ['الأعلى فائدة أولًا: أقل ما يمكن من الفوائد.', 'Highest interest first: the least paid in interest.'] },
		due: { ar: 'المواعيد', en: 'Due dates', why: ['الأقرب موعدًا أولًا، كي لا يتأخر شيء.', 'Nearest due date first, so nothing runs late.'] },
		custom: { ar: 'ترتيبي', en: 'My order', why: ['رتّبها كما تشاء: من يهمك أن تسدّه أولًا (صديق، محل قريب…).', 'Your own order: whoever matters most to pay back first (a friend, the shop next door…).'] }
	};
	var THEMES = { auto: ['◐', 'تلقائي', 'Automatic'], light: ['☀', 'فاتح', 'Light'], dark: ['☾', 'داكن', 'Dark'] };
	var kindName = function (k) { return L(KINDS[k].ar, KINDS[k].en); };
	var round2 = function (n) { return Math.round((+n || 0) * 100) / 100; };

	/* ---------- settings applied to the page ---------- */

	function applySettings() {
		var st = S.state.settings;
		I18n.set(st.lang || I18n.guessLang(), st.currency || I18n.guessCurrency());
		var html = document.documentElement;
		if (st.theme === 'auto') html.removeAttribute('data-theme'); else html.setAttribute('data-theme', st.theme);
		document.title = L('ديوني', 'Debts');
		document.querySelectorAll('[data-t]').forEach(function (n) { var p = n.getAttribute('data-t').split('|'); n.textContent = L(p[0], p[1]); });
		document.querySelectorAll('[data-tl]').forEach(function (n) { var p = n.getAttribute('data-tl').split('|'); n.setAttribute('aria-label', L(p[0], p[1])); n.title = L(p[0], p[1]); });
		var th = THEMES[st.theme] || THEMES.auto, tb = $('#theme');
		tb.textContent = th[0];
		tb.title = tb.ariaLabel = L('المظهر: ', 'Theme: ') + L(th[1], th[2]);
		var mc = $('meta[name="theme-color"]');
		if (mc) mc.setAttribute('content', getComputedStyle(html).getPropertyValue('--bg').trim() || '#f4f8f2');
	}

	/* ---------- the plan and the man's load ---------- */

	function plan() { var st = S.state.settings; return Plan.run(S.open(), st.budget, st.strategy, st.order); }
	function level(p) {
		if (S.total() <= 0) return 0;
		var lv = 2;
		if (p.ok && p.months) lv = p.months <= 2 ? 1 : p.months <= 8 ? 2 : p.months <= 24 ? 3 : 4;
		else if (p.reason === 'toolow') lv = 4;
		if (S.overdue().length) lv = Math.min(4, lv + 1);
		return lv;
	}
	function monthOf(m) { var d = new Date(); return new Date(d.getFullYear(), d.getMonth() + m, 1); }

	var owed = Fx.roller($('#owed'), I18n.moneyParts, { label: money });
	function drawTop() {
		var p = plan(), total = S.total(), st = S.state.settings;
		owed.set(total);
		$('#owed-sub').innerHTML = total <= 0 ? (S.state.debts.length ? L('لا شيء عليك 🎉', 'You owe nothing 🎉') : L('سجّل أول دين بالزر «أضف دينًا»', 'Add your first debt with «Add debt»'))
			: p.ok && p.months ? L('حر في ', 'Debt-free by ') + '<b>' + esc(I18n.month(p.end)) + '</b>' + (st.budget ? ' · ' + money(st.budget) + L(' شهريًا', '/mo') : '')
			: p.reason === 'toolow' ? '<a href="#plan">' + L('الميزانية لا تكفي', 'Budget too small') + '</a>'
			: '<a href="#plan">' + L('حدد ميزانية شهرية لترى متى تتحرر', 'Set a monthly budget to see when you’re free') + '</a>';
		var pieces = S.open().filter(function (d) { return S.balance(d) > 0; }).map(function (d) {
			var n = S.dueIn(d), bal = S.balance(d);
			return { id: d.id, value: bal, icon: KINDS[d.kind].icon, tone: n != null && n < 0 ? 'late' : n != null && n <= 3 ? 'soon' : 'ok', label: d.name + ' · ' + money(bal) };
		});
		Jar.update({ total: total, peak: S.state.meta.peak || total, level: level(p), money: money, pieces: pieces });
		drawScenes(p);
		if (peekId) { if (S.get(peekId) && S.balance(S.get(peekId)) > 0) showPeek(peekId, peekPinned); else hidePeek(); }
	}

	/* ---------- ready-made scenarios, floating over the man ---------- */

	function drawScenes(p) {
		var open = S.open().filter(function (d) { return S.balance(d) > 0; }), out = [];
		var short = function (s) { return s.length > 14 ? s.slice(0, 13) + '…' : s; };
		if (!open.length) {
			[['person', L('استلفت من صاحبي', 'I borrowed from a friend')], ['store', L('على الحساب في محل', 'On tab at a shop')], ['card', L('دفعت بالبطاقة', 'Put it on my card')]].forEach(function (s) {
				out.push('<button type="button" class="scene go-add" data-scene-kind="' + s[0] + '"><span aria-hidden="true">' + KINDS[s[0]].icon + '</span> ' + s[1] + '</button>');
			});
		} else {
			var late = S.overdue().filter(function (d) { return S.balance(d) > 0; })[0];
			if (late) out.push('<button type="button" class="scene late" data-compose="pay" data-id="' + late.id + '"><span aria-hidden="true">⚠</span> ' + L('سدّد المتأخر: ', 'Pay what’s late: ') + esc(short(late.name)) + '</button>');
			var next = p.debts.filter(function (x) { return x.now > 0; })[0], nd = next && S.get(next.id);
			if (nd) out.push('<button type="button" class="scene go-pay" data-quick="' + nd.id + '" data-amt="' + next.now + '"><span aria-hidden="true">▶</span> ' + L('قسط الشهر: ', 'This month: ') + esc(short(nd.name)) + ' · ' + money(next.now) + '</button>');
			var small = open.slice().sort(function (a, b) { return S.balance(a) - S.balance(b); })[0];
			if (open.length > 1 && small && (!nd || small.id !== nd.id || next.now < S.balance(small)))
				out.push('<button type="button" class="scene" data-quick="' + small.id + '" data-amt="' + S.balance(small) + '"><span aria-hidden="true">🎯</span> ' + L('اقفل الأصغر: ', 'Close the smallest: ') + esc(short(small.name)) + ' · ' + money(S.balance(small)) + '</button>');
			if (!S.state.settings.budget) out.push('<a class="scene ghost" href="#plan"><span aria-hidden="true">📅</span> ' + L('حدد ميزانية شهرية', 'Set a monthly budget') + '</a>');
		}
		$('#scenes').innerHTML = out.join('');
	}

	/* ---------- one coin's details ---------- */

	var peek = $('#peek'), peekId = '', peekPinned = false, peekT = 0;
	var wide = matchMedia('(min-width: 720px) and (hover: hover)');
	/* a small map without loading one: the OpenStreetMap tiles around the place, the pin in the middle */
	function tileMap(pl) {
		var z = 16, n = Math.pow(2, z), lat = pl.lat * Math.PI / 180;
		var fx = (pl.lng + 180) / 360 * n, fy = (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2 * n;
		var tx = Math.floor(fx), ty = Math.floor(fy), html = '';
		for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++)
			html += '<img alt="" loading="lazy" src="https://tile.openstreetmap.org/' + z + '/' + (tx + dx) + '/' + (ty + dy) + '.png" style="left:' + ((dx + 1) * 256) + 'px;top:' + ((dy + 1) * 256) + 'px">';
		var ox = -((fx - tx + 1) * 256), oy = -((fy - ty + 1) * 256);
		return '<a class="tile-map" target="_blank" rel="noopener" href="' + Places.mapsLink(pl) + '" aria-label="' + L('افتح في الخريطة', 'Open in maps') + '">' +
			'<span class="tiles" style="transform:translate(' + ox.toFixed(0) + 'px,' + oy.toFixed(0) + 'px)">' + html + '</span><span class="tile-pin" aria-hidden="true">📍</span><small>© OpenStreetMap</small></a>';
	}
	function peekHtml(d) {
		var p = plan(), bal = S.balance(d), mine = p.debts.filter(function (x) { return x.id === d.id; })[0];
		var html = '<div class="peek-head"><span class="kind" aria-hidden="true">' + KINDS[d.kind].icon + '</span><b>' + esc(d.name) + '</b>' +
			'<button type="button" class="icon-btn small" data-peek-shut aria-label="' + L('إغلاق', 'Close') + '">×</button></div>';
		html += '<div class="peek-bal"><b>' + money(bal) + '</b><small>' + L('من ', 'of ') + money(S.borrowed(d)) + '</small></div>' + progress(d);
		var facts = [kindName(d.kind)];
		if (d.due) facts.push(L('الموعد ', 'Due ') + I18n.date(d.due) + ' ' + dueChip(d));
		if (mine && mine.month != null && p.ok) facts.push(L('يُسدَّد ', 'Clear by ') + I18n.month(monthOf(mine.month)));
		html += '<p class="peek-facts">' + facts.join(' · ') + '</p>';
		if (d.place) {
			html += '<div class="peek-place"><span>📍 ' + esc(d.place.label || L('مكان محفوظ', 'Saved place')) + '</span>';
			if (S.located(d)) html += tileMap(d.place) + '<a class="btn btn-ghost btn-small" target="_blank" rel="noopener" href="' + Places.directionsLink(d.place) + '">' + L('الاتجاهات', 'Directions') + '</a>';
			html += '</div>';
		}
		html += quickButtons(d, p) + '<div class="btn-row"><button type="button" class="btn btn-ghost btn-small" data-edit="' + d.id + '">✎ ' + L('تعديل', 'Edit') + '</button>' +
			'<button type="button" class="btn btn-ghost btn-small" data-detail="' + d.id + '">' + L('التفاصيل والسجل', 'Details & history') + '</button></div>';
		return html;
	}
	function placePeek(el) {
		peek.classList.toggle('floating', wide.matches);
		if (!wide.matches || !el) { peek.style.left = peek.style.top = ''; return; }
		var st = peek.parentNode.getBoundingClientRect(), r = el.getBoundingClientRect(), w = peek.offsetWidth, h = peek.offsetHeight;
		var right = r.right + 14 + w <= st.right - 8, left = r.left - 14 - w >= st.left + 8;
		var x = right && (I18n.lang !== 'ar' || !left) ? r.right + 14 : left ? r.left - 14 - w : Math.max(st.left + 8, r.left + r.width / 2 - w / 2);
		var y = right || left ? r.top + r.height / 2 - h / 2 : r.bottom + 10;
		y = Math.max(st.top + 8, Math.min(y, st.bottom - h - 8));
		peek.style.left = (x - st.left).toFixed(0) + 'px';
		peek.style.top = (y - st.top).toFixed(0) + 'px';
	}
	function showPeek(id, pinned) {
		var d = S.get(id);
		if (!d) return;
		clearTimeout(peekT);
		var same = peekId === id && !peek.hidden;
		peekId = id; peekPinned = !!pinned;
		peek.innerHTML = peekHtml(d);
		peek.setAttribute('aria-label', d.name);
		peek.hidden = false;
		peek.classList.toggle('pinned', peekPinned);
		document.querySelectorAll('.piece.on').forEach(function (n) { n.classList.remove('on'); });
		var el = Jar.pieceAt(id);
		if (el) el.classList.add('on');
		placePeek(el);
		if (!same && !wide.matches) peek.classList.remove('rise'), void peek.offsetWidth, peek.classList.add('rise');
	}
	function hidePeek() {
		clearTimeout(peekT);
		peek.hidden = true; peekId = ''; peekPinned = false;
		document.querySelectorAll('.piece.on').forEach(function (n) { n.classList.remove('on'); });
	}
	function laterHide() { clearTimeout(peekT); peekT = setTimeout(function () { if (!peekPinned) hidePeek(); }, 280); }
	Jar.onPiece(function (id, el, how) {
		if (how === 'hover') { if (!peekPinned || peekId === id) showPeek(id, peekPinned && peekId === id); }
		else if (how === 'leave') { if (!peekPinned) laterHide(); }
		else if (peekId === id && peekPinned) hidePeek();
		else { showPeek(id, true); var f = peek.querySelector('.quick button, [data-edit]'); if (f && !wide.matches) f.focus({ preventScroll: true }); }
	});
	peek.addEventListener('pointerenter', function () { clearTimeout(peekT); });
	peek.addEventListener('pointerleave', function (ev) { if (ev.pointerType === 'mouse' && !peekPinned) laterHide(); });
	peek.addEventListener('click', function (ev) { if (ev.target.closest('[data-peek-shut], [data-detail], [data-edit], [data-compose]')) hidePeek(); else if (!peekPinned) { peekPinned = true; peek.classList.add('pinned'); } });
	document.addEventListener('pointerdown', function (ev) { if (!peek.hidden && !peek.contains(ev.target) && !ev.target.closest('.piece')) hidePeek(); });
	document.addEventListener('keydown', function (ev) {
		if (ev.key !== 'Escape' || peek.hidden) return;
		var back = Jar.pieceAt(peekId);
		hidePeek();
		if (back) back.focus();
	});
	window.addEventListener('resize', function () { if (!peek.hidden) placePeek(Jar.pieceAt(peekId)); });

	/* ---------- bits ---------- */

	function dueChip(d) {
		var n = S.dueIn(d);
		if (n == null) return '';
		var cls = n < 0 ? 'late' : n <= 3 ? 'soon' : '';
		var t = n < 0 ? L('متأخر ' + I18n.num(-n) + ' يوم', (-n) + ' day' + (n === -1 ? '' : 's') + ' late')
			: n === 0 ? L('اليوم', 'Due today') : n === 1 ? L('غدًا', 'Due tomorrow')
			: n <= 30 ? L('بعد ' + I18n.num(n) + ' يوم', 'In ' + n + ' days') : I18n.date(d.due);
		return '<span class="chip ' + cls + '">' + esc(t) + '</span>';
	}
	function progress(d) {
		var b = S.borrowed(d), f = b > 0 ? Math.min(1, S.paid(d) / b) : 0;
		return '<span class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(f * 100) + '"><span style="width:' + (f * 100).toFixed(1) + '%"></span></span>';
	}
	/* a round amount that suits a balance: 10 on 150, 50 on 1,200, 500 on 9,000 */
	function niceStep(b) {
		var p = Math.pow(10, Math.floor(Math.log10(Math.max(1, b / 8))));
		var m = b / 8 / p;
		return p * (m >= 5 ? 5 : m >= 2 ? 2 : 1);
	}
	function empty(icon, title, text, action) {
		return '<div class="empty"><div class="empty-icon" aria-hidden="true">' + icon + '</div><h3>' + title + '</h3><p>' + text + '</p>' + (action || '') + '</div>';
	}

	/* ---------- the composer ---------- */

	var C = { mode: 'pay', target: '', amount: 0, step: 1, name: '', kind: 'store', place: null, open: false };
	var composer = $('#composer');
	var amount = Fx.roller($('#amount'), I18n.moneyParts, { label: money });
	var ruler = Fx.ruler($('#ruler'), {
		step: function () { return C.step; },
		onChange: function (v) { setAmount(v, 'ruler'); },
		onUse: function () { used('drag'); }
	});
	var minus = $('.step.minus', composer), plus = $('.step.plus', composer);
	Fx.hold(minus, function (n) { setAmount(C.amount - n * C.step); });
	Fx.hold(plus, function (n) { setAmount(C.amount + n * C.step); });
	Fx.dial($('#amount'), function () { return C.amount; }, function (v) { setAmount(v); }, function () { return C.step; }, typeIn);

	/* the hints fade after their first real use, and stay gone */
	function used(what) {
		try { localStorage.setItem('debts-hint-' + what, '1'); } catch (e) {}
		var h = $('.h-' + what); if (h) h.classList.add('gone');
	}
	try { if (localStorage.getItem('debts-hint-drag')) $('.h-drag').classList.add('gone'); } catch (e) {}

	function target() { return C.target ? S.get(C.target) : null; }
	function maxAmount() { var d = target(); return C.mode === 'pay' ? (d ? S.balance(d) : 0) : 10000000; }
	function setAmount(v, from) {
		var max = maxAmount();
		v = Math.max(0, Math.min(max, round2(v)));
		C.amount = v;
		amount.set(v);
		if (from !== 'ruler') ruler.set(v);
		minus.disabled = v <= 0;
		plus.disabled = v >= max;
		drawConfirm();
	}
	function typeIn() {
		var inp = $('#type-in'), val = $('#amount');
		inp.value = C.amount || '';
		inp.hidden = false; val.hidden = true;
		inp.focus(); inp.select();
		function done() {
			inp.removeEventListener('blur', done);
			inp.hidden = true; val.hidden = false;
			if (inp.value !== '') setAmount(+inp.value);
		}
		inp.addEventListener('blur', done);
		inp.onkeydown = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); inp.blur(); } else if (ev.key === 'Escape') { inp.value = ''; inp.blur(); } };
	}

	function openComposer(mode, id, amt) {
		var p = plan(), open = S.open();
		C.mode = mode;
		if (mode === 'pay') {
			var next = p.debts.filter(function (x) { return x.now > 0; })[0];
			C.target = id && S.get(id) && S.balance(S.get(id)) > 0 ? id : next ? next.id : open[0] ? open[0].id : '';
		} else C.target = id && S.get(id) ? id : '';
		if (!id) { C.name = ''; C.place = null; }
		C.open = true;
		composer.hidden = false;
		var d = target();
		C.step = mode === 'pay' && d ? Math.max(1, Math.min(100, niceStep(S.balance(d)) / 5)) : 1;
		drawComposer(true);
		if (amt == null) {
			var mine = d && p.debts.filter(function (x) { return x.id === d.id; })[0];
			amt = mode === 'pay' ? (mine && mine.now > 0 ? mine.now : 0) : 0;
		}
		ruler.set(0, true);
		setAmount(amt);
		requestAnimationFrame(function () { composer.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }); });
	}
	function closeComposer() { C.open = false; composer.hidden = true; }

	function drawComposer(full) {
		if (!C.open) return;
		var d = target(), open = S.open();
		composer.className = 'composer card is-' + C.mode;
		composer.querySelectorAll('[data-mode]').forEach(function (b) { b.setAttribute('aria-checked', b.getAttribute('data-mode') === C.mode); });
		$('#composer-title').textContent = C.mode === 'pay' ? L('دفعة', 'A payment') : L('دين جديد', 'A new debt');
		/* who */
		var who = '';
		if (C.mode === 'pay') {
			if (!open.length) who = '<p class="hint">' + L('لا شيء عليك لتدفعه.', 'There is nothing to pay.') + '</p>';
			else who = '<span class="who-cap">' + L('إلى', 'To') + '</span>' + open.map(function (x) {
				return '<button type="button" class="pick" aria-pressed="' + (x.id === C.target) + '" data-target="' + x.id + '"><span aria-hidden="true">' + KINDS[x.kind].icon + '</span> ' + esc(x.name) + ' <small>' + money(S.balance(x)) + '</small></button>';
			}).join('');
		} else {
			who = '<span class="who-cap">' + L('لـ', 'To') + '</span><button type="button" class="pick" aria-pressed="' + (!C.target) + '" data-target="">＋ ' + L('جديد', 'Someone new') + '</button>' +
				S.state.debts.map(function (x) {
					return '<button type="button" class="pick" aria-pressed="' + (x.id === C.target) + '" data-target="' + x.id + '"><span aria-hidden="true">' + KINDS[x.kind].icon + '</span> ' + esc(x.name) + '</button>';
				}).join('');
		}
		$('#who').innerHTML = who;
		/* a new name, its kind and place — only drawn again when they appear, so typing isn't lost */
		var nf = $('#new-fields'), wantNew = C.mode === 'add' && !C.target;
		if (full || nf.hidden === wantNew) {
			nf.hidden = !wantNew;
			nf.innerHTML = wantNew ? '<input id="new-name" maxlength="80" value="' + esc(C.name) + '" placeholder="' + L('لمن؟ مثلًا: بقالة عم سيد', 'Who? e.g. Corner shop') + '" aria-label="' + L('لمن؟', 'Who?') + '">' +
				'<div class="kinds">' + Object.keys(KINDS).map(function (k) {
					return '<button type="button" class="kind-pick" aria-pressed="' + (C.kind === k) + '" data-kind="' + k + '" title="' + kindName(k) + '"><span aria-hidden="true">' + KINDS[k].icon + '</span><small>' + kindName(k) + '</small></button>';
				}).join('') + '</div>' +
				'<div class="place-row"><button type="button" class="btn btn-ghost btn-small" data-here aria-pressed="' + !!C.place + '">📍 ' + (C.place ? L('المكان محفوظ', 'Place saved') : L('هنا', 'I’m here')) + '</button>' +
				'<button type="button" class="btn btn-ghost btn-small" data-more>' + L('تفاصيل أكثر…', 'More details…') + '</button></div>' : '';
		}
		/* ready amounts */
		var ready = '';
		if (C.mode === 'pay' && d) {
			var b = S.balance(d), mine = plan().debts.filter(function (x) { return x.id === d.id; })[0];
			if (mine && mine.now > 0 && mine.now < b) ready += '<button type="button" class="chip-btn" data-set="' + mine.now + '">' + L('قسط الشهر', 'This month') + ' · ' + money(mine.now) + '</button>';
			if (b >= 4) ready += '<button type="button" class="chip-btn" data-set="' + round2(b / 4) + '">¼</button><button type="button" class="chip-btn" data-set="' + round2(b / 2) + '">½</button>';
			ready += '<button type="button" class="chip-btn all" data-set="' + b + '">' + L('الكل', 'All') + ' · ' + money(b) + '</button>';
		} else if (C.mode === 'add') {
			[1, 5, 10, 50, 100, 500].forEach(function (n) { ready += '<button type="button" class="chip-btn" data-plus="' + n + '">+' + money(n, true) + '</button>'; });
		}
		if (C.amount > 0) ready += '<button type="button" class="chip-btn ghost" data-set="0">' + L('صفر', 'Clear') + '</button>';
		$('#ready').innerHTML = ready;
		$('#steps').innerHTML = '<span>' + L('الخطوة', 'Step') + '</span>' + [0.25, 1, 5, 10, 50, 100].map(function (n) {
			return '<button type="button" aria-pressed="' + (C.step === n) + '" data-step="' + n + '">' + I18n.num(n) + '</button>';
		}).join('');
		ruler.limits(0, maxAmount());
		drawConfirm();
	}
	function drawConfirm() {
		var d = target(), b = $('#confirm'), a = money(C.amount), name = C.mode === 'add' && !d ? (($('#new-name') || {}).value || C.name).trim() : d ? d.name : '';
		b.className = 'btn big confirm ' + (C.mode === 'pay' ? 'go-pay' : 'go-add');
		b.textContent = C.mode === 'pay' ? (d ? L('ادفع ' + a + ' إلى ' + name, 'Pay ' + a + ' to ' + name) : L('ادفع', 'Pay'))
			: d ? L('اقترضت ' + a + ' أخرى من ' + name, 'Borrowed ' + a + ' more from ' + name)
			: name ? L('أضف دينًا بـ ' + a + ' لـ ' + name, 'Add ' + a + ' owed to ' + name) : L('اكتب لمن الدين', 'Type who it’s owed to');
		b.disabled = !(C.amount > 0) || (C.mode === 'pay' && !d) || (C.mode === 'add' && !d && !name);
	}
	function confirm() {
		var d = target(), a = C.amount;
		if (!(a > 0)) return;
		if (C.mode === 'pay' && d) S.addEntry(d.id, 'pay', a);
		else if (C.mode === 'add' && d) S.addEntry(d.id, 'borrow', a);
		else {
			var name = ($('#new-name') || {}).value.trim();
			if (!name) return;
			S.addDebt({ name: name, kind: C.kind, amount: a, place: C.place });
		}
		var last = S.last;
		closeComposer();
		window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
		undoNote(last);
	}
	/* «paid 50 to Ahmed · Undo» */
	function undoNote(last) {
		if (!last) return;
		var d = S.get(last.debt);
		if (!d) return;
		var msg = last.type === 'pay' ? L('دفعت ', 'Paid ') + money(last.amount) + L(' إلى ', ' to ') + d.name
			: last.type === 'borrow' ? L('أضفت ', 'Added ') + money(last.amount) + L(' على ', ' to ') + d.name
			: L('أُضيف ', 'Added ') + d.name + ' · ' + money(last.amount);
		Notify(msg, { type: 'success', ttl: 6000, actions: [{ label: L('تراجع', 'Undo'), run: function () {
			if (last.type === 'new') S.removeDebt(last.debt); else S.removeEntry(last.debt, last.entry);
		} }] });
	}

	composer.addEventListener('input', function (ev) { if (ev.target.id === 'new-name') { C.name = ev.target.value; drawConfirm(); } });
	composer.addEventListener('click', function (ev) {
		var b = ev.target.closest('button');
		if (!b || !composer.contains(b)) return;
		if (b.hasAttribute('data-mode')) openComposer(b.getAttribute('data-mode'), C.mode === 'pay' ? '' : C.target);
		else if (b.hasAttribute('data-target')) {
			C.target = b.getAttribute('data-target');
			var d = target();
			if (C.mode === 'pay' && d) C.step = Math.max(1, Math.min(100, niceStep(S.balance(d)) / 5));
			drawComposer(true); setAmount(C.amount);
		}
		else if (b.hasAttribute('data-kind')) { C.kind = b.getAttribute('data-kind'); composer.querySelectorAll('[data-kind]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); }
		else if (b.hasAttribute('data-set')) setAmount(+b.getAttribute('data-set'));
		else if (b.hasAttribute('data-plus')) setAmount(C.amount + +b.getAttribute('data-plus'));
		else if (b.hasAttribute('data-step')) { C.step = +b.getAttribute('data-step'); drawComposer(); ruler.repaint(); }
		else if (b.hasAttribute('data-more')) { C.name = ($('#new-name') || {}).value || C.name; debtForm(null, { name: C.name, kind: C.kind, amount: C.amount, place: C.place }); }
		else if (b.hasAttribute('data-here')) {
			if (C.place) { C.place = null; drawComposer(true); return; }
			b.disabled = true; b.textContent = '📍 ' + L('جارٍ…', 'Finding…');
			Places.here().then(function (p) { C.place = { lat: p.lat, lng: p.lng, label: '' }; C.name = ($('#new-name') || {}).value || C.name; drawComposer(true); })
				.catch(function () { Notify(L('تعذّر تحديد موقعك.', 'Couldn’t find your location.'), { type: 'warning' }); C.name = ($('#new-name') || {}).value || C.name; drawComposer(true); });
		}
		else if (b.id === 'confirm') confirm();
		else if (b.hasAttribute('data-shut')) closeComposer();
	});
	composer.insertAdjacentHTML('afterbegin', '<button type="button" class="icon-btn shut" data-shut data-tl="إغلاق|Close" aria-label="Close">×</button>');

	/* ---------- the debts ---------- */

	var sortBy = 'plan';
	function quickButtons(d, p) {
		var b = S.balance(d);
		if (b <= 0) return '';
		var mine = p.debts.filter(function (x) { return x.id === d.id; })[0], out = '';
		var step = niceStep(b);
		if (mine && mine.now > 0 && mine.now < b) out += '<button type="button" class="chip-btn" data-quick="' + d.id + '" data-amt="' + mine.now + '">' + L('قسط الشهر ', 'This month ') + money(mine.now) + '</button>';
		if (b > step * 1.5) out += '<button type="button" class="chip-btn" data-quick="' + d.id + '" data-amt="' + step + '">−' + money(step) + '</button>';
		out += '<button type="button" class="chip-btn all" data-quick="' + d.id + '" data-amt="' + b + '">' + L('ادفع الكل', 'Pay all') + '</button>';
		out += '<button type="button" class="chip-btn ghost" data-compose="pay" data-id="' + d.id + '">' + L('مبلغ آخر…', 'Other…') + '</button>';
		return '<div class="quick">' + out + '</div>';
	}
	function debtCard(d, p, extra) {
		var bal = S.balance(d);
		return '<article class="card debt' + (bal > 0 ? '' : ' is-paid') + '">' +
			'<button type="button" class="debt-open" data-detail="' + d.id + '">' +
				'<span class="kind" aria-hidden="true">' + KINDS[d.kind].icon + '</span>' +
				'<span class="debt-main"><b class="debt-name">' + esc(d.name) + '</b>' +
					'<span class="debt-sub">' + (d.place && d.place.label ? '📍 ' + esc(d.place.label) : S.located(d) ? '📍 ' + L('مكان محفوظ', 'Saved place') : kindName(d.kind)) + ' ' + dueChip(d) + (extra || '') + '</span>' +
					progress(d) + '</span>' +
				'<span class="debt-amt">' + (bal > 0 ? money(bal) : '<span class="chip ok">' + L('مسدَّد', 'Paid') + '</span>') + '</span>' +
			'</button>' + quickButtons(d, p) + '</article>';
	}
	function drawDebts() {
		var el = $('#debts'), open = S.open(), done = S.done(), p = plan();
		var html = '<div class="row-head"><h2 id="debts-h">' + L('ديونك', 'Your debts') + (open.length ? ' <span class="count">' + I18n.num(open.length) + '</span>' : '') + '</h2>' +
			(open.length > 1 ? '<label class="sort"><span class="sr">' + L('رتّب', 'Sort') + '</span><select data-sort>' +
				[['plan', L('ترتيب الخطة', 'Plan order')], ['big', L('الأكبر أولًا', 'Largest first')], ['due', L('الموعد', 'Due date')], ['new', L('الأحدث', 'Newest')]]
					.map(function (o) { return '<option value="' + o[0] + '"' + (sortBy === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' : '') + '</div><div id="near"></div>';
		if (!S.state.debts.length) {
			html += empty('🫙', L('الكيس فارغ', 'The sack is empty'),
				L('سجّل أي دين: لصديق، أو باقي فكة عند البقال، أو قسط بطاقة. يبقى كل شيء على هذا الجهاز.', 'Add any debt: a friend, the change you owe the corner shop, a card. Everything stays on this device.'),
				'<button type="button" class="btn go-add" data-compose="add">＋ ' + L('أضف أول دين', 'Add your first debt') + '</button>');
		} else if (!open.length) {
			html += empty('🎉', L('لا ديون مفتوحة', 'Nothing owed'), L('كل ما سجّلته مسدَّد. أحسنت!', 'Everything you added is paid off. Well done!'));
		} else {
			var rank = {};
			p.debts.forEach(function (x) { rank[x.id] = x.rank; });
			var list = open.slice();
			if (sortBy === 'plan') list.sort(function (a, b) { return (rank[a.id] || 99) - (rank[b.id] || 99); });
			else if (sortBy === 'big') list.sort(function (a, b) { return S.balance(b) - S.balance(a); });
			else if (sortBy === 'due') list.sort(function (a, b) { return (a.due || '9999') < (b.due || '9999') ? -1 : 1; });
			else list.sort(function (a, b) { return a.created < b.created ? 1 : -1; });
			html += '<div class="list">' + list.map(function (d) { return debtCard(d, p); }).join('') + '</div>';
		}
		if (done.length) html += '<details class="done"><summary>' + L('مسدَّدة', 'Paid off') + ' <span class="count">' + I18n.num(done.length) + '</span></summary><div class="list">' + done.map(function (d) { return debtCard(d, p); }).join('') + '</div></details>';
		el.innerHTML = html;
		drawNear();
	}

	/* ---------- the plan ---------- */

	var planBuilt = false, gauge = null, budgetRoller = null, budgetRuler = null, saveT = 0;
	function buildPlan() {
		var el = $('#plan');
		el.innerHTML = '<h2 id="plan-h">' + L('خطة السداد', 'Payoff plan') + '</h2>' +
			'<div class="card gauge-card"><div id="gauge"></div><div class="gauge-side"><span class="cap">' + L('سددت منذ الذروة', 'Paid since the peak') + '</span><b id="paid-since"></b><small id="peak-was"></small></div></div>' +
			'<div class="card budget"><span class="cap">' + L('كم تستطيع أن تدفع للديون كل شهر؟', 'How much can you put toward debts each month?') + '</span>' +
				'<div class="budget-num" id="budget-num"></div><div id="budget-ruler"></div>' +
				'<p class="hint" id="mins"></p>' +
				'<div class="seg strategies" role="radiogroup" aria-label="' + L('الطريقة', 'Strategy') + '">' + Object.keys(STRATEGIES).map(function (k) {
					return '<button type="button" role="radio" data-strategy="' + k + '">' + L(STRATEGIES[k].ar, STRATEGIES[k].en) + '</button>';
				}).join('') + '</div><p class="hint" id="why"></p></div>' +
			'<div id="plan-body"></div>';
		gauge = Fx.gauge($('#gauge'));
		budgetRoller = Fx.roller($('#budget-num'), I18n.moneyParts, { label: money });
		budgetRuler = Fx.ruler($('#budget-ruler'), {
			step: function () { return budgetStep(); },
			onChange: function (v) {
				var st = S.state.settings;
				if (v === st.budget) return;
				st.budget = v;
				budgetRoller.set(v);
				/* the plan follows the ruler live; it is saved when the hand stops */
				drawPlanBody(); drawTop();
				clearTimeout(saveT); saveT = setTimeout(function () { S.save(); }, 400);
			}
		});
		budgetRuler.limits(0, 1000000);
		budgetRuler.set(S.state.settings.budget, true);
		budgetRoller.set(S.state.settings.budget, true);
		planBuilt = true;
	}
	function budgetStep() {
		var t = S.total() || 1000;
		return t > 50000 ? 500 : t > 5000 ? 50 : t > 500 ? 10 : 5;
	}
	function drawPlan() {
		if (!planBuilt) buildPlan();
		var st = S.state.settings, total = S.total(), peak = S.state.meta.peak || total;
		var f = peak > 0 ? (peak - total) / peak : S.state.debts.length ? 1 : 0;
		gauge.set(f, '');
		$('#paid-since').textContent = money(Math.max(0, peak - total));
		$('#peak-was').textContent = peak > 0 ? L('الذروة ', 'Peak ') + money(peak) : '';
		$('#plan').querySelectorAll('[data-strategy]').forEach(function (b) { b.setAttribute('aria-checked', b.getAttribute('data-strategy') === st.strategy); });
		$('#why').textContent = L(STRATEGIES[st.strategy].why[0], STRATEGIES[st.strategy].why[1]);
		budgetRoller.set(st.budget);
		budgetRuler.set(st.budget);
		budgetRuler.repaint();
		drawPlanBody();
	}
	function drawPlanBody() {
		var st = S.state.settings, open = S.open(), p = plan(), html = '';
		$('#mins').innerHTML = p.mins > 0 ? L('مجموع الأقساط الدنيا: ', 'Minimum payments add up to ') + money(p.mins) + (st.budget && st.budget < p.mins ? ' — <b class="warn">' + L('ميزانيتك أقل منها', 'more than your budget') + '</b>' : '') : '';
		if (!open.length) html = empty('🎉', L('لا شيء لتخطط له', 'Nothing to plan'), L('لا ديون مفتوحة الآن.', 'No open debts right now.'));
		else if (p.reason === 'nobudget') html = empty('🧮', L('ابدأ بالميزانية', 'Start with a budget'), L('اسحب المسطرة إلى ما تستطيع دفعه شهريًا لنرى متى تتحرر.', 'Drag the ruler to what you can pay each month to see when you’ll be free.'));
		else {
			if (p.reason === 'toolow') html += '<div class="card alert">' + L('بهذه الميزانية لا ينقص الدين (الفوائد أكبر مما تدفع). زِد الميزانية أو قلّل الفائدة.', 'With this budget the debt never shrinks (the interest outruns the payments). Raise the budget or lower the interest.') + '</div>';
			else {
				html += '<div class="card free-by"><span>' + L('تتحرر من الديون في', 'Debt-free by') + '</span><b>' + esc(I18n.month(p.end)) + '</b><small>' +
					L('خلال ', 'in ') + I18n.span(p.months) + (p.interest > 0 ? ' · ' + L('فوائد ', 'interest ') + money(p.interest) : '') + '</small>' + chart(p) + '</div>';
				var cmp = Plan.compare(open, st.budget, st.order), notes = [];
				Object.keys(cmp).forEach(function (k) {
					var c = cmp[k];
					if (k === st.strategy || !c.ok || k === 'custom') return;
					var dm = p.months - c.months, di = p.interest - c.interest;
					if (dm > 0 || di > 1) notes.push('<li><b>' + L(STRATEGIES[k].ar, STRATEGIES[k].en) + '</b>: ' + (dm > 0 ? L('أسرع بـ', 'done ') + I18n.span(dm) + L('', ' sooner') : '') + (dm > 0 && di > 1 ? ' · ' : '') + (di > 1 ? L('توفّر ', 'saves ') + money(di) + L(' فوائد', ' in interest') : '') + '</li>');
				});
				if (notes.length) html += '<div class="card"><h3>' + L('طرق أخرى', 'Other ways') + '</h3><ul class="cmp">' + notes.join('') + '</ul></div>';
			}
			html += '<h3>' + L('الترتيب', 'The order') + '</h3><ol class="plan-list">' + p.debts.map(function (x, i) {
				var d = S.get(x.id);
				var when = x.month != null && p.ok ? I18n.month(monthOf(x.month)) : '—';
				return '<li class="card"><span class="rank">' + I18n.num(x.rank) + '</span><span class="plan-main"><button type="button" class="link" data-detail="' + x.id + '"><b>' + esc(x.name) + '</b></button>' +
					'<small>' + money(S.balance(d)) + ' · ' + L('يُغلق ', 'gone by ') + esc(when) + '</small>' +
					(x.now > 0 ? '<small class="now">' + L('هذا الشهر: ', 'This month: ') + money(x.now) + '</small>' : '') + '</span>' +
					(st.strategy === 'custom' ? '<span class="move"><button type="button" class="icon-btn small" data-up="' + i + '" aria-label="' + L('لأعلى', 'Up') + '"' + (i ? '' : ' disabled') + '>↑</button><button type="button" class="icon-btn small" data-down="' + i + '" aria-label="' + L('لأسفل', 'Down') + '"' + (i < p.debts.length - 1 ? '' : ' disabled') + '>↓</button></span>' : '') +
					(x.now > 0 ? '<button type="button" class="chip-btn" data-quick="' + x.id + '" data-amt="' + x.now + '">' + L('ادفع ', 'Pay ') + money(x.now) + '</button>' : '') + '</li>';
			}).join('') + '</ol>';
		}
		$('#plan-body').innerHTML = html;
	}
	function chart(p) {
		var c = p.curve, n = c.length - 1;
		if (n < 1) return '';
		var W = 320, H = 110, max = c[0] || 1;
		var x = function (i) { return (I18n.lang === 'ar' ? W - (i / n) * W : (i / n) * W).toFixed(1); };
		var y = function (v) { return (H - (v / max) * (H - 8)).toFixed(1); };
		var pts = c.map(function (v, i) { return x(i) + ',' + y(v); }).join(' ');
		return '<svg class="chart" viewBox="0 -4 ' + W + ' ' + (H + 22) + '" role="img" aria-label="' + L('المتبقي شهرًا بشهر حتى الصفر', 'What is left, month by month, down to zero') + '">' +
			'<polygon points="' + x(0) + ',' + H + ' ' + pts + ' ' + x(n) + ',' + H + '" class="area"/><polyline points="' + pts + '" class="line"/>' +
			'<line x1="0" x2="' + W + '" y1="' + H + '" y2="' + H + '" class="axis"/>' +
			'<text x="' + x(0) + '" y="' + (H + 16) + '" text-anchor="' + (I18n.lang === 'ar' ? 'end' : 'start') + '">' + L('الآن', 'Now') + '</text>' +
			'<text x="' + x(n) + '" y="' + (H + 16) + '" text-anchor="' + (I18n.lang === 'ar' ? 'start' : 'end') + '">' + esc(I18n.month(p.end)) + '</text></svg>';
	}

	/* ---------- places ---------- */

	var placesMap = null, placesSeen = false;
	function drawPlaces() {
		var el = $('#places'), withPlace = S.state.debts.filter(S.located);
		if (placesMap && placesMap.map) { placesMap.map.remove(); placesMap = null; }
		var html = '<h2 id="places-h">' + L('الأماكن', 'Places') + '</h2>';
		if (!withPlace.length) html += empty('🗺️', L('لا أماكن بعد', 'No places yet'), L('أضف مكانًا لأي دين — المحل الذي عليك فيه باقي فكة مثلًا — ليظهر هنا، ونذكّرك به حين تمر بجواره.', 'Add a place to any debt — the shop where you owe some change, say — and it shows here, with a reminder when you pass by.'));
		else html += '<div class="big-map" id="big-map"></div>';
		el.innerHTML = html;
		if (withPlace.length && placesSeen) mountMap();
	}
	function mountMap() {
		var m = $('#big-map');
		if (!m || placesMap) return;
		placesMap = Places.overview(m, S.state.debts, function (id) { openDetail(id); });
	}
	/* the map (and Leaflet) only loads once the section is on screen */
	new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { placesSeen = true; mountMap(); } }); }, { rootMargin: '200px' }).observe($('#places'));

	/* ---------- settings ---------- */

	function drawSettings() {
		var st = S.state.settings;
		var opt = function (v, t, cur) { return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + t + '</option>'; };
		$('#settings').innerHTML = '<h2 id="settings-h">' + L('الإعدادات', 'Settings') + '</h2>' +
			'<div class="card form">' +
				'<label class="field"><span>' + L('اللغة', 'Language') + '</span><select data-setting="lang">' + opt('', L('لغة الجهاز', 'Device language'), st.lang) + opt('ar', 'العربية', st.lang) + opt('en', 'English', st.lang) + '</select></label>' +
				'<div class="field"><span>' + L('المظهر', 'Theme') + '</span><div class="seg themes" role="radiogroup">' + Object.keys(THEMES).map(function (k) {
					return '<button type="button" role="radio" aria-checked="' + (st.theme === k) + '" data-theme-pick="' + k + '">' + THEMES[k][0] + ' ' + L(THEMES[k][1], THEMES[k][2]) + '</button>';
				}).join('') + '</div></div>' +
				'<label class="field"><span>' + L('العملة', 'Currency') + '</span><select data-setting="currency">' + I18n.CURRENCIES.concat(I18n.CURRENCIES.indexOf(I18n.currency) < 0 ? [I18n.currency] : []).map(function (c) { return opt(c, c, I18n.currency); }).join('') + '</select></label>' +
				'<label class="toggle"><input type="checkbox" data-setting="nearby"' + (st.nearby ? ' checked' : '') + '><span>' + L('ذكّرني حين أكون قرب مكان عليّ فيه دين', 'Remind me when I’m near a place I owe') + '<small>' + L('عند فتح التطبيق، يُقارن موقعك بأماكن ديونك على جهازك فقط.', 'When the app opens, your location is checked against your debts’ places, on this device only.') + '</small></span></label>' +
			'</div>' +
			'<div class="card"><h3>' + L('بياناتك', 'Your data') + '</h3><p class="hint">' + L('كل شيء محفوظ في هذا المتصفح فقط، ولا يُرسل إلى أي مكان. صدّره لتنقله إلى جهاز آخر أو تحتفظ بنسخة.', 'Everything is kept in this browser only and sent nowhere. Export it to move to another device or keep a copy.') + '</p>' +
				'<div class="btn-row"><button type="button" class="btn btn-ghost" data-export="json">' + L('تصدير JSON', 'Export JSON') + '</button>' +
				'<button type="button" class="btn btn-ghost" data-export="csv">' + L('تصدير CSV', 'Export CSV') + '</button>' +
				'<label class="btn btn-ghost">' + L('استيراد', 'Import') + '<input type="file" accept=".json,application/json" data-import hidden></label></div>' +
				'<button type="button" class="btn btn-danger btn-wide" data-wipe>' + L('امسح كل الديون', 'Erase all debts') + '</button></div>' +
			'<p class="foot">' + L('ديوني — يعمل دون إنترنت ويُثبَّت كتطبيق. الخرائط من OpenStreetMap. العدّاد والمسطرة على طريقة Pavel Troshkin.', 'Debts — works offline and installs as an app. Maps by OpenStreetMap. The rolling counter and ruler after Pavel Troshkin’s pens.') + '</p>';
	}

	/* ---------- sheets: one debt, and the full form ---------- */

	function openSheet(html, onReady) {
		sheet.innerHTML = '<form method="dialog" class="sheet-body">' + html + '</form>';
		if (sheet.showModal) { if (!sheet.open) sheet.showModal(); } else sheet.setAttribute('open', '');
		var first = sheet.querySelector('[autofocus]');
		if (first && !matchMedia('(pointer: coarse)').matches) first.focus();
		if (onReady) onReady(sheet.querySelector('form'));
	}
	function closeSheet() { if (sheet.close && sheet.open) sheet.close(); else sheet.removeAttribute('open'); sheet.innerHTML = ''; sheetDebt = ''; }
	var sheetDebt = '';
	sheet.addEventListener('click', function (ev) { if (ev.target === sheet || ev.target.closest('[data-close]')) { ev.preventDefault(); closeSheet(); } });
	sheet.addEventListener('close', function () { sheet.innerHTML = ''; sheetDebt = ''; });

	function openDetail(id) {
		var d = S.get(id);
		if (!d) { closeSheet(); return; }
		sheetDebt = id;
		var bal = S.balance(d), p = plan(), mine = p.debts.filter(function (x) { return x.id === d.id; })[0];
		var html = '<div class="sheet-head"><h2><span aria-hidden="true">' + KINDS[d.kind].icon + '</span> ' + esc(d.name) + '</h2>' +
			'<span><button type="button" class="icon-btn" data-edit="' + d.id + '" aria-label="' + L('تعديل', 'Edit') + '">✎</button><button type="button" class="icon-btn" data-close aria-label="' + L('إغلاق', 'Close') + '">×</button></span></div>';
		html += '<div class="big-bal"><span>' + (bal > 0 ? L('المتبقي', 'Still owed') : L('مسدَّد بالكامل', 'Paid off')) + '</span><b>' + money(bal) + '</b>' + progress(d) +
			'<small>' + L('اقترضت ', 'Borrowed ') + money(S.borrowed(d)) + ' · ' + L('دفعت ', 'paid ') + money(S.paid(d)) + '</small>' + quickButtons(d, p) +
			'<div class="btn-row"><button type="button" class="btn btn-ghost btn-small" data-compose="add" data-id="' + d.id + '">＋ ' + L('زِد عليه', 'Borrow more') + '</button></div></div>';
		var facts = [[L('النوع', 'Kind'), kindName(d.kind)]];
		if (d.due) facts.push([L('الموعد', 'Due'), I18n.date(d.due) + ' ' + dueChip(d)]);
		if (d.minPay) facts.push([L('أقل قسط شهري', 'Minimum a month'), money(d.minPay)]);
		if (d.apr) facts.push([L('الفائدة السنوية', 'Interest a year'), I18n.num(d.apr) + '%']);
		if (mine && mine.month != null && p.ok) facts.push([L('يُسدَّد في الخطة', 'Paid off in the plan'), I18n.month(monthOf(mine.month)) + ' · #' + I18n.num(mine.rank)]);
		facts.push([L('أُضيف', 'Added'), I18n.date(d.created)]);
		html += '<dl class="facts">' + facts.map(function (f) { return '<dt>' + f[0] + '</dt><dd>' + f[1] + '</dd>'; }).join('') + '</dl>' + (d.note ? '<p class="note">' + esc(d.note) + '</p>' : '');
		if (d.place) {
			html += '<div class="place"><h3>📍 ' + esc(d.place.label || L('المكان', 'The place')) + '</h3>' + (S.located(d) ? '<div class="mini-map" id="mini-map"></div>' +
				'<div class="btn-row"><a class="btn btn-ghost btn-small" target="_blank" rel="noopener" href="' + Places.directionsLink(d.place) + '">' + L('الاتجاهات', 'Directions') + '</a>' +
				'<a class="btn btn-ghost btn-small" target="_blank" rel="noopener" href="' + Places.mapsLink(d.place) + '">' + L('افتح في الخريطة', 'Open in maps') + '</a></div>' : '') + '</div>';
		}
		var entries = [{ type: 'start', amount: d.amount, date: d.created.slice(0, 10), note: '' }].concat(d.entries).reverse();
		html += '<h3>' + L('السجل', 'History') + '</h3><ul class="history">' + entries.map(function (e) {
			var what = e.type === 'pay' ? L('دفعة', 'Payment') : e.type === 'borrow' ? L('اقتراض إضافي', 'Borrowed more') : L('بداية الدين', 'Started');
			return '<li class="h-' + e.type + '"><span><b>' + what + '</b><small>' + I18n.date(e.date) + (e.note ? ' · ' + esc(e.note) : '') + '</small></span>' +
				'<span class="h-amt">' + (e.type === 'pay' ? '−' : '+') + money(e.amount) + '</span>' +
				(e.id ? '<button type="button" class="icon-btn small" data-unentry="' + e.id + '" aria-label="' + L('احذف', 'Delete') + '">×</button>' : '<span class="icon-btn small" aria-hidden="true"></span>') + '</li>';
		}).join('') + '</ul>';
		html += '<button type="button" class="btn btn-danger btn-wide" data-del="' + d.id + '">' + L('احذف هذا الدين', 'Delete this debt') + '</button>';
		openSheet(html, function () {
			var el = $('#mini-map');
			if (!el || !S.located(d)) return;
			var api = Places.picker(el, d.place, function () {});
			var wait = setInterval(function () {
				if (!api.map) return;
				clearInterval(wait);
				api.map.off('click');
				api.map.eachLayer(function (l) { if (l.dragging) l.dragging.disable(); });
			}, 200);
			setTimeout(function () { clearInterval(wait); }, 10000);
		});
	}

	/* the full form: edit a debt, or a new one with all its details (from «More details…») */
	function debtForm(d, preset) {
		var editing = !!d;
		d = d || Object.assign({ name: '', kind: 'person', amount: '', apr: 0, minPay: 0, due: '', note: '', place: null }, preset || {});
		var place = S.located(d) ? Object.assign({}, d.place) : null, picker = null;
		openSheet(
			'<div class="sheet-head"><h2>' + (editing ? L('تعديل الدين', 'Edit debt') : L('دين جديد', 'New debt')) + '</h2><button type="button" class="icon-btn" data-close aria-label="' + L('إغلاق', 'Close') + '">×</button></div>' +
			'<label class="field"><span>' + L('لمن؟', 'Who or where?') + '</span><input name="name" required maxlength="80" autofocus value="' + esc(d.name) + '" placeholder="' + L('مثلًا: بقالة عم سيد', 'e.g. Corner shop') + '"></label>' +
			'<div class="seg kinds-seg" role="radiogroup" aria-label="' + L('النوع', 'Kind') + '">' + Object.keys(KINDS).map(function (k) {
				return '<button type="button" role="radio" aria-checked="' + (d.kind === k) + '" data-fkind="' + k + '"><span aria-hidden="true">' + KINDS[k].icon + '</span> ' + kindName(k) + '</button>';
			}).join('') + '</div>' +
			'<div class="two"><label class="field"><span>' + (editing ? L('المبلغ الأصلي', 'Starting amount') : L('المبلغ', 'Amount')) + ' (' + I18n.currency + ')</span><input name="amount" type="number" inputmode="decimal" min="0.01" step="any" required value="' + (d.amount || '') + '"></label>' +
			'<label class="field"><span>' + L('موعد السداد', 'Due date') + '</span><input name="due" type="date" value="' + esc(d.due) + '"></label></div>' +
			'<fieldset class="place-field"><legend>' + L('المكان (اختياري)', 'Place (optional)') + '</legend>' +
				'<input name="label" maxlength="120" value="' + esc(d.place ? d.place.label : '') + '" placeholder="' + L('اسم المكان أو العنوان', 'Place name or address') + '">' +
				'<div class="btn-row"><button type="button" class="btn btn-ghost btn-small" data-fhere>📍 ' + L('موقعي الحالي', 'Use where I am') + '</button>' +
				'<button type="button" class="btn btn-ghost btn-small" data-pick>🗺️ ' + L('اختر على الخريطة', 'Pick on the map') + '</button>' +
				'<button type="button" class="btn btn-ghost btn-small" data-noplace' + (place ? '' : ' hidden') + '>' + L('بلا مكان', 'Remove') + '</button></div>' +
				'<p class="hint" data-coords></p><div class="pick-map" hidden></div></fieldset>' +
			'<details class="more-fields"' + (d.apr || d.minPay ? ' open' : '') + '><summary>' + L('للخطة: قسط شهري وفائدة', 'For the plan: monthly minimum and interest') + '</summary>' +
				'<div class="two"><label class="field"><span>' + L('أقل قسط شهري', 'Minimum a month') + '</span><input name="minPay" type="number" inputmode="decimal" min="0" step="any" value="' + (d.minPay || '') + '"></label>' +
				'<label class="field"><span>' + L('الفائدة السنوية %', 'Interest a year %') + '</span><input name="apr" type="number" inputmode="decimal" min="0" max="200" step="any" value="' + (d.apr || '') + '"></label></div></details>' +
			'<label class="field"><span>' + L('ملاحظة', 'Note') + '</span><textarea name="note" rows="2" maxlength="500">' + esc(d.note) + '</textarea></label>' +
			'<div class="btn-row end"><button type="button" class="btn btn-ghost" data-close>' + L('إلغاء', 'Cancel') + '</button><button type="submit" class="btn go-add">' + (editing ? L('احفظ', 'Save') : L('أضف', 'Add')) + '</button></div>',
			function (form) {
				var kind = d.kind;
				var coords = form.querySelector('[data-coords]'), mapEl = form.querySelector('.pick-map'), noBtn = form.querySelector('[data-noplace]');
				function showPlace() { coords.textContent = place ? L('محفوظ: ', 'Saved: ') + place.lat.toFixed(5) + ', ' + place.lng.toFixed(5) : ''; noBtn.hidden = !place; }
				function setPlace(p, pan) { place = { lat: p.lat, lng: p.lng, label: form.label.value.trim() }; showPlace(); if (picker && picker.map) picker.set(p, pan); }
				function openMap() { if (!mapEl.hidden) return; mapEl.hidden = false; picker = Places.picker(mapEl, place, function (p) { setPlace(p); }); }
				showPlace();
				form.querySelectorAll('[data-fkind]').forEach(function (b) {
					b.addEventListener('click', function () { kind = b.getAttribute('data-fkind'); form.querySelectorAll('[data-fkind]').forEach(function (x) { x.setAttribute('aria-checked', x === b); }); });
				});
				form.querySelector('[data-pick]').addEventListener('click', openMap);
				form.querySelector('[data-fhere]').addEventListener('click', function (ev) {
					var b = ev.currentTarget; b.disabled = true; coords.textContent = L('جارٍ تحديد موقعك…', 'Finding where you are…');
					Places.here().then(function (p) {
						b.disabled = false; openMap(); setPlace(p, true);
						var wait = setInterval(function () { if (picker && picker.map) { clearInterval(wait); picker.set(p, true); } }, 150);
						setTimeout(function () { clearInterval(wait); }, 8000);
						if (p.acc > 100) coords.textContent += L(' (دقة تقريبية: ', ' (accurate to about ') + Places.fmtDistance(p.acc) + ')';
					}).catch(function (e) {
						b.disabled = false;
						coords.textContent = e && e.code === 1 ? L('لم يُسمح بمعرفة الموقع. اختر المكان على الخريطة.', 'Location wasn’t allowed. Pick the place on the map instead.') : L('تعذّر تحديد موقعك. اختر المكان على الخريطة.', 'Couldn’t find your location. Pick it on the map instead.');
					});
				});
				noBtn.addEventListener('click', function () { place = null; showPlace(); if (picker && picker.map) { picker.map.remove(); picker = null; mapEl.innerHTML = ''; mapEl.hidden = true; mapEl.className = 'pick-map'; } });
				form.addEventListener('submit', function (ev) {
					ev.preventDefault();
					var label = form.label.value.trim();
					var data = {
						name: form.name.value.trim(), kind: kind, amount: +form.amount.value, due: form.due.value,
						minPay: +form.minPay.value || 0, apr: +form.apr.value || 0, note: form.note.value.trim(),
						place: place ? { lat: place.lat, lng: place.lng, label: label } : label ? { lat: null, lng: null, label: label } : null
					};
					if (!data.name || !(data.amount > 0)) return;
					closeSheet();
					if (editing) { S.updateDebt(d.id, data); Notify(L('حُفظ.', 'Saved.'), { type: 'success', ttl: 1800 }); }
					else { S.addDebt(data); closeComposer(); undoNote(S.last); window.scrollTo({ top: 0, behavior: 'smooth' }); }
				});
			});
	}

	/* ---------- every other button on the page ---------- */

	function quickPay(id, amt) {
		closeSheet();
		if (S.addEntry(id, 'pay', amt)) { undoNote(S.last); window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
	}
	document.addEventListener('click', function (ev) {
		var b = ev.target.closest('button, [data-compose]');
		if (!b || composer.contains(b)) return;
		var g = function (a) { return b.getAttribute(a); };
		if (b.hasAttribute('data-open')) openComposer(g('data-open'));
		else if (b.hasAttribute('data-scene-kind')) { C.kind = g('data-scene-kind'); openComposer('add'); }
		else if (b.hasAttribute('data-compose')) { closeSheet(); openComposer(g('data-compose'), g('data-id') || ''); }
		else if (b.hasAttribute('data-quick')) quickPay(g('data-quick'), +g('data-amt'));
		else if (b.hasAttribute('data-detail')) openDetail(g('data-detail'));
		else if (b.hasAttribute('data-edit')) debtForm(S.get(g('data-edit')));
		else if (b.hasAttribute('data-del')) {
			var d = S.get(g('data-del'));
			if (d && window.confirm(L('أتحذف «' + d.name + '» وسجله؟', 'Delete “' + d.name + '” and its history?'))) { closeSheet(); S.removeDebt(d.id); }
		}
		else if (b.hasAttribute('data-unentry')) { if (window.confirm(L('أتحذف هذا القيد؟', 'Delete this entry?'))) S.removeEntry(sheetDebt, g('data-unentry')); }
		else if (b.hasAttribute('data-strategy')) { S.state.settings.strategy = g('data-strategy'); S.save(); }
		else if (b.hasAttribute('data-up') || b.hasAttribute('data-down')) {
			var ids = plan().debts.map(function (x) { return x.id; }), i = +(g('data-up') || g('data-down')), j = b.hasAttribute('data-up') ? i - 1 : i + 1;
			if (j < 0 || j >= ids.length) return;
			var t = ids[i]; ids[i] = ids[j]; ids[j] = t;
			S.state.settings.order = ids; S.save();
		}
		else if (b.hasAttribute('data-theme-pick')) { S.state.settings.theme = g('data-theme-pick'); S.save(); }
		else if (b.hasAttribute('data-export')) exportData(g('data-export'));
		else if (b.hasAttribute('data-wipe')) {
			if (window.confirm(L('سيُمسح كل دين وكل دفعة من هذا الجهاز. صدّر نسخة أولًا إن أردت. متابعة؟', 'Every debt and payment will be erased from this device. Export a copy first if you want one. Continue?'))) { closeComposer(); S.reset(); }
		}
	});
	document.addEventListener('change', function (ev) {
		var t = ev.target;
		if (t.hasAttribute('data-sort')) { sortBy = t.value; drawDebts(); }
		else if (t.hasAttribute('data-import')) importData(t);
		else if (t.getAttribute('data-setting') === 'nearby') {
			if (t.checked) Places.here().then(function () { S.state.settings.nearby = true; S.save(); checkNearby(true); })
				.catch(function () { t.checked = false; Notify(L('لم يُسمح بمعرفة الموقع.', 'Location wasn’t allowed.'), { type: 'warning' }); });
			else { S.state.settings.nearby = false; S.save(); }
		}
		else if (t.hasAttribute('data-setting')) { S.state.settings[t.getAttribute('data-setting')] = t.value; S.save(); }
	});
	$('#theme').addEventListener('click', function () {
		var order = ['auto', 'light', 'dark'], st = S.state.settings;
		st.theme = order[(order.indexOf(st.theme) + 1) % 3]; S.save();
	});
	$('#lang').addEventListener('click', function () { S.state.settings.lang = I18n.lang === 'ar' ? 'en' : 'ar'; S.save(); });

	function download(name, type, text) {
		var a = document.createElement('a');
		a.href = URL.createObjectURL(new Blob([text], { type: type }));
		a.download = name;
		document.body.appendChild(a); a.click(); a.remove();
		setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
	}
	function exportData(kind) {
		var stamp = S.today();
		if (kind === 'csv') download('debts-' + stamp + '.csv', 'text/csv;charset=utf-8', S.exportCSV());
		else download('debts-' + stamp + '.json', 'application/json', S.exportJSON());
	}
	function importData(input) {
		var f = input.files && input.files[0];
		if (!f) return;
		var r = new FileReader();
		r.onload = function () {
			try {
				var peek = JSON.parse(r.result);
				var n = peek && peek.state && Array.isArray(peek.state.debts) ? peek.state.debts.length : 0;
				if (!window.confirm(L('سيحل هذا الملف (' + I18n.num(n) + ' دين) محل ما على هذا الجهاز. متابعة؟', 'This file (' + n + ' debts) will replace what is on this device. Continue?'))) return;
				S.importJSON(r.result);
				Notify(L('استُورد.', 'Imported.'), { type: 'success' });
			} catch (e) { Notify(L('هذا الملف ليس تصديرًا من ديوني.', 'That file isn’t a Debts export.'), { type: 'error' }); }
			input.value = '';
		};
		r.readAsText(f);
	}

	/* ---------- reminders: what is due, and what is near ---------- */

	function remindDue() {
		var key = 'debts-reminded', t = S.today();
		try { if (localStorage.getItem(key) === t) return; localStorage.setItem(key, t); } catch (e) {}
		var soon = S.open().filter(function (d) { var n = S.dueIn(d); return n != null && n <= 3; });
		if (!soon.length) return;
		var late = soon.filter(function (d) { return S.dueIn(d) < 0; });
		Notify(soon.slice(0, 3).map(function (d) { return '<b>' + esc(d.name) + '</b> · ' + money(S.balance(d)) + ' ' + dueChip(d); }).join('<br>'),
			{ title: late.length ? L('متأخرات', 'Overdue') : L('مواعيد قريبة', 'Coming up'), html: true, type: late.length ? 'warning' : 'notice', ttl: 8000 });
	}
	var near = [];
	function checkNearby(say) {
		if (!S.state.settings.nearby) return;
		Places.allowed().then(function (ok) {
			if (!ok) return;
			Places.nearby(S.state.debts).then(function (list) {
				near = list;
				drawNear();
				if (list.length) Jar.say(L('عليك هنا ', 'You owe here: ') + money(S.balance(list[0].debt)) + '!', 4000);
				else if (say) Notify(L('سنذكّرك حين تكون قرب مكان عليك فيه دين.', 'We’ll remind you when you’re near a place you owe.'), { type: 'success' });
			}).catch(function () {});
		});
	}
	function drawNear() {
		var el = $('#near');
		if (!el) return;
		var list = near.filter(function (x) { return S.balance(x.debt) > 0; });
		el.innerHTML = list.length ? '<div class="card near"><h3>📍 ' + L('قريب منك', 'Near you') + '</h3><ul class="pay-list">' + list.map(function (x) {
			return '<li><span><b>' + esc(x.debt.name) + '</b> · ' + money(S.balance(x.debt)) + ' <small>' + Places.fmtDistance(x.m) + '</small></span><button type="button" class="chip-btn all" data-quick="' + x.debt.id + '" data-amt="' + S.balance(x.debt) + '">' + L('ادفع الآن', 'Pay now') + '</button></li>';
		}).join('') + '</ul></div>' : '';
	}

	/* the section in view lights up in the jump bar */
	var jumps = document.querySelectorAll('.jump a');
	new IntersectionObserver(function (es) {
		es.forEach(function (e) {
			if (!e.isIntersecting) return;
			jumps.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id); });
		});
	}, { rootMargin: '-45% 0px -50% 0px' }).observe($('#debts'));
	['#plan', '#places', '#settings'].forEach(function (s) {
		new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) jumps.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === s); }); }); }, { rootMargin: '-45% 0px -50% 0px' }).observe($(s));
	});

	/* ---------- start ---------- */

	var langKey = '';
	function drawAll() { drawTop(); drawDebts(); drawPlan(); drawPlaces(); }
	S.on(function (what) {
		if (what === 'settings' || what === 'import') {
			applySettings(); drawSettings();
			owed.relayout(); amount.relayout(); if (budgetRoller) budgetRoller.relayout(); if (gauge) gauge.relayout();
			/* the plan's controls carry words and currency: built again only when those change */
			var lk = I18n.lang + I18n.currency;
			if (lk !== langKey) { langKey = lk; planBuilt = false; }
		}
		drawTop(); drawDebts(); drawPlan();
		if (what !== 'settings' || !placesMap) drawPlaces();
		if (C.open) drawComposer();
		if (sheetDebt && sheet.open) openDetail(sheetDebt);
		if (what === 'add' || what === 'borrow') Jar.react('borrow');
		else if (what === 'pay') Jar.react('pay');
		else if (what === 'paidoff') {
			if (S.total() <= 0) { Jar.react('free'); Notify(L('لا ديون عليك! 🎉', 'You’re debt-free! 🎉'), { type: 'success', ttl: 5000 }); }
			else Jar.react('paidoff');
		}
	});
	applySettings();
	langKey = I18n.lang + I18n.currency;
	Jar.mount($('#jar'));
	owed.set(S.total(), true);
	drawAll();
	drawSettings();
	/* the home-screen shortcuts: ?do=add, ?do=pay */
	var want = /[?&]do=(add|pay)/.exec(location.search);
	if (want) setTimeout(function () { openComposer(want[1]); }, 300);
	setTimeout(function () { remindDue(); checkNearby(false); }, 900);
	window.App = { open: openComposer, detail: openDetail, C: C };
})();
