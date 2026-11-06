/* The app: one page, its screens chosen by the address's hash —
     #/            the jar and your debts
     #/debt/<id>   one debt: its balance, place, payments
     #/plan        the payoff plan
     #/map         every debt with a place
     #/settings    language, currency, your data
   Adding and editing happen in a sheet (a <dialog>) over the screen. Every change goes through
   Store, which saves and calls back here: the screen is drawn again and the man reacts. */
(function () {
	'use strict';

	var S = window.Store, esc = I18n.esc, money = function (n, s) { return I18n.money(n, s); };
	var view = document.getElementById('view');
	var stage = document.getElementById('stage');
	var sheet = document.getElementById('sheet');
	var route = { name: 'home', id: '' };

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
	var kindName = function (k) { return L(KINDS[k].ar, KINDS[k].en); };

	/* ---------- settings applied to the page ---------- */

	function applySettings() {
		var st = S.state.settings;
		I18n.set(st.lang || I18n.guessLang(), st.currency || I18n.guessCurrency());
		var html = document.documentElement;
		if (st.theme === 'auto') html.removeAttribute('data-theme'); else html.setAttribute('data-theme', st.theme);
		document.title = L('ديوني', 'Debts');
		document.querySelectorAll('[data-t]').forEach(function (n) { var p = n.getAttribute('data-t').split('|'); n.textContent = L(p[0], p[1]); });
		document.querySelectorAll('[data-tl]').forEach(function (n) { var p = n.getAttribute('data-tl').split('|'); n.setAttribute('aria-label', L(p[0], p[1])); n.title = L(p[0], p[1]); });
		var mc = document.querySelector('meta[name="theme-color"]');
		if (mc) mc.setAttribute('content', getComputedStyle(html).getPropertyValue('--bg').trim() || '#f6c66b');
	}

	/* ---------- the plan and the man's load ---------- */

	function plan() { var st = S.state.settings; return Plan.run(S.open(), st.budget, st.strategy, st.order); }
	function level(p) {
		var total = S.total();
		if (total <= 0) return 0;
		var lv = 2;
		if (p.ok && p.months) lv = p.months <= 2 ? 1 : p.months <= 8 ? 2 : p.months <= 24 ? 3 : 4;
		else if (p.reason === 'toolow') lv = 4;
		if (S.overdue().length) lv = Math.min(4, lv + 1);
		return lv;
	}
	function updateJar() {
		var p = plan();
		Jar.update({ total: S.total(), peak: S.state.meta.peak || S.total(), level: level(p), money: money });
	}

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
		var b = S.borrowed(d), paid = S.paid(d);
		var f = b > 0 ? Math.min(1, paid / b) : 0;
		return '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(f * 100) + '"><span style="width:' + (f * 100).toFixed(1) + '%"></span></div>';
	}
	function debtCard(d, extra) {
		var bal = S.balance(d);
		return '<a class="card debt" href="#/debt/' + d.id + '">' +
			'<span class="kind" aria-hidden="true">' + KINDS[d.kind].icon + '</span>' +
			'<span class="debt-main"><b class="debt-name">' + esc(d.name) + '</b>' +
				'<span class="debt-sub">' + (d.place ? '📍 ' + esc(d.place.label || L('مكان محفوظ', 'Saved place')) : kindName(d.kind)) + ' ' + dueChip(d) + '</span>' +
				progress(d) + (extra || '') +
			'</span>' +
			'<span class="debt-amt">' + (bal > 0 ? money(bal) : '<span class="chip ok">' + L('مسدَّد', 'Paid') + '</span>') + '</span>' +
		'</a>';
	}
	function empty(icon, title, text, action) {
		return '<div class="empty"><div class="empty-icon" aria-hidden="true">' + icon + '</div><h2>' + title + '</h2><p>' + text + '</p>' + (action || '') + '</div>';
	}

	/* ---------- home ---------- */

	var sortBy = 'plan';
	function home() {
		var open = S.open(), done = S.done(), p = plan(), total = S.total();
		if (!S.state.debts.length) {
			return summary(p) + empty('🫙', L('الكيس فارغ', 'The sack is empty'),
				L('سجّل أي دين: لصديق، أو باقي فكة عند البقال، أو قسط بطاقة. يبقى كل شيء على هذا الجهاز.', 'Add any debt: a friend, the change you owe the corner shop, a card. Everything stays on this device.'),
				'<button type="button" class="btn" data-act="add">' + L('أضف أول دين', 'Add your first debt') + '</button>');
		}
		var order = {};
		p.debts.forEach(function (x) { order[x.id] = x; });
		var list = open.slice();
		if (sortBy === 'plan') list.sort(function (a, b) { return (order[a.id] ? order[a.id].rank : 99) - (order[b.id] ? order[b.id].rank : 99); });
		else if (sortBy === 'big') list.sort(function (a, b) { return S.balance(b) - S.balance(a); });
		else if (sortBy === 'due') list.sort(function (a, b) { return (a.due || '9999') < (b.due || '9999') ? -1 : 1; });
		else if (sortBy === 'new') list.sort(function (a, b) { return a.created < b.created ? 1 : -1; });

		var html = summary(p);
		var next = p.ok && p.debts.filter(function (x) { return x.now > 0; });
		if (next && next.length && total > 0) {
			html += '<section class="card next"><h2>' + L('هذا الشهر', 'This month') + '</h2><ul class="pay-list">' +
				next.slice(0, 3).map(function (x) {
					return '<li><span>' + L('ادفع ', 'Pay ') + '<b>' + money(x.now) + '</b>' + L(' إلى ', ' to ') + esc(x.name) + '</span>' +
						'<button type="button" class="btn btn-small" data-pay="' + x.id + '" data-amt="' + x.now + '">' + L('سجّل', 'Log it') + '</button></li>';
				}).join('') + '</ul>' + (next.length > 3 ? '<a class="more" href="#/plan">' + L('الخطة كاملة', 'The whole plan') + ' →</a>' : '') + '</section>';
		}
		html += '<div id="near"></div>';
		if (open.length) {
			html += '<section><div class="row-head"><h2>' + L('عليك', 'You owe') + ' <span class="count">' + I18n.num(open.length) + '</span></h2>' +
				'<label class="sort"><span class="sr">' + L('رتّب', 'Sort') + '</span><select data-sort>' +
				[['plan', L('ترتيب الخطة', 'Plan order')], ['big', L('الأكبر أولًا', 'Largest first')], ['due', L('الموعد', 'Due date')], ['new', L('الأحدث', 'Newest')]]
					.map(function (o) { return '<option value="' + o[0] + '"' + (sortBy === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
				'</select></label></div><div class="list">' + list.map(function (d) { return debtCard(d); }).join('') + '</div></section>';
		} else {
			html += empty('🎉', L('لا ديون مفتوحة', 'Nothing owed'), L('كل ما سجّلته مسدَّد. أحسنت!', 'Everything you added is paid off. Well done!'));
		}
		if (done.length) {
			html += '<details class="done"><summary>' + L('مسدَّدة', 'Paid off') + ' <span class="count">' + I18n.num(done.length) + '</span></summary><div class="list">' +
				done.map(function (d) { return debtCard(d); }).join('') + '</div></details>';
		}
		return html;
	}
	function summary(p) {
		var total = S.total(), late = S.overdue().length, st = S.state.settings;
		var free = total <= 0 ? L('لا شيء عليك', 'You owe nothing')
			: p.ok && p.months ? L('حر في ', 'Debt-free by ') + I18n.month(p.end)
			: p.reason === 'toolow' ? L('الميزانية لا تكفي', 'Budget too small')
			: L('حدد ميزانية شهرية', 'Set a monthly budget');
		return '<section class="stats">' +
			'<div class="stat"><span>' + L('المتبقي', 'Still owed') + '</span><b>' + money(total) + '</b></div>' +
			'<a class="stat" href="#/plan"><span>' + L('الخطة', 'The plan') + '</span><b>' + esc(free) + '</b>' + (p.ok && p.months && total > 0 ? '<small>' + I18n.span(p.months - 1 < 1 ? 0 : p.months) + (st.budget ? ' · ' + money(st.budget) + L(' شهريًا', '/mo') : '') + '</small>' : '') + '</a>' +
			(late ? '<div class="stat late"><span>' + L('متأخرة', 'Overdue') + '</span><b>' + I18n.num(late) + '</b></div>' : '') +
		'</section>';
	}

	/* ---------- one debt ---------- */

	function detail(id) {
		var d = S.get(id);
		if (!d) return empty('🤷', L('غير موجود', 'Not found'), L('ربما حُذف هذا الدين.', 'This debt may have been deleted.'), '<a class="btn" href="#/">' + L('الرئيسية', 'Home') + '</a>');
		var bal = S.balance(d), p = plan(), mine = p.debts.filter(function (x) { return x.id === d.id; })[0];
		var html = '<div class="detail-head"><a class="icon-btn" href="#/" aria-label="' + L('رجوع', 'Back') + '">' + (I18n.lang === 'ar' ? '→' : '←') + '</a>' +
			'<h1><span aria-hidden="true">' + KINDS[d.kind].icon + '</span> ' + esc(d.name) + '</h1>' +
			'<button type="button" class="icon-btn" data-edit="' + d.id + '" aria-label="' + L('تعديل', 'Edit') + '">✎</button></div>';
		html += '<section class="card big-bal"><span>' + (bal > 0 ? L('المتبقي', 'Still owed') : L('مسدَّد بالكامل', 'Paid off')) + '</span><b>' + money(bal) + '</b>' + progress(d) +
			'<small>' + L('اقترضت ', 'Borrowed ') + money(S.borrowed(d)) + ' · ' + L('دفعت ', 'paid ') + money(S.paid(d)) + '</small>' +
			'<div class="btn-row">' + (bal > 0 ? '<button type="button" class="btn" data-pay="' + d.id + '">' + L('سجّل دفعة', 'Log a payment') + '</button>' : '') +
			'<button type="button" class="btn btn-ghost" data-borrow="' + d.id + '">' + L('زِد عليه', 'Borrow more') + '</button></div></section>';
		var facts = [];
		facts.push([L('النوع', 'Kind'), kindName(d.kind)]);
		if (d.due) facts.push([L('الموعد', 'Due'), I18n.date(d.due) + ' ' + dueChip(d)]);
		if (d.minPay) facts.push([L('أقل قسط شهري', 'Minimum a month'), money(d.minPay)]);
		if (d.apr) facts.push([L('الفائدة السنوية', 'Interest a year'), I18n.num(d.apr) + '%']);
		if (mine && mine.month != null && p.ok) facts.push([L('يُسدَّد في الخطة', 'Paid off in the plan'), I18n.month(new Date(new Date().getFullYear(), new Date().getMonth() + mine.month, 1)) + ' · #' + I18n.num(mine.rank)]);
		facts.push([L('أُضيف', 'Added'), I18n.date(d.created)]);
		html += '<section class="card"><dl class="facts">' + facts.map(function (f) { return '<dt>' + f[0] + '</dt><dd>' + f[1] + '</dd>'; }).join('') + '</dl>' +
			(d.note ? '<p class="note">' + esc(d.note) + '</p>' : '') + '</section>';
		if (d.place) {
			html += '<section class="card place"><h2>📍 ' + esc(d.place.label || L('المكان', 'The place')) + '</h2>' + (S.located(d) ? '<div class="mini-map" id="mini-map"></div>' +
				'<div class="btn-row"><a class="btn btn-ghost btn-small" target="_blank" rel="noopener" href="' + Places.directionsLink(d.place) + '">' + L('الاتجاهات', 'Directions') + '</a>' +
				'<a class="btn btn-ghost btn-small" target="_blank" rel="noopener" href="' + Places.mapsLink(d.place) + '">' + L('افتح في الخريطة', 'Open in maps') + '</a></div>' : '<p class="hint">' + L('بلا موقع على الخريطة.', 'No map location.') + '</p>') + '</section>';
		}
		var entries = [{ type: 'start', amount: d.amount, date: d.created.slice(0, 10), note: '' }].concat(d.entries).reverse();
		html += '<section class="card"><h2>' + L('السجل', 'History') + '</h2><ul class="history">' + entries.map(function (e) {
			var sign = e.type === 'pay' ? '−' : '+';
			var what = e.type === 'pay' ? L('دفعة', 'Payment') : e.type === 'borrow' ? L('اقتراض إضافي', 'Borrowed more') : L('بداية الدين', 'Started');
			return '<li class="h-' + e.type + '"><span><b>' + what + '</b><small>' + I18n.date(e.date) + (e.note ? ' · ' + esc(e.note) : '') + '</small></span>' +
				'<span class="h-amt">' + sign + money(e.amount) + '</span>' +
				(e.id ? '<button type="button" class="icon-btn small" data-unentry="' + e.id + '" aria-label="' + L('احذف', 'Delete') + '">×</button>' : '<span class="icon-btn small" aria-hidden="true"></span>') + '</li>';
		}).join('') + '</ul></section>';
		html += '<button type="button" class="btn btn-danger btn-wide" data-del="' + d.id + '">' + L('احذف هذا الدين', 'Delete this debt') + '</button>';
		return html;
	}
	function afterDetail(id) {
		var d = S.get(id), el = document.getElementById('mini-map');
		if (!el || !S.located(d)) return;
		var api = Places.picker(el, d.place, function () {});
		/* it's for looking at, not for moving the pin */
		var wait = setInterval(function () {
			if (!api.map) return;
			clearInterval(wait);
			api.map.off('click');
			api.map.eachLayer(function (l) { if (l.dragging) l.dragging.disable(); });
		}, 200);
	}

	/* ---------- the plan ---------- */

	function planView() {
		var st = S.state.settings, open = S.open(), p = plan();
		var html = '<h1>' + L('خطة السداد', 'Payoff plan') + '</h1>';
		html += '<section class="card"><label class="field"><span>' + L('كم تستطيع أن تدفع للديون كل شهر؟', 'How much can you put toward debts each month?') + '</span>' +
			'<input type="number" inputmode="decimal" min="0" step="any" data-budget value="' + (st.budget || '') + '" placeholder="0"></label>' +
			(p.mins > 0 ? '<p class="hint">' + L('مجموع الأقساط الدنيا: ', 'Minimum payments add up to ') + money(p.mins) + (st.budget && st.budget < p.mins ? ' — <b class="warn">' + L('ميزانيتك أقل منها', 'more than your budget') + '</b>' : '') + '</p>' : '') +
			'<div class="seg" role="radiogroup" aria-label="' + L('الطريقة', 'Strategy') + '">' + Object.keys(STRATEGIES).map(function (k) {
				return '<button type="button" role="radio" aria-checked="' + (st.strategy === k) + '" data-strategy="' + k + '">' + L(STRATEGIES[k].ar, STRATEGIES[k].en) + '</button>';
			}).join('') + '</div><p class="hint">' + L(STRATEGIES[st.strategy].why[0], STRATEGIES[st.strategy].why[1]) + '</p></section>';

		if (!open.length) return html + empty('🎉', L('لا شيء لتخطط له', 'Nothing to plan'), L('لا ديون مفتوحة الآن.', 'No open debts right now.'));
		if (p.reason === 'nobudget') return html + empty('🧮', L('ابدأ بالميزانية', 'Start with a budget'), L('اكتب ما تستطيع دفعه شهريًا لنرى متى تتحرر.', 'Type what you can pay each month to see when you’ll be free.'));
		if (p.reason === 'toolow') {
			html += '<section class="card alert">' + L('بهذه الميزانية لا ينقص الدين (الفوائد أكبر مما تدفع). زِد الميزانية أو قلّل الفائدة.', 'With this budget the debt never shrinks (the interest outruns the payments). Raise the budget or lower the interest.') + '</section>';
		} else {
			html += '<section class="card free-by"><span>' + L('تتحرر من الديون في', 'Debt-free by') + '</span><b>' + I18n.month(p.end) + '</b><small>' +
				L('خلال ', 'in ') + I18n.span(p.months) + (p.interest > 0 ? ' · ' + L('فوائد ', 'interest ') + money(p.interest) : '') + '</small>' + chart(p) + '</section>';
			/* what the other strategies would change */
			var cmp = Plan.compare(open, st.budget, st.order), notes = [];
			Object.keys(cmp).forEach(function (k) {
				var c = cmp[k];
				if (k === st.strategy || !c.ok || k === 'custom') return;
				var dm = p.months - c.months, di = p.interest - c.interest;
				if (dm > 0 || di > 1) notes.push('<li><b>' + L(STRATEGIES[k].ar, STRATEGIES[k].en) + '</b>: ' + (dm > 0 ? L('أسرع بـ', 'done ') + I18n.span(dm) + L('', ' sooner') : '') + (dm > 0 && di > 1 ? ' · ' : '') + (di > 1 ? L('توفّر ', 'saves ') + money(di) + L(' فوائد', ' in interest') : '') + '</li>');
			});
			if (notes.length) html += '<section class="card"><h2>' + L('طرق أخرى', 'Other ways') + '</h2><ul class="cmp">' + notes.join('') + '</ul></section>';
		}
		html += '<section><h2>' + L('الترتيب', 'The order') + '</h2><ol class="plan-list">' + p.debts.map(function (x, i) {
			var d = S.get(x.id);
			var when = x.month != null && p.ok ? I18n.month(new Date(new Date().getFullYear(), new Date().getMonth() + x.month, 1)) : '—';
			return '<li class="card"><span class="rank">' + I18n.num(x.rank) + '</span><span class="plan-main"><a href="#/debt/' + x.id + '"><b>' + esc(x.name) + '</b></a>' +
				'<small>' + money(S.balance(d)) + ' · ' + L('يُغلق ', 'gone by ') + esc(when) + '</small>' +
				(x.now > 0 ? '<small class="now">' + L('هذا الشهر: ', 'This month: ') + money(x.now) + '</small>' : '') + '</span>' +
				(st.strategy === 'custom' ? '<span class="move"><button type="button" class="icon-btn small" data-up="' + i + '" aria-label="' + L('لأعلى', 'Up') + '"' + (i ? '' : ' disabled') + '>↑</button><button type="button" class="icon-btn small" data-down="' + i + '" aria-label="' + L('لأسفل', 'Down') + '"' + (i < p.debts.length - 1 ? '' : ' disabled') + '>↓</button></span>' : '') +
				(x.now > 0 ? '<button type="button" class="btn btn-small" data-pay="' + x.id + '" data-amt="' + x.now + '">' + L('ادفع', 'Pay') + '</button>' : '') + '</li>';
		}).join('') + '</ol></section>';
		return html;
	}
	/* what is left, month by month */
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

	/* ---------- map ---------- */

	function mapView() {
		var withPlace = S.state.debts.filter(S.located);
		var html = '<h1>' + L('الأماكن', 'Places') + '</h1>';
		if (!withPlace.length) return html + empty('🗺️', L('لا أماكن بعد', 'No places yet'), L('أضف مكانًا لأي دين — المحل الذي عليك فيه باقي فكة مثلًا — ليظهر هنا، ونذكّرك به حين تمر بجواره.', 'Add a place to any debt — the shop where you owe some change, say — and it shows here, with a reminder when you pass by.'));
		html += '<div class="big-map" id="big-map"></div><div class="list" id="place-list">' + withPlace.map(function (d) { return debtCard(d, '<span class="dist" data-dist="' + d.id + '"></span>'); }).join('') + '</div>';
		return html;
	}
	function afterMap() {
		var el = document.getElementById('big-map');
		if (!el) return;
		Places.overview(el, S.state.debts, function (id) { location.hash = '#/debt/' + id; });
		Places.allowed().then(function (ok) {
			if (!ok) return;
			Places.here({ enableHighAccuracy: false }).then(function (me) {
				document.querySelectorAll('[data-dist]').forEach(function (n) {
					var d = S.get(n.getAttribute('data-dist'));
					if (S.located(d)) n.textContent = Places.fmtDistance(Places.distance(me, d.place)) + L(' منك', ' away');
				});
			}).catch(function () {});
		});
	}

	/* ---------- settings ---------- */

	function settingsView() {
		var st = S.state.settings;
		var opt = function (v, t, cur) { return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + t + '</option>'; };
		return '<h1>' + L('الإعدادات', 'Settings') + '</h1>' +
			'<section class="card form">' +
				'<label class="field"><span>' + L('اللغة', 'Language') + '</span><select data-set="lang">' + opt('', L('لغة الجهاز', 'Device language'), st.lang) + opt('ar', 'العربية', st.lang) + opt('en', 'English', st.lang) + '</select></label>' +
				'<label class="field"><span>' + L('المظهر', 'Theme') + '</span><select data-set="theme">' + opt('auto', L('تلقائي', 'Automatic'), st.theme) + opt('light', L('فاتح', 'Light'), st.theme) + opt('dark', L('داكن', 'Dark'), st.theme) + '</select></label>' +
				'<label class="field"><span>' + L('العملة', 'Currency') + '</span><select data-set="currency">' + I18n.CURRENCIES.concat(I18n.CURRENCIES.indexOf(I18n.currency) < 0 ? [I18n.currency] : []).map(function (c) { return opt(c, c, I18n.currency); }).join('') + '</select></label>' +
				'<label class="toggle"><input type="checkbox" data-set="nearby"' + (st.nearby ? ' checked' : '') + '><span>' + L('ذكّرني حين أكون قرب مكان عليّ فيه دين', 'Remind me when I’m near a place I owe') + '<small>' + L('عند فتح التطبيق، يُقارن موقعك بأماكن ديونك على جهازك فقط.', 'When the app opens, your location is checked against your debts’ places, on this device only.') + '</small></span></label>' +
			'</section>' +
			'<section class="card"><h2>' + L('بياناتك', 'Your data') + '</h2><p class="hint">' + L('كل شيء محفوظ في هذا المتصفح فقط، ولا يُرسل إلى أي مكان. صدّره لتنقله إلى جهاز آخر أو تحتفظ بنسخة.', 'Everything is kept in this browser only and sent nowhere. Export it to move to another device or keep a copy.') + '</p>' +
				'<div class="btn-row"><button type="button" class="btn btn-ghost" data-export="json">' + L('تصدير JSON', 'Export JSON') + '</button>' +
				'<button type="button" class="btn btn-ghost" data-export="csv">' + L('تصدير CSV', 'Export CSV') + '</button>' +
				'<label class="btn btn-ghost">' + L('استيراد', 'Import') + '<input type="file" accept=".json,application/json" data-import hidden></label></div>' +
				'<button type="button" class="btn btn-danger btn-wide" data-wipe>' + L('امسح كل الديون', 'Erase all debts') + '</button></section>' +
			'<p class="foot">' + L('ديوني — يعمل دون إنترنت ويُثبَّت كتطبيق. الخرائط من OpenStreetMap.', 'Debts — works offline and installs as an app. Maps by OpenStreetMap.') + '</p>';
	}

	/* ---------- sheets ---------- */

	function openSheet(html, onReady) {
		sheet.innerHTML = '<form method="dialog" class="sheet-body">' + html + '</form>';
		if (sheet.showModal) sheet.showModal(); else sheet.setAttribute('open', '');
		var first = sheet.querySelector('[autofocus]');
		if (first && !matchMedia('(pointer: coarse)').matches) first.focus();
		if (onReady) onReady(sheet.querySelector('form'));
	}
	function closeSheet() { if (sheet.close) sheet.close(); else sheet.removeAttribute('open'); sheet.innerHTML = ''; }
	sheet.addEventListener('click', function (ev) { if (ev.target === sheet || ev.target.closest('[data-close]')) { ev.preventDefault(); closeSheet(); } });
	sheet.addEventListener('close', function () { sheet.innerHTML = ''; });

	function debtForm(d) {
		var editing = !!d;
		d = d || { name: '', kind: 'person', amount: '', apr: 0, minPay: 0, due: '', note: '', place: null };
		var place = S.located(d) ? Object.assign({}, d.place) : null, picker = null;
		openSheet(
			'<div class="sheet-head"><h2>' + (editing ? L('تعديل الدين', 'Edit debt') : L('دين جديد', 'New debt')) + '</h2><button type="button" class="icon-btn" data-close aria-label="' + L('إغلاق', 'Close') + '">×</button></div>' +
			'<label class="field"><span>' + L('لمن؟', 'Who or where?') + '</span><input name="name" required maxlength="80" autofocus value="' + esc(d.name) + '" placeholder="' + L('مثلًا: بقالة عم سيد', 'e.g. Corner shop') + '"></label>' +
			'<div class="seg kinds" role="radiogroup" aria-label="' + L('النوع', 'Kind') + '">' + Object.keys(KINDS).map(function (k) {
				return '<button type="button" role="radio" aria-checked="' + (d.kind === k) + '" data-kind="' + k + '"><span aria-hidden="true">' + KINDS[k].icon + '</span> ' + kindName(k) + '</button>';
			}).join('') + '</div>' +
			'<div class="two"><label class="field"><span>' + (editing ? L('المبلغ الأصلي', 'Starting amount') : L('المبلغ', 'Amount')) + ' (' + I18n.currency + ')</span><input name="amount" type="number" inputmode="decimal" min="0.01" step="any" required value="' + (d.amount || '') + '"></label>' +
			'<label class="field"><span>' + L('موعد السداد', 'Due date') + '</span><input name="due" type="date" value="' + esc(d.due) + '"></label></div>' +
			'<fieldset class="place-field"><legend>' + L('المكان (اختياري)', 'Place (optional)') + '</legend>' +
				'<input name="label" maxlength="120" value="' + esc(d.place ? d.place.label : '') + '" placeholder="' + L('اسم المكان أو العنوان', 'Place name or address') + '">' +
				'<div class="btn-row"><button type="button" class="btn btn-ghost btn-small" data-here>📍 ' + L('موقعي الحالي', 'Use where I am') + '</button>' +
				'<button type="button" class="btn btn-ghost btn-small" data-pick>🗺️ ' + L('اختر على الخريطة', 'Pick on the map') + '</button>' +
				'<button type="button" class="btn btn-ghost btn-small" data-noplace' + (place ? '' : ' hidden') + '>' + L('بلا مكان', 'Remove') + '</button></div>' +
				'<p class="hint" data-coords></p><div class="pick-map" hidden></div></fieldset>' +
			'<details class="more-fields"' + (d.apr || d.minPay ? ' open' : '') + '><summary>' + L('للخطة: قسط شهري وفائدة', 'For the plan: monthly minimum and interest') + '</summary>' +
				'<div class="two"><label class="field"><span>' + L('أقل قسط شهري', 'Minimum a month') + '</span><input name="minPay" type="number" inputmode="decimal" min="0" step="any" value="' + (d.minPay || '') + '"></label>' +
				'<label class="field"><span>' + L('الفائدة السنوية %', 'Interest a year %') + '</span><input name="apr" type="number" inputmode="decimal" min="0" max="200" step="any" value="' + (d.apr || '') + '"></label></div></details>' +
			'<label class="field"><span>' + L('ملاحظة', 'Note') + '</span><textarea name="note" rows="2" maxlength="500">' + esc(d.note) + '</textarea></label>' +
			'<div class="btn-row end"><button type="button" class="btn btn-ghost" data-close>' + L('إلغاء', 'Cancel') + '</button><button type="submit" class="btn">' + (editing ? L('احفظ', 'Save') : L('أضف', 'Add')) + '</button></div>',
			function (form) {
				var kind = d.kind;
				var coords = form.querySelector('[data-coords]'), mapEl = form.querySelector('.pick-map'), noBtn = form.querySelector('[data-noplace]');
				function showPlace() {
					coords.textContent = place ? L('محفوظ: ', 'Saved: ') + place.lat.toFixed(5) + ', ' + place.lng.toFixed(5) : '';
					noBtn.hidden = !place;
				}
				function setPlace(p, pan) { place = { lat: p.lat, lng: p.lng, label: form.label.value.trim() }; showPlace(); if (picker && picker.map) picker.set(p, pan); }
				function openMap() {
					if (!mapEl.hidden) return;
					mapEl.hidden = false;
					picker = Places.picker(mapEl, place, function (p) { setPlace(p); });
				}
				showPlace();
				form.querySelectorAll('[data-kind]').forEach(function (b) {
					b.addEventListener('click', function () {
						kind = b.getAttribute('data-kind');
						form.querySelectorAll('[data-kind]').forEach(function (x) { x.setAttribute('aria-checked', x === b); });
					});
				});
				form.querySelector('[data-pick]').addEventListener('click', openMap);
				form.querySelector('[data-here]').addEventListener('click', function (ev) {
					var b = ev.currentTarget; b.disabled = true; coords.textContent = L('جارٍ تحديد موقعك…', 'Finding where you are…');
					Places.here().then(function (p) {
						b.disabled = false;
						openMap();
						setPlace(p, true);
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
						/* a place can be just a name, too */
						place: place ? { lat: place.lat, lng: place.lng, label: label } : label ? { lat: null, lng: null, label: label } : null
					};
					if (!data.name || !(data.amount > 0)) return;
					closeSheet();
					if (editing) { S.updateDebt(d.id, data); Notify(L('حُفظ.', 'Saved.'), { type: 'success', ttl: 1800 }); }
					else { S.addDebt(data); if (route.name !== 'home') location.hash = '#/'; }
				});
			});
	}

	function entryForm(id, type, amount) {
		var d = S.get(id);
		if (!d) return;
		var bal = S.balance(d), pay = type === 'pay';
		openSheet(
			'<div class="sheet-head"><h2>' + (pay ? L('دفعة إلى ', 'Payment to ') : L('اقتراض إضافي من ', 'Borrowed more from ')) + esc(d.name) + '</h2><button type="button" class="icon-btn" data-close aria-label="' + L('إغلاق', 'Close') + '">×</button></div>' +
			(pay ? '<p class="hint">' + L('المتبقي: ', 'Still owed: ') + money(bal) + '</p>' : '') +
			'<label class="field"><span>' + L('المبلغ', 'Amount') + ' (' + I18n.currency + ')</span><input name="amount" type="number" inputmode="decimal" min="0.01" step="any"' + (pay ? ' max="' + bal + '"' : '') + ' required autofocus value="' + (amount ? Math.min(amount, pay ? bal : amount) : '') + '"></label>' +
			(pay ? '<div class="btn-row quick"><button type="button" class="btn btn-ghost btn-small" data-fill="' + bal + '">' + L('الكل', 'All of it') + ' · ' + money(bal) + '</button>' +
				(bal > 2 ? '<button type="button" class="btn btn-ghost btn-small" data-fill="' + Math.round(bal / 2 * 100) / 100 + '">' + L('النصف', 'Half') + '</button>' : '') + '</div>' : '') +
			'<div class="two"><label class="field"><span>' + L('التاريخ', 'Date') + '</span><input name="date" type="date" value="' + S.today() + '" max="' + S.today() + '"></label>' +
			'<label class="field"><span>' + L('ملاحظة', 'Note') + '</span><input name="note" maxlength="200"></label></div>' +
			'<div class="btn-row end"><button type="button" class="btn btn-ghost" data-close>' + L('إلغاء', 'Cancel') + '</button><button type="submit" class="btn">' + (pay ? L('سجّل الدفعة', 'Log payment') : L('أضف', 'Add')) + '</button></div>',
			function (form) {
				form.querySelectorAll('[data-fill]').forEach(function (b) { b.addEventListener('click', function () { form.amount.value = b.getAttribute('data-fill'); }); });
				form.addEventListener('submit', function (ev) {
					ev.preventDefault();
					var a = +form.amount.value;
					if (!(a > 0)) return;
					closeSheet();
					S.addEntry(id, type, a, form.date.value, form.note.value.trim());
				});
			});
	}

	/* ---------- drawing and routing ---------- */

	function parse() {
		var h = location.hash.replace(/^#\/?/, '').split('/');
		if (h[0] === 'debt' && h[1]) return { name: 'debt', id: h[1] };
		if (['plan', 'map', 'settings'].indexOf(h[0]) >= 0) return { name: h[0], id: '' };
		return { name: 'home', id: '' };
	}
	function render(keepScroll) {
		var y = window.scrollY;
		/* the home-screen shortcut «Add a debt» */
		if (/^#\/add\b/.test(location.hash)) { history.replaceState(null, '', '#/'); setTimeout(function () { debtForm(); }, 50); }
		route = parse();
		stage.hidden = route.name !== 'home';
		view.innerHTML = route.name === 'debt' ? detail(route.id) : route.name === 'plan' ? planView() : route.name === 'map' ? mapView() : route.name === 'settings' ? settingsView() : home();
		document.querySelectorAll('.tabs a').forEach(function (a) { a.setAttribute('aria-current', a.getAttribute('data-route') === route.name ? 'page' : 'false'); });
		if (route.name === 'debt') afterDetail(route.id);
		if (route.name === 'map') afterMap();
		if (route.name === 'home') showNear();
		updateJar();
		if (keepScroll) window.scrollTo(0, y);
	}
	window.addEventListener('hashchange', function () { render(); window.scrollTo(0, 0); });

	/* every button on every screen */
	view.addEventListener('click', function (ev) {
		var b = ev.target.closest('button, [data-act]');
		if (!b) return;
		var g = function (a) { return b.getAttribute(a); };
		if (g('data-act') === 'add') debtForm();
		else if (b.hasAttribute('data-pay')) entryForm(g('data-pay'), 'pay', +g('data-amt') || 0);
		else if (b.hasAttribute('data-borrow')) entryForm(g('data-borrow'), 'borrow');
		else if (b.hasAttribute('data-edit')) debtForm(S.get(g('data-edit')));
		else if (b.hasAttribute('data-del')) {
			var d = S.get(g('data-del'));
			if (d && confirm(L('أتحذف «' + d.name + '» وسجله؟', 'Delete “' + d.name + '” and its history?'))) { S.removeDebt(d.id); location.hash = '#/'; }
		}
		else if (b.hasAttribute('data-unentry')) {
			if (confirm(L('أتحذف هذا القيد؟', 'Delete this entry?'))) S.removeEntry(route.id, g('data-unentry'));
		}
		else if (b.hasAttribute('data-strategy')) { S.state.settings.strategy = g('data-strategy'); S.save(); }
		else if (b.hasAttribute('data-up') || b.hasAttribute('data-down')) {
			var ids = plan().debts.map(function (x) { return x.id; }), i = +(g('data-up') || g('data-down')), j = b.hasAttribute('data-up') ? i - 1 : i + 1;
			if (j < 0 || j >= ids.length) return;
			var t = ids[i]; ids[i] = ids[j]; ids[j] = t;
			S.state.settings.order = ids; S.save();
		}
		else if (b.hasAttribute('data-export')) exportData(g('data-export'));
		else if (b.hasAttribute('data-wipe')) {
			if (confirm(L('سيُمسح كل دين وكل دفعة من هذا الجهاز. صدّر نسخة أولًا إن أردت. متابعة؟', 'Every debt and payment will be erased from this device. Export a copy first if you want one. Continue?'))) { S.reset(); location.hash = '#/'; }
		}
	});
	view.addEventListener('change', function (ev) {
		var t = ev.target;
		if (t.hasAttribute('data-sort')) { sortBy = t.value; render(true); }
		else if (t.hasAttribute('data-budget')) { S.state.settings.budget = Math.max(0, +t.value || 0); S.save(); }
		else if (t.hasAttribute('data-import')) importData(t);
		else if (t.getAttribute('data-set') === 'nearby') {
			if (t.checked) Places.here().then(function () { S.state.settings.nearby = true; S.save(); checkNearby(true); })
				.catch(function () { t.checked = false; Notify(L('لم يُسمح بمعرفة الموقع.', 'Location wasn’t allowed.'), { type: 'warning' }); });
			else { S.state.settings.nearby = false; S.save(); }
		}
		else if (t.hasAttribute('data-set')) { S.state.settings[t.getAttribute('data-set')] = t.value; S.save(); }
	});

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
				if (!confirm(L('سيحل هذا الملف (' + I18n.num(n) + ' دين) محل ما على هذا الجهاز. متابعة؟', 'This file (' + n + ' debts) will replace what is on this device. Continue?'))) return;
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
				showNear();
				if (list.length) Jar.say(L('عليك هنا ', 'You owe here: ') + money(S.balance(list[0].debt)) + '!', 4000);
				else if (say) Notify(L('سنذكّرك حين تكون قرب مكان عليك فيه دين.', 'We’ll remind you when you’re near a place you owe.'), { type: 'success' });
			}).catch(function () {});
		});
	}
	function showNear() {
		var el = document.getElementById('near');
		if (!el) return;
		var list = near.filter(function (x) { return S.balance(x.debt) > 0; });
		el.innerHTML = list.length ? '<section class="card near"><h2>📍 ' + L('قريب منك', 'Near you') + '</h2><ul class="pay-list">' + list.map(function (x) {
			return '<li><span><b>' + esc(x.debt.name) + '</b> · ' + money(S.balance(x.debt)) + ' <small>' + Places.fmtDistance(x.m) + '</small></span><button type="button" class="btn btn-small" data-pay="' + x.debt.id + '">' + L('ادفع الآن', 'Pay now') + '</button></li>';
		}).join('') + '</ul></section>' : '';
	}

	/* ---------- start ---------- */

	document.getElementById('fab').addEventListener('click', function () { debtForm(); });
	document.getElementById('lang').addEventListener('click', function () {
		S.state.settings.lang = I18n.lang === 'ar' ? 'en' : 'ar'; S.save();
	});
	S.on(function (what) {
		if (what === 'settings' || what === 'import') applySettings();
		render(true);
		if (what === 'add' || what === 'borrow') Jar.react('borrow');
		else if (what === 'pay') Jar.react('pay');
		else if (what === 'paidoff') {
			if (S.total() <= 0) { Jar.react('free'); Notify(L('لا ديون عليك! 🎉', 'You’re debt-free! 🎉'), { type: 'success', ttl: 5000 }); }
			else Jar.react('paidoff');
		}
	});
	applySettings();
	Jar.mount(document.getElementById('jar'));
	render();
	setTimeout(function () { remindDue(); checkNearby(false); }, 900);
	window.App = { render: render, add: function () { debtForm(); } };
})();
