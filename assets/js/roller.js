/* The moving parts, after Pavel Troshkin's «Rolling Counter» and «Time Ruler» (Reactive CSS pens),
   rebuilt here in plain JavaScript:
     Fx.roller(el, parts)        — a number on odometer reels. Each digit is a column 0–9 plus a second 0;
                                   the number drawn eases toward the real one, the units turn all the way and
                                   each higher wheel turns only on the carry, so 99 → 100 turns three wheels at
                                   once. Leading wheels fold away, and the reels blur while they spin.
     Fx.hold(button, step)       — tap to step, hold to repeat (faster the longer you hold).
     Fx.dial(el, get, set, step) — drag the number up or down like a dial, one step every 10 px.
     Fx.ruler(el, opts)          — a ruler under a needle: drag it sideways, flick it and it runs on and
                                   slows to a stop on a tick; the arrow keys step it.
     Fx.gauge(el)                — an arc of ticks with a band that runs from the start to the needle.
   All of it stands still for readers who ask the system for less motion. */
(function () {
	'use strict';

	var reduce = function () { return matchMedia('(prefers-reduced-motion: reduce)').matches; };
	/* close to the pens' cubic-bezier(.2, .9, .25, 1): quick out, long soft landing */
	var ease = function (t) { return 1 - Math.pow(1 - t, 3.4); };
	var esc = function (s) { return I18n.esc(s); };

	/* ---------- the reels ---------- */

	function roller(el, partsOf, opts) {
		opts = opts || {};
		var dur = opts.duration || 700;
		var value = 0, shown = 0, from = 0, to = 0, t0 = 0, raf = 0, key = '';
		var reels = [], folds = [], low = 2;
		el.classList.add('roller');

		/* lay the reels out for the larger of the two numbers, so wheels appear and fold as it rolls */
		function build(a, b) {
			var big = Math.max(Math.abs(a), Math.abs(b));
			var cents = !opts.whole && (Math.round(a * 100) % 100 !== 0 || Math.round(b * 100) % 100 !== 0);
			var parts = partsOf(big, cents);
			var k2 = I18n.lang + '|' + I18n.currency + '|' + parts.map(function (p) { return p.type === 'integer' ? 'd'.repeat(p.value.length) : p.type + p.value; }).join('');
			if (k2 === key) return;
			key = k2;
			var g = I18n.digits(), strip = '<span class="strip">' + g.concat([g[0]]).map(function (d) { return '<i>' + d + '</i>'; }).join('') + '</span>';
			var intLen = parts.filter(function (p) { return p.type === 'integer'; }).reduce(function (s, p) { return s + p.value.length; }, 0);
			var k = intLen + 1, html = '';
			low = cents ? 0 : 2;
			/* the digits and their separators sit in one left-to-right run (as numbers read in Arabic too);
			   the currency sign and spaces stay in the page's direction, on whichever side the language puts them */
			var inNum = false;
			var num = function (on) { if (on !== inNum) { html += on ? '<span class="num" dir="ltr">' : '</span>'; inNum = on; } };
			parts.forEach(function (p) {
				var numeric = p.type === 'integer' || p.type === 'fraction' || p.type === 'group' || p.type === 'decimal';
				if (p.type === 'minusSign') return;
				num(numeric);
				if (p.type === 'integer') for (var i = 0; i < p.value.length; i++) { html += '<span class="reel" data-k="' + k + '" aria-hidden="true">' + strip + '</span>'; k--; }
				else if (p.type === 'fraction') for (var j = 0; j < p.value.length; j++) html += '<span class="reel" data-k="' + (1 - j) + '" aria-hidden="true">' + strip + '</span>';
				else if (p.type === 'group') html += '<span class="sep" data-fold="' + (k + 1) + '" aria-hidden="true">' + esc(p.value) + '</span>';
				else if (p.type === 'decimal') html += '<span class="sep dec" aria-hidden="true">' + esc(p.value) + '</span>';
				else html += '<span class="lit" aria-hidden="true">' + esc(p.value.trim() ? p.value : ' ') + '</span>';
			});
			num(false);
			el.innerHTML = html + '<span class="sr" role="status"></span>';
			reels = [].slice.call(el.querySelectorAll('.reel')).map(function (r) { return { el: r, k: +r.getAttribute('data-k'), strip: r.firstChild }; });
			folds = [].slice.call(el.querySelectorAll('.sep[data-fold]')).map(function (s) { return { el: s, k: +s.getAttribute('data-fold') }; });
		}

		/* draw S (the amount in cents) on the wheels */
		function draw(S) {
			var x = S / Math.pow(10, low);
			reels.forEach(function (r) {
				var rel = r.k - low, d;
				if (rel < 0) return;
				if (rel === 0) d = ((x % 10) + 10) % 10;
				else {
					var p = Math.pow(10, rel);
					d = (Math.floor(x / p) + Math.min(1, Math.max(0, (x % p) - (p - 1)))) % 10;
				}
				r.strip.style.translate = '0 ' + (-d * 1.2).toFixed(3) + 'em';
				/* a wheel above the units shows once the number reaches it, fading in over its last unit */
				var vis = r.k <= 2 ? 1 : Math.min(1, Math.max(0, (S - Math.pow(10, r.k)) / 100 + 1));
				r.el.style.setProperty('--vis', vis.toFixed(3));
			});
			folds.forEach(function (f) {
				var vis = Math.min(1, Math.max(0, (S - Math.pow(10, f.k)) / 100 + 1));
				f.el.style.setProperty('--vis', vis.toFixed(3));
			});
			var left = Math.abs(to - S) / Math.pow(10, low);
			el.style.setProperty('--blur', Math.min(1, left).toFixed(3));
		}

		function frame(now) {
			var t = Math.min(1, (now - t0) / dur);
			shown = from + (to - from) * ease(t);
			draw(shown);
			if (t < 1) raf = requestAnimationFrame(frame);
			else { raf = 0; el.classList.remove('spinning'); }
		}

		function set(v, instant) {
			v = Math.max(0, Math.round((+v || 0) * 100) / 100);
			var before = value;
			value = v;
			build(before, v);
			from = shown; to = Math.round(v * 100);
			el.querySelector('.sr').textContent = opts.label ? opts.label(v) : String(v);
			el.classList.toggle('neg', !!opts.neg);
			if (instant || reduce() || !el.isConnected) { cancelAnimationFrame(raf); raf = 0; shown = to; draw(to); return; }
			t0 = performance.now();
			el.classList.add('spinning');
			if (!raf) raf = requestAnimationFrame(frame);
		}
		/* the language or currency changed: lay it out again */
		function relayout() { key = ''; build(value, value); draw(shown); }

		return { set: set, get: function () { return value; }, relayout: relayout, el: el };
	}

	/* ---------- hold to repeat ---------- */

	function hold(btn, step) {
		var t = 0, n = 0, down = false;
		function stop() { down = false; clearTimeout(t); btn.classList.remove('held'); }
		btn.addEventListener('pointerdown', function (ev) {
			if (ev.button || btn.disabled) return;
			ev.preventDefault();
			down = true; n = 0;
			btn.classList.add('held');
			step(1);
			t = setTimeout(function rep() {
				if (!down) return;
				n++;
				/* faster, and in bigger steps, the longer it is held */
				step(n > 30 ? 10 : n > 14 ? 5 : 1);
				t = setTimeout(rep, n > 8 ? 60 : 110);
			}, 420);
		});
		['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach(function (e) { btn.addEventListener(e, stop); });
		/* the keyboard's Enter and Space come as a click with no pointer */
		btn.addEventListener('click', function (ev) { if (ev.detail === 0) step(1); });
		btn.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
	}

	/* ---------- drag the number like a dial ---------- */

	function dial(el, get, set, stepOf, onTap) {
		var y0 = 0, v0 = 0, moved = false, id = null;
		el.style.touchAction = 'none';
		el.addEventListener('pointerdown', function (ev) {
			if (ev.button) return;
			id = ev.pointerId; y0 = ev.clientY; v0 = get(); moved = false;
			el.setPointerCapture(id);
			el.classList.add('dragging');
		});
		el.addEventListener('pointermove', function (ev) {
			if (ev.pointerId !== id) return;
			var dy = y0 - ev.clientY;
			if (Math.abs(dy) > 4) moved = true;
			if (moved) set(v0 + Math.round(dy / 10) * stepOf());
		});
		function end(ev) {
			if (ev.pointerId !== id) return;
			id = null;
			el.classList.remove('dragging');
			if (!moved && onTap && ev.type === 'pointerup') onTap();
		}
		el.addEventListener('pointerup', end);
		el.addEventListener('pointercancel', end);
	}

	/* ---------- the ruler ---------- */

	var PX = 14, MAJOR = 10, SPAN = 8;	/* px a step, steps a major tick, major ticks drawn each side */
	function ruler(el, o) {
		var v = 0, min = 0, max = Infinity, stepOf = o.step || function () { return 1; };
		var raf = 0, vel = 0, dragging = false, x0 = 0, v0 = 0, lastX = 0, lastT = 0, labelBase = null;
		el.classList.add('ruler');
		el.tabIndex = 0;
		el.setAttribute('role', 'slider');
		el.innerHTML = '<div class="track"></div><div class="labels"></div><span class="needle"></span>';
		var track = el.firstChild, labels = el.children[1];
		var unit = function () { return stepOf(); };

		function paint() {
			var steps = v / unit();
			var off = ((steps % MAJOR) + MAJOR) % MAJOR;
			track.style.translate = (-(off + SPAN * MAJOR) * PX) + 'px 0';
			var base = Math.floor(steps / MAJOR);
			if (base !== labelBase || labels.dataset.u !== String(unit()) + I18n.lang + I18n.currency) {
				labelBase = base; labels.dataset.u = String(unit()) + I18n.lang + I18n.currency;
				var html = '';
				for (var i = -SPAN; i <= SPAN; i++) {
					var amt = (base + i) * MAJOR * unit();
					html += '<span style="--i:' + i + '">' + (amt >= min && amt <= max ? esc(I18n.money(amt, true)) : '') + '</span>';
				}
				labels.innerHTML = html;
			}
			labels.style.translate = (-off * PX) + 'px 0';
			el.setAttribute('aria-valuenow', v); el.setAttribute('aria-valuetext', I18n.money(v));
			el.setAttribute('aria-valuemin', min); if (isFinite(max)) el.setAttribute('aria-valuemax', max);
		}
		function clamp(x) { return Math.max(min, Math.min(max, x)); }
		function snap(x) { var u = unit(); return clamp(Math.round(x / u) * u); }
		function emit() { o.onChange(snap(v)); }

		/* glide to a value: after a flick, or when the amount is set some other way */
		function glide(target, ms) {
			cancelAnimationFrame(raf);
			if (reduce()) { v = target; paint(); return; }
			var a = v, t0 = performance.now();
			(function step(now) {
				var t = Math.min(1, (now - t0) / (ms || 450));
				v = a + (target - a) * ease(t); paint();
				if (t < 1) raf = requestAnimationFrame(step);
			})(t0);
		}
		function coast() {
			cancelAnimationFrame(raf);
			var last = performance.now();
			(function step(now) {
				var dt = Math.min(40, now - last); last = now;
				v = clamp(v + vel * dt);
				vel *= Math.pow(0.994, dt);
				if ((v === min || v === max) && vel !== 0) vel = 0;
				paint(); emit();
				if (Math.abs(vel) > 0.0004 * unit()) raf = requestAnimationFrame(step);
				else { glide(snap(v), 220); emit(); }
			})(last);
		}

		var dir = function () { return 1; };	/* a ruler reads left to right in both languages, as numbers do */
		el.style.touchAction = 'pan-y';
		el.addEventListener('pointerdown', function (ev) {
			if (ev.button) return;
			cancelAnimationFrame(raf);
			dragging = true; x0 = lastX = ev.clientX; lastT = performance.now(); v0 = v; vel = 0;
			el.setPointerCapture(ev.pointerId);
			el.classList.add('dragging');
			if (o.onUse) o.onUse();
		});
		el.addEventListener('pointermove', function (ev) {
			if (!dragging) return;
			var now = performance.now(), dt = Math.max(1, now - lastT);
			/* the hand's speed, in amount per ms, blended so one jittery move doesn't count too much */
			var inst = -(ev.clientX - lastX) * dir() / PX * unit() / dt;
			vel = vel * 0.6 + inst * 0.4;
			lastX = ev.clientX; lastT = now;
			v = clamp(v0 - (ev.clientX - x0) * dir() / PX * unit());
			paint(); emit();
		});
		function up() {
			if (!dragging) return;
			dragging = false;
			el.classList.remove('dragging');
			/* a paused hand throws nothing */
			if (performance.now() - lastT > 90) vel = 0;
			if (Math.abs(vel) > 0.002 * unit() && !reduce()) coast();
			else { glide(snap(v), 200); emit(); }
		}
		el.addEventListener('pointerup', up);
		el.addEventListener('pointercancel', up);
		el.addEventListener('keydown', function (ev) {
			var k = ev.key, d = 0;
			if (k === 'ArrowRight' || k === 'ArrowUp') d = dir() === 1 || k === 'ArrowUp' ? 1 : -1;
			else if (k === 'ArrowLeft' || k === 'ArrowDown') d = dir() === 1 || k === 'ArrowDown' ? -1 : 1;
			else if (k === 'PageUp') d = MAJOR; else if (k === 'PageDown') d = -MAJOR;
			if (!d) return;
			ev.preventDefault();
			v = snap(v + d * unit()); glide(v, 150); emit();
		});

		return {
			set: function (x, instant) { x = clamp(+x || 0); if (dragging) return; if (instant) { cancelAnimationFrame(raf); v = x; paint(); } else glide(x); },
			limits: function (a, b) { min = a; max = b == null ? Infinity : b; v = clamp(v); labelBase = null; paint(); },
			repaint: function () { labelBase = null; paint(); }
		};
	}

	/* ---------- the arc gauge ---------- */

	function gauge(el) {
		var R = 120, CX = 150, CY = 150, A0 = -120, A1 = 120;
		var pt = function (a, r) { var t = (a - 90) * Math.PI / 180; return [(CX + r * Math.cos(t)).toFixed(1), (CY + r * Math.sin(t)).toFixed(1)]; };
		var ticks = '';
		for (var a = A0; a <= A1 + 0.01; a += 6) {
			var major = Math.round((a - A0) / 6) % 5 === 0, p1 = pt(a, R - 14), p2 = pt(a, R - (major ? 34 : 24));
			ticks += '<line x1="' + p1[0] + '" y1="' + p1[1] + '" x2="' + p2[0] + '" y2="' + p2[1] + '" class="' + (major ? 'tk major' : 'tk') + '"/>';
		}
		var s = pt(A0, R), e = pt(A1, R);
		var arc = 'M' + s[0] + ' ' + s[1] + ' A' + R + ' ' + R + ' 0 1 1 ' + e[0] + ' ' + e[1];
		el.classList.add('gauge');
		el.innerHTML = '<svg viewBox="0 0 300 250" aria-hidden="true">' +
			'<path d="' + arc + '" class="g-track" pathLength="100"/>' +
			'<path d="' + arc + '" class="g-band" pathLength="100"/>' + ticks +
			'<g class="g-needle"><line x1="150" y1="150" x2="150" y2="22"/><circle cx="150" cy="150" r="9"/></g></svg>' +
			'<div class="g-read"><span class="g-num"></span><small class="g-cap"></small></div>';
		var band = el.querySelector('.g-band'), needle = el.querySelector('.g-needle');
		var num = roller(el.querySelector('.g-num'), function (n) { return I18n.pctParts(n); }, { whole: true, label: function (n) { return I18n.pct(n / 100); } });
		return {
			set: function (f, caption) {
				f = Math.max(0, Math.min(1, f || 0));
				band.style.strokeDashoffset = (100 - f * 100).toFixed(2);
				needle.style.rotate = (A0 + (A1 - A0) * f).toFixed(2) + 'deg';
				num.set(Math.round(f * 100));
				el.querySelector('.g-cap').textContent = caption || '';
			},
			relayout: function () { num.relayout(); }
		};
	}

	window.Fx = { roller: roller, hold: hold, dial: dial, ruler: ruler, gauge: gauge };
})();
