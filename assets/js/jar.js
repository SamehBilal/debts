/* The debt jar: the man carrying his debt in a green sack, drawn in SVG after
   the cartoon this app started from (a man on all fours under a «DEBT» sack). The sack is the jar — it fills with what is still owed against the
   «peak» on its tag (the most owed since everything was last paid), and it grows with the load.
   How he carries it is the level, 0–4, worked out by the app from the plan and late payments:
     0 free (no debt: he stands, arms up, the empty sack at his feet) · 1 light · 2 fine (as in the
     cartoon) · 3 straining (sweat) · 4 crushed (squashed, shaking)
   Jar.react('borrow' | 'pay' | 'paidoff' | 'free') plays a moment (the sack drops on him, lifts,
   confetti) with a line in a speech bubble; tapping him makes him say something.
   Jar.mount(el), Jar.update({ total, peak, level, money, pieces: [{ id, value, icon, label, tone }] }):
   each piece is a coin in the sack, sized by its value; Jar.onPiece(fn(id, el, 'hover' | 'leave' | 'tap')). */
(function () {
	'use strict';

	var BAG_H = 205;
	var SCALE = [0.55, 0.8, 0.9, 1, 1.08];
	var SQUASH = [1, 1, 0.98, 0.93, 0.86];
	var MOOD = ['grin', 'smile', 'smile', 'strain', 'ouch'];

	function limb(x1, y1, x2, y2, w, color) {
		return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="var(--ink)" stroke-width="' + (w + 6) + '" stroke-linecap="round"/>' +
			'<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round"/>';
	}

	/* his head, facing left, centred near (92, 238); every face is there and the mood shows one */
	function head() {
		return '<g class="head">' +
			'<ellipse cx="122" cy="238" rx="9" ry="12" fill="var(--skin)" stroke="var(--ink)" stroke-width="3"/>' +
			'<ellipse cx="92" cy="238" rx="36" ry="32" fill="var(--skin)" stroke="var(--ink)" stroke-width="3"/>' +
			'<path d="M60 222 L62 200 L74 212 L80 188 L90 208 L100 186 L106 208 L118 194 L118 214 L128 210 L122 228 Q96 206 60 222 Z" fill="var(--hair)" stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"/>' +
			'<ellipse class="blush" cx="98" cy="254" rx="10" ry="6" fill="#ff5a4e"/>' +
			/* eyes */
			'<g class="f eye-open"><ellipse cx="74" cy="230" rx="8" ry="10" fill="#fff" stroke="var(--ink)" stroke-width="2.5"/><circle class="pupil" cx="71" cy="232" r="4" fill="var(--ink)"/></g>' +
			'<path class="f eye-happy" d="M65 233 Q74 220 83 233" fill="none" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round"/>' +
			'<path class="f eye-squint" d="M66 225 L81 231 L66 237" fill="none" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>' +
			'<g class="f eye-wide"><ellipse cx="74" cy="229" rx="10" ry="12" fill="#fff" stroke="var(--ink)" stroke-width="2.5"/><circle cx="72" cy="231" r="2.5" fill="var(--ink)"/></g>' +
			/* brows */
			'<path class="f brow-up" d="M64 214 Q74 207 85 213" fill="none" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round"/>' +
			'<path class="f brow-down" d="M63 211 L86 219" fill="none" stroke="var(--ink)" stroke-width="4" stroke-linecap="round"/>' +
			'<path class="f brow-worry" d="M63 218 L85 209" fill="none" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round"/>' +
			/* nose — big, like the cartoon's */
			'<circle cx="55" cy="246" r="15" fill="var(--skin)" stroke="var(--ink)" stroke-width="3"/>' +
			'<ellipse cx="51" cy="241" rx="4" ry="3" fill="#fff" opacity=".55"/>' +
			/* mouths */
			'<g class="f m-grin"><path d="M62 262 Q76 284 92 260 Z" fill="#7a1f1f" stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"/><path d="M66 263 L89 261 L88 266 Q76 268 67 266 Z" fill="#fff"/></g>' +
			'<path class="f m-smile" d="M64 264 Q77 276 89 262" fill="none" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round"/>' +
			'<g class="f m-strain"><rect x="62" y="259" width="27" height="13" rx="5" fill="#fff" stroke="var(--ink)" stroke-width="3"/><path d="M69 260v11M75.5 260v11M82 260v11M63 265.5h25" stroke="var(--ink)" stroke-width="1.6"/></g>' +
			'<path class="f m-worry" d="M64 271 Q76 261 89 270" fill="none" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round"/>' +
			'<ellipse class="f m-ouch" cx="76" cy="268" rx="7" ry="9" fill="#7a1f1f" stroke="var(--ink)" stroke-width="3"/>' +
			/* sweat and stress */
			'<g class="sweat"><path class="drop d1" d="M120 196 q6 10 0 14 q-6 -4 0 -14z" fill="#7cc8ff" stroke="var(--ink)" stroke-width="1.5"/>' +
			'<path class="drop d2" d="M50 208 q5 8 0 12 q-5 -4 0 -12z" fill="#7cc8ff" stroke="var(--ink)" stroke-width="1.5"/></g>' +
			'<g class="stress" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"><path d="M70 182 l-4 -12"/><path d="M88 178 v-13"/><path d="M106 182 l4 -12"/></g>' +
		'</g>';
	}

	function bag() {
		var body = 'M-22 -' + BAG_H + ' C-46 -192 -104 -160 -106 -94 C-110 -26 -62 0 0 0 C62 0 110 -26 106 -94 C104 -160 46 -192 22 -' + BAG_H + ' Z';
		/* a wide wave, slid sideways forever for the liquid's surface */
		var wave = 'M-260 0';
		for (var x = -260; x < 260; x += 40) wave += ' q10 -7 20 0 t20 0';
		wave += ' V' + (BAG_H + 20) + ' H-260 Z';
		return '<g class="bag-pos" transform="translate(184 240)"><g class="bag-drop"><g class="bag-scale">' +
			'<clipPath id="bagClip"><path d="' + body + '"/></clipPath>' +
			'<ellipse cx="0" cy="2" rx="92" ry="9" fill="#000" opacity=".12"/>' +
			'<path d="' + body + '" fill="var(--bag-empty)"/>' +
			'<g clip-path="url(#bagClip)"><g class="liquid"><g class="wave-slide">' +
				'<path d="' + wave + '" fill="var(--bag-deep)" transform="translate(20 -5)"/>' +
				'<path d="' + wave + '" fill="var(--bag)"/>' +
			'</g></g></g>' +
			'<path class="bag-line" d="M-62 -150 Q-84 -110 -76 -64" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".35"/>' +
			'<path class="bag-line" d="' + body + '" fill="none" stroke="var(--ink)" stroke-width="4" stroke-linejoin="round"/>' +
			/* every open debt, a coin in the sack sized by what is left on it */
			'<g class="pieces"></g>' +
			/* the knot */
			'<path d="M-22 -' + BAG_H + ' C-40 -' + (BAG_H + 26) + ' -12 -' + (BAG_H + 34) + ' 0 -' + (BAG_H + 12) + ' C12 -' + (BAG_H + 34) + ' 40 -' + (BAG_H + 26) + ' 22 -' + BAG_H + ' Z" fill="var(--bag)" stroke="var(--ink)" stroke-width="3.5" stroke-linejoin="round"/>' +
			'<rect x="-24" y="-' + (BAG_H + 6) + '" width="48" height="11" rx="5" fill="var(--bag-deep)" stroke="var(--ink)" stroke-width="3"/>' +
			/* the tag */
			'<g class="tag" transform="translate(-30 -' + (BAG_H + 2) + ') rotate(-14)">' +
				'<path d="M0 0 L-12 22" stroke="var(--ink)" stroke-width="2"/>' +
				'<g transform="translate(-58 18)"><rect width="62" height="34" rx="8" fill="var(--bag)" stroke="var(--ink)" stroke-width="3"/>' +
				'<text class="tag-a" x="31" y="14" text-anchor="middle"></text><text class="tag-b" x="31" y="28" text-anchor="middle"></text></g>' +
			'</g>' +
			'<text class="bag-word" x="0" y="-92" text-anchor="middle"></text>' +
			'<text class="bag-sum" x="0" y="-54" text-anchor="middle"></text>' +
		'</g></g></g>';
	}

	function crawl() {
		return '<g class="crawl">' +
			/* far leg and arm */
			limb(238, 282, 226, 336, 28, 'var(--jeans-deep)') + limb(226, 338, 292, 342, 22, 'var(--jeans-deep)') +
			'<path d="M286 330 q26 -6 34 12 q2 8 -6 8 h-30 z" fill="var(--shoe-deep)" stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"/>' +
			limb(140, 272, 134, 306, 22, 'var(--shirt-deep)') + limb(134, 308, 128, 334, 16, 'var(--skin-deep)') +
			'<ellipse cx="122" cy="341" rx="14" ry="8" fill="var(--skin-deep)" stroke="var(--ink)" stroke-width="3"/>' +
			/* the body */
			'<circle cx="238" cy="276" r="30" fill="var(--jeans)" stroke="var(--ink)" stroke-width="3"/>' +
			limb(130, 262, 220, 266, 56, 'var(--shirt)') +
			'<path d="M206 240 v52" stroke="var(--shirt-deep)" stroke-width="4" opacity=".6"/>' +
			/* near leg */
			limb(250, 288, 240, 340, 28, 'var(--jeans)') + limb(240, 342, 304, 346, 22, 'var(--jeans)') +
			'<path d="M298 332 q28 -6 36 13 q2 8 -6 8 h-32 z" fill="var(--shoe)" stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"/>' +
			'<path d="M306 342 h22" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' +
			bag() +
			/* near arm, then the head over everything */
			limb(158, 274, 154, 308, 22, 'var(--shirt)') + limb(154, 310, 148, 336, 16, 'var(--skin)') +
			'<ellipse cx="142" cy="344" rx="15" ry="9" fill="var(--skin)" stroke="var(--ink)" stroke-width="3"/>' +
			head() +
		'</g>';
	}

	function free() {
		return '<g class="free">' +
			/* the empty sack at his feet */
			'<g transform="translate(292 350)"><path d="M-46 0 Q-50 -16 -20 -18 Q0 -26 24 -18 Q50 -16 46 0 Z" fill="var(--bag-empty)" stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"/>' +
			'<path d="M20 -18 q14 -14 22 -2 q-10 4 -22 2z" fill="var(--bag)" stroke="var(--ink)" stroke-width="2.5"/>' +
			'<text class="free-0" x="0" y="-5" text-anchor="middle">0</text></g>' +
			'<g class="jump">' +
			limb(180, 284, 172, 338, 26, 'var(--jeans)') + limb(200, 284, 208, 338, 26, 'var(--jeans)') +
			'<path d="M150 336 q20 -8 30 2 q2 10 -6 10 h-26 q-6 -6 2 -12z" fill="var(--shoe)" stroke="var(--ink)" stroke-width="3"/>' +
			'<path d="M200 338 q14 -10 30 -2 q8 6 2 12 h-28 q-8 0 -4 -10z" fill="var(--shoe)" stroke="var(--ink)" stroke-width="3"/>' +
			'<circle cx="190" cy="278" r="27" fill="var(--jeans)" stroke="var(--ink)" stroke-width="3"/>' +
			limb(166, 216, 146, 182, 20, 'var(--shirt)') + limb(146, 180, 140, 150, 15, 'var(--skin)') +
			limb(214, 216, 234, 182, 20, 'var(--shirt)') + limb(234, 180, 240, 150, 15, 'var(--skin)') +
			'<circle cx="139" cy="140" r="11" fill="var(--skin)" stroke="var(--ink)" stroke-width="3"/>' +
			'<circle cx="241" cy="140" r="11" fill="var(--skin)" stroke="var(--ink)" stroke-width="3"/>' +
			limb(190, 210, 190, 262, 58, 'var(--shirt)') +
			'<g transform="translate(100 -70)">' + head() + '</g>' +
			'</g>' +
		'</g>';
	}

	var root, svg, bubble, state = { level: 2, total: 0, peak: 0 }, reacting = 0, bubbleTimer = 0;

	function mount(el) {
		root = el;
		root.innerHTML =
			'<div class="jar-bubble" aria-live="polite"></div>' +
			'<svg class="jar-svg" viewBox="0 0 360 380" role="img" aria-labelledby="jar-title">' +
				'<title id="jar-title"></title>' +
				'<ellipse class="ground" cx="190" cy="354" rx="150" ry="13"/>' +
				crawl() + free() +
				'<g class="confetti"></g>' +
			'</svg>';
		svg = root.querySelector('svg');
		bubble = root.querySelector('.jar-bubble');
		svg.addEventListener('click', function (ev) {
			var pc = ev.target.closest('.piece');
			if (pc) { if (onPiece) onPiece(pc.getAttribute('data-id'), pc, 'tap'); return; }
			say(pick(LINES['tap' + state.level])); poke();
		});
		svg.addEventListener('keydown', function (ev) {
			var pc = ev.target.closest('.piece');
			if (pc && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); if (onPiece) onPiece(pc.getAttribute('data-id'), pc, 'tap'); }
		});
		/* a mouse resting on a coin peeks at it; a finger taps instead */
		svg.addEventListener('pointerover', function (ev) {
			var pc = ev.pointerType === 'mouse' && ev.target.closest('.piece');
			if (pc && onPiece) onPiece(pc.getAttribute('data-id'), pc, 'hover');
		});
		svg.addEventListener('pointerout', function (ev) {
			var pc = ev.pointerType === 'mouse' && ev.target.closest('.piece');
			if (pc && !pc.contains(ev.relatedTarget) && onPiece) onPiece(pc.getAttribute('data-id'), pc, 'leave');
		});
		svg.style.cursor = 'pointer';
	}

	/* ---------- the coins in the sack ---------- */

	var onPiece = null, piecesKey = '';
	/* room in the sack for a coin of radius r at (x, y), the sack's bottom centre at 0, 0 */
	function fits(x, y, r) {
		var rx = 100 - r - 5, ry = 98 - r - 5;
		if (rx <= 0 || ry <= 0 || y - r < -168) return false; /* clear of the neck and the tag */
		if (x - r * 0.4 < -44 && y + r * 0.4 > -74) return false; /* and of his head, over the sack's lower left */
		var dx = x / rx, dy = (y + 100) / ry;
		return dx * dx + dy * dy <= 1;
	}
	/* biggest first, each dropped as low as it will go, nearest the middle */
	function pack(list) {
		/* area grows a little slower than the amount, so a small debt is still a coin you can tap */
		var w = function (p) { return Math.pow(Math.max(1, p.value), 0.7); };
		var total = list.reduce(function (a, p) { return a + w(p); }, 0);
		var k = Math.sqrt(4000 / Math.max(1, total)), placed = [];
		for (var tries = 0; tries < 10; tries++) {
			var ok = true;
			placed = [];
			for (var i = 0; i < list.length && ok; i++) {
				var r = Math.max(13, Math.min(58, k * Math.sqrt(w(list[i])))), spot = null;
				for (var y = -r - 6; y > -196 && !spot; y -= 3) {
					for (var s = 0; s <= 100 && !spot; s += 3) {
						for (var sg = 1; sg >= -1 && !spot; sg -= 2) {
							var x = s * sg;
							if (!fits(x, y, r)) continue;
							var clear = placed.every(function (q) { var dx = q.x - x, dy = q.y - y; return dx * dx + dy * dy >= (q.r + r + 3) * (q.r + r + 3); });
							if (clear) spot = { x: x, y: y, r: r, p: list[i] };
						}
					}
				}
				if (spot) placed.push(spot); else ok = false;
			}
			if (ok) return placed;
			k *= 0.85;
		}
		return placed;
	}
	function drawPieces(list, money) {
		var g = svg.querySelector('.pieces');
		var key = JSON.stringify(list) + money(1);
		svg.classList.toggle('has-pieces', list.length > 0);
		if (key === piecesKey) return;
		piecesKey = key;
		list = list.slice().sort(function (a, b) { return b.value - a.value; });
		g.innerHTML = pack(list).map(function (c, i) {
			var p = c.p, r = c.r.toFixed(1), inner = '';
			if (c.r >= 17) inner += '<text class="pc-icon" y="' + (c.r >= 28 ? -c.r * 0.12 : c.r * 0.3).toFixed(1) + '" font-size="' + (c.r * (c.r >= 28 ? 0.62 : 0.85)).toFixed(1) + '" text-anchor="middle">' + p.icon + '</text>';
			if (c.r >= 28) inner += '<text class="pc-amt" y="' + (c.r * 0.55).toFixed(1) + '" font-size="' + Math.min(17, c.r * 0.34).toFixed(1) + '" text-anchor="middle">' + I18n.esc(money(p.value, true)) + '</text>';
			return '<g class="piece tone-' + p.tone + '" data-id="' + p.id + '" tabindex="0" role="button" aria-label="' + I18n.esc(p.label) + '" transform="translate(' + c.x.toFixed(1) + ' ' + c.y.toFixed(1) + ')">' +
				'<g class="pc" style="animation-delay:' + (i * 0.05).toFixed(2) + 's">' +
				'<circle class="pc-coin" r="' + r + '"/><circle class="pc-ring" r="' + (c.r * 0.8).toFixed(1) + '"/>' + inner + '</g></g>';
		}).join('');
	}
	function pieceAt(id) { return svg && svg.querySelector('.piece[data-id="' + id + '"]'); }

	function setFace(mood) {
		var faces = {
			grin: ['eye-happy', 'brow-up', 'm-grin'],
			smile: ['eye-open', 'brow-up', 'm-smile'],
			strain: ['eye-squint', 'brow-down', 'm-strain'],
			worry: ['eye-wide', 'brow-worry', 'm-worry'],
			ouch: ['eye-squint', 'brow-worry', 'm-ouch'],
			relief: ['eye-happy', 'brow-up', 'm-smile']
		}[mood] || [];
		svg.querySelectorAll('.f').forEach(function (n) {
			var on = faces.some(function (c) { return n.classList.contains(c); });
			n.style.display = on ? '' : 'none';
		});
	}

	function update(s) {
		if (!svg) return;
		state = s;
		var lv = s.level;
		var f = s.peak > 0 ? Math.max(0.06, Math.min(1, s.total / s.peak)) : 0;
		svg.setAttribute('data-level', lv);
		svg.style.setProperty('--bag-scale', SCALE[lv]);
		svg.style.setProperty('--squash', SQUASH[lv]);
		svg.style.setProperty('--fill', (-BAG_H - 3 + (1 - f) * (BAG_H + 6)).toFixed(1) + 'px');
		svg.style.setProperty('--blush', [0, 0, 0.15, 0.45, 0.8][lv]);
		if (!reacting) setFace(MOOD[lv]);
		svg.querySelector('.bag-word').textContent = L('دَين', 'DEBT');
		svg.querySelector('.bag-sum').textContent = s.money(s.total, true);
		svg.querySelector('.tag-a').textContent = L('الذروة', 'PEAK');
		svg.querySelector('.tag-b').textContent = s.money(s.peak, true);
		drawPieces(lv ? s.pieces || [] : [], s.money);
		svg.querySelector('#jar-title').textContent = lv === 0
			? L('لا ديون: الرجل واقف رافعًا ذراعيه والكيس فارغ.', 'No debt: the man stands with his arms up, the sack empty.')
			: L('الرجل يحمل كيس الدين ممتلئًا بنسبة ', 'The man carries the debt sack, filled to ') + I18n.pct(f) + L(' من الذروة.', ' of the peak.');
	}

	/* ---------- moments ---------- */

	var LINES = {
		borrow: [['آخ!', 'Oof!'], ['كمان؟!', 'More?!'], ['ظهري!', 'My back!'], ['تقلت…', 'Heavier…']],
		pay: [['الحمد لله!', 'Phew!'], ['خفّت شوية!', 'Lighter!'], ['كمّل كده!', 'Keep going!'], ['أخيرًا نفَس!', 'I can breathe!']],
		paidoff: [['خلصنا منه!', 'One down!'], ['واحد راح!', 'Free from that one!']],
		free: [['حر أخيرًا!', 'Debt free!!'], ['ولا قرش عليّا!', 'Not a penny owed!']],
		tap0: [['ولا قرش عليّا!', 'Nothing on my back!'], ['خفيف زي الريشة.', 'Light as a feather.'], ['خلّينا كده على طول.', 'Let’s keep it this way.']],
		tap1: [['عادي، مقدور عليها.', 'This is fine.'], ['سهلة!', 'Easy, I’ve got this.']],
		tap2: [['تقيلة شوية.', 'Just a little heavy.'], ['قسط قسط.', 'One payment at a time.'], ['ماشيين.', 'We’re getting there.']],
		tap3: [['بدأت تتقل…', 'Getting… heavy…'], ['ادفع حاجة ربنا يكرمك!', 'A payment would really help!']],
		tap4: [['الحقوني…', 'Help…'], ['مش قادر…', 'Can’t… hold… much longer…'], ['فيه حاجة متأخرة!', 'Something is overdue!']]
	};
	function pick(list) { var x = list[Math.floor(Math.random() * list.length)]; return L(x[0], x[1]); }

	function say(text, ms) {
		if (!bubble) return;
		clearTimeout(bubbleTimer);
		bubble.textContent = text;
		bubble.classList.remove('show');
		void bubble.offsetWidth;
		bubble.classList.add('show');
		bubbleTimer = setTimeout(function () { bubble.classList.remove('show'); }, ms || 2600);
	}

	function play(cls, mood, ms) {
		clearTimeout(reacting);
		svg.classList.remove('r-thud', 'r-lift', 'r-cheer', 'r-poke');
		void svg.getBoundingClientRect();
		svg.classList.add(cls);
		if (mood) setFace(mood);
		reacting = setTimeout(function () { svg.classList.remove(cls); reacting = 0; setFace(MOOD[state.level]); }, ms);
	}
	function poke() { if (!reacting) play('r-poke', state.level >= 3 ? 'worry' : null, 600); }

	function confetti() {
		var g = svg.querySelector('.confetti'), colors = ['#f28c28', '#2e9d4f', '#2f6fd0', '#ffd23f', '#ff5a4e'], html = '';
		for (var i = 0; i < 36; i++) {
			var x = 60 + Math.random() * 240, r = Math.random() * 360, dx = (Math.random() - 0.5) * 120;
			html += '<rect width="8" height="12" x="-4" y="-6" fill="' + colors[i % colors.length] + '" style="--x:' + x.toFixed(0) + 'px;--dx:' + dx.toFixed(0) + 'px;--r:' + r.toFixed(0) + 'deg;animation-delay:' + (Math.random() * 0.3).toFixed(2) + 's"/>';
		}
		g.innerHTML = html;
		setTimeout(function () { g.innerHTML = ''; }, 2200);
	}

	function react(what) {
		if (!svg) return;
		var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (what === 'borrow' || what === 'add') { if (!reduce) play('r-thud', 'ouch', 1000); say(pick(LINES.borrow)); }
		else if (what === 'pay') { if (!reduce) play('r-lift', 'relief', 1100); say(pick(LINES.pay)); }
		else if (what === 'paidoff') { if (!reduce) { play('r-lift', 'relief', 1100); confetti(); } say(pick(LINES.paidoff)); }
		else if (what === 'free') { if (!reduce) confetti(); say(pick(LINES.free), 3500); }
	}

	window.Jar = { mount: mount, update: update, react: react, say: say, pieceAt: pieceAt, onPiece: function (fn) { onPiece = fn; } };
})();
