/* The debt jar: a grown man carrying his debt in a green sack, drawn in SVG in a flat editorial
   style (thin even outlines, muted clothes) after the picture this app started from: a man on all
   fours under a «DEBT» sack. The sack is the jar — it fills with what is still owed against the
   «peak» on its tag (the most owed since everything was last paid), and it grows with the load.
   How he carries it is the level, 0–4, worked out by the app from the plan and late payments:
     0 free (no debt: he stands upright, one fist up, the empty sack beside him) · 1 light, calm ·
     2 tired · 3 straining · 4 crushed (gritted teeth, sweat, shaking)
   Jar.react('borrow' | 'pay' | 'paidoff' | 'free') plays a moment (the sack drops on him, lifts,
   confetti) with a line in a speech bubble; tapping him makes him say something.
   Jar.mount(el), Jar.update({ total, peak, level, money, pieces: [{ id, value, icon, label, tone }] }):
   each piece is a coin in the sack, sized by its value; Jar.onPiece(fn(id, el, 'hover' | 'leave' | 'tap')). */
(function () {
	'use strict';

	var BAG_H = 205;
	var SCALE = [0.55, 0.8, 0.9, 1, 1.08];
	var SQUASH = [1, 1, 0.98, 0.93, 0.86];
	var MOOD = ['grin', 'smile', 'tired', 'strain', 'grit'];

	var LW = 2.2; /* one thin, even outline everywhere */
	function limb(x1, y1, x2, y2, w, color) {
		return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="var(--ink)" stroke-width="' + (w + LW * 2) + '" stroke-linecap="round"/>' +
			'<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round"/>';
	}

	/* his head, three-quarters to the left, drawn around (0, 0): adult proportions, a short neat
	   cut, a real jaw with a little stubble. Every face is there and the mood shows one. */
	var S = ' fill="none" stroke="var(--ink)" stroke-width="' + LW + '" stroke-linecap="round" stroke-linejoin="round"';
	function head(x, y) {
		return '<g transform="translate(' + x + ' ' + y + ') scale(1.12)"><g class="head">' +
			/* the face, forehead to nose to chin to jaw */
			'<path d="M15 -6 Q16 -21 0 -21 Q-14 -21 -15 -8 L-16 -3 L-19.5 4 L-16 6 L-15.5 10 Q-15 18 -8 21 Q0 23 8 16 L13.5 8 Q16 2 15 -6 Z" fill="var(--skin)" stroke="var(--ink)" stroke-width="' + LW + '" stroke-linejoin="round"/>' +
			'<path d="M-15.3 11 Q-15 18 -8 21 Q0 23 8 16 L12 10 Q2 15.5 -6 13.5 Q-12 12.5 -15.3 11 Z" fill="var(--stubble)"/>' +
			/* hair, short and neat */
			'<path d="M15.5 -4 Q18 -24 0 -24.5 Q-15 -24 -16.5 -10 Q-9 -16.5 3 -15 Q11 -13 12.5 -3 Z" fill="var(--hair)" stroke="var(--ink)" stroke-width="' + LW + '" stroke-linejoin="round"/>' +
			'<path d="M8 -2 Q14 -4 13.5 4 Q13 9 8.5 8"' + S.replace('fill="none"', 'fill="var(--skin)"') + '/>' +
			/* eyes */
			'<g class="f eye-open"><path d="M-11.5 -6.5 Q-8.5 -8.5 -5 -6.5"' + S + '/><circle cx="-8.5" cy="-4.6" r="1.6" fill="var(--ink)"/></g>' +
			'<path class="f eye-happy" d="M-11.5 -4.5 Q-8.5 -7.5 -5 -4.5"' + S + '/>' +
			'<g class="f eye-squint"><path d="M-11.8 -5 L-4.8 -5.4"' + S + '/><path d="M-10 -4.4 Q-8.4 -2.6 -6.6 -4.4" fill="var(--ink)"/></g>' +
			'<g class="f eye-wide"><circle cx="-8.5" cy="-5" r="2.8" fill="#fff" stroke="var(--ink)" stroke-width="1.6"/><circle cx="-9.2" cy="-4.8" r="1.2" fill="var(--ink)"/></g>' +
			'<path class="bags" d="M-11 -1.2 Q-8.4 0.2 -5.6 -1.2" fill="none" stroke="var(--ink)" stroke-width="1.2" stroke-linecap="round" opacity=".45"/>' +
			/* brows */
			'<path class="f brow-up" d="M-12.5 -11 Q-8.5 -13 -4 -11.5"' + S + '/>' +
			'<path class="f brow-down" d="M-12.5 -8.8 L-4 -10.8"' + S + '/>' +
			'<path class="f brow-worry" d="M-12.5 -12 L-4 -9.5"' + S + '/>' +
			/* mouths: calm, content, gritted, tired, winded */
			'<path class="f m-grin" d="M-15 12 Q-11.5 15.5 -7 12.8"' + S + '/>' +
			'<path class="f m-smile" d="M-14.8 13 Q-11.5 14.6 -8 13"' + S + '/>' +
			'<g class="f m-strain"><rect x="-15.5" y="10.8" width="9" height="4.4" rx="1.2" fill="#fff" stroke="var(--ink)" stroke-width="1.6"/><path d="M-12.5 10.8v4.4M-9.5 10.8v4.4M-15.5 13h9" stroke="var(--ink)" stroke-width=".9"/></g>' +
			'<path class="f m-worry" d="M-14.8 14.2 Q-11.5 12.4 -8 14"' + S + '/>' +
			'<ellipse class="f m-ouch" cx="-11.5" cy="13.4" rx="2.2" ry="2.8" fill="#4a2420" stroke="var(--ink)" stroke-width="1.4"/>' +
			/* a bead of sweat, and the strain over him */
			'<g class="sweat"><path class="drop d1" d="M4 -16 q3.5 6 0 8 q-3.5 -2 0 -8z" fill="#9cc7e8" stroke="var(--ink)" stroke-width="1.2"/>' +
			'<path class="drop d2" d="M-3 -20 q3 5 0 7 q-3 -2 0 -7z" fill="#9cc7e8" stroke="var(--ink)" stroke-width="1.2"/></g>' +
			'<g class="stress" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round"><path d="M-10 -30 l-2 -7"/><path d="M0 -32 v-7"/><path d="M10 -30 l2 -7"/></g>' +
		'</g></g>';
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
			'<path class="bag-line" d="' + body + '" fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/>' +
			/* every open debt, a coin in the sack sized by what is left on it */
			'<g class="pieces"></g>' +
			/* the knot */
			'<path d="M-22 -' + BAG_H + ' C-40 -' + (BAG_H + 26) + ' -12 -' + (BAG_H + 34) + ' 0 -' + (BAG_H + 12) + ' C12 -' + (BAG_H + 34) + ' 40 -' + (BAG_H + 26) + ' 22 -' + BAG_H + ' Z" fill="var(--bag)" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/>' +
			'<rect x="-24" y="-' + (BAG_H + 6) + '" width="48" height="11" rx="5" fill="var(--bag-deep)" stroke="var(--ink)" stroke-width="2.5"/>' +
			/* the tag */
			'<g class="tag" transform="translate(-30 -' + (BAG_H + 2) + ') rotate(-14)">' +
				'<path d="M0 0 L-12 22" stroke="var(--ink)" stroke-width="1.6"/>' +
				'<g transform="translate(-58 18)"><rect width="62" height="34" rx="8" fill="var(--bag)" stroke="var(--ink)" stroke-width="2.5"/>' +
				'<text class="tag-a" x="31" y="14" text-anchor="middle"></text><text class="tag-b" x="31" y="28" text-anchor="middle"></text></g>' +
			'</g>' +
			'<text class="bag-word" x="0" y="-92" text-anchor="middle"></text>' +
			'<text class="bag-sum" x="0" y="-54" text-anchor="middle"></text>' +
		'</g></g></g>';
	}

	/* on all fours under the sack, facing left: the sack's bottom sits on his back at (184, 240) */
	function crawl() {
		var o = ' stroke="var(--ink)" stroke-width="' + LW + '" stroke-linejoin="round"';
		return '<g class="crawl">' +
			/* far leg and arm, a shade darker */
			limb(244, 278, 242, 340, 24, 'var(--jeans-deep)') + limb(242, 341, 300, 345, 18, 'var(--jeans-deep)') +
			'<path d="M296 336 L318 338 Q328 340 328 348 L328 352 L296 352 Z" fill="var(--shoe-deep)"' + o + '/>' +
			limb(150, 262, 148, 300, 17, 'var(--shirt-deep)') + limb(148, 302, 151, 338, 11, 'var(--skin-deep)') +
			'<ellipse cx="148" cy="344" rx="10" ry="4.5" fill="var(--skin-deep)"' + o + '/>' +
			/* the neck, then the body: shirt to the belt, trousers over the hips */
			limb(138, 258, 114, 274, 13, 'var(--skin)') +
			'<path d="M124 258 Q128 241 156 240 L240 243 L240 293 L150 293 Q127 291 124 270 Z" fill="var(--shirt)"' + o + '/>' +
			'<path d="M136 288 Q186 296 238 289" fill="none" stroke="var(--shirt-deep)" stroke-width="5" opacity=".55"/>' +
			'<path d="M128 252 L141 247 L139 259" fill="var(--shirt-deep)"' + o + '/>' +
			'<path d="M240 243 L252 243 Q273 246 273 268 Q273 291 252 293 L240 293 Z" fill="var(--jeans)"' + o + '/>' +
			'<path d="M231 243 L241 243 L241 293 L231 293 Z" fill="var(--belt)"' + o + '/>' +
			/* near leg */
			limb(252, 282, 250, 343, 26, 'var(--jeans)') + limb(250, 344, 308, 348, 20, 'var(--jeans)') +
			'<path d="M304 338 L328 340 Q338 342 338 350 L338 354 L304 354 Z" fill="var(--shoe)"' + o + '/>' +
			'<path d="M306 351 H336" stroke="var(--shoe-deep)" stroke-width="2.5"/>' +
			bag() +
			/* near arm, a rolled sleeve, then the head over everything */
			limb(160, 266, 157, 305, 19, 'var(--shirt)') +
			'<path d="M147 300 L168 302" stroke="var(--shirt-deep)" stroke-width="4" stroke-linecap="round"/>' +
			limb(157, 307, 161, 340, 12, 'var(--skin)') +
			'<ellipse cx="158" cy="347" rx="11.5" ry="5" fill="var(--skin)"' + o + '/>' +
			head(100, 280) +
		'</g>';
	}

	/* no debt: he stands upright, shoulders down, one fist up; the empty sack set beside him */
	function free() {
		var o = ' stroke="var(--ink)" stroke-width="' + LW + '" stroke-linejoin="round"';
		return '<g class="free">' +
			'<g transform="translate(292 350)"><path d="M-46 0 Q-50 -16 -20 -18 Q0 -26 24 -18 Q50 -16 46 0 Z" fill="var(--bag-empty)"' + o + '/>' +
			'<path d="M20 -18 q14 -14 22 -2 q-10 4 -22 2z" fill="var(--bag)" stroke="var(--ink)" stroke-width="' + LW + '"/>' +
			'<text class="free-0" x="0" y="-5" text-anchor="middle">0</text></g>' +
			'<g class="jump">' +
			/* legs and shoes */
			limb(158, 226, 154, 336, 21, 'var(--jeans)') + limb(181, 226, 186, 336, 21, 'var(--jeans)') +
			'<path d="M138 336 H160 Q166 337 166 344 V351 H132 Q132 337 138 336 Z" fill="var(--shoe)"' + o + '/>' +
			'<path d="M180 336 H198 Q208 338 210 346 V351 H178 Z" fill="var(--shoe)"' + o + '/>' +
			/* the relaxed arm, behind */
			limb(147, 126, 139, 172, 15, 'var(--shirt)') + limb(139, 174, 141, 210, 11, 'var(--skin)') +
			'<ellipse cx="141" cy="216" rx="6" ry="8" fill="var(--skin)"' + o + '/>' +
			/* the neck and the body: shirt, belt, trousers */
			limb(169, 104, 169, 118, 12, 'var(--skin)') +
			'<path d="M146 220 L148 206 L192 206 L194 220 L192 232 L148 232 Z" fill="var(--jeans)"' + o + '/>' +
			'<path d="M145 120 Q169 110 193 120 L198 160 L193 208 L147 208 L141 160 Z" fill="var(--shirt)"' + o + '/>' +
			'<path d="M160 115 L169 128 L178 115" fill="none" stroke="var(--ink)" stroke-width="' + LW + '" stroke-linejoin="round"/>' +
			'<path d="M169 130 V204" stroke="var(--shirt-deep)" stroke-width="2"/>' +
			'<path d="M147 204 H193 V212 H147 Z" fill="var(--belt)"' + o + '/>' +
			'<rect x="164" y="203.5" width="10" height="9" rx="1.5" fill="none" stroke="#c9b27a" stroke-width="1.6"/>' +
			/* the other arm up, a fist */
			limb(190, 126, 213, 98, 15, 'var(--shirt)') + limb(214, 96, 220, 64, 11, 'var(--skin)') +
			'<circle cx="221" cy="56" r="8.5" fill="var(--skin)"' + o + '/>' +
			'<path d="M215 53 h10" stroke="var(--ink)" stroke-width="1.2" stroke-linecap="round"/>' +
			head(170, 86) +
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
			tired: ['eye-squint', 'brow-up', 'm-worry'],
			strain: ['eye-squint', 'brow-down', 'm-worry'],
			grit: ['eye-squint', 'brow-worry', 'm-strain'],
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
		borrow: [['تاني؟', 'Another one.'], ['ماشي، هنشيلها.', 'Fine. I’ll carry it.'], ['الحِمل زاد.', 'That’s heavier.'], ['اتسجّلت.', 'Noted.']],
		pay: [['أحسن.', 'Better.'], ['دي فرقت.', 'That helps.'], ['خطوة كمان.', 'One step closer.'], ['أخيرًا نفَس.', 'Some air, finally.']],
		paidoff: [['واحد خلص.', 'One less.'], ['الحساب ده اتقفل.', 'That account is closed.']],
		free: [['ولا مليم عليّا.', 'Nothing owed. At last.'], ['خلصنا.', 'All clear.']],
		tap0: [['مفيش حاجة على ضهري.', 'Nothing on my back.'], ['كده أريح.', 'This is what light feels like.'], ['نخليها كده.', 'Let’s keep it this way.']],
		tap1: [['تحت السيطرة.', 'Under control.'], ['مقدور عليها.', 'Manageable.']],
		tap2: [['تقيلة، بس ماشية.', 'Heavy, but moving.'], ['قسط ورا قسط.', 'One payment at a time.'], ['ماشيين.', 'We’re getting there.']],
		tap3: [['ده بدأ يتعب.', 'This is starting to wear on me.'], ['دفعة دلوقتي هتفرق.', 'A payment now would help.']],
		tap4: [['مش هقدر كتير.', 'I can’t hold this much longer.'], ['فيه حاجة متأخرة.', 'Something is overdue.']]
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
		var g = svg.querySelector('.confetti'), colors = ['#c9a24a', '#4f8a62', '#4a6680', '#d9675b', '#9a8a78'], html = '';
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
