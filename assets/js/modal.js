/* Modals that grow out of the button that opened them, and shrink back into it.
   Each one is a <dialog> opened with showModal (focus stays inside, the page behind is inert).
   They close with ×, Escape, a tap outside, or Back: every open modal adds a history entry
   holding the ids of the modals open at that point, so Back closes the top one.
   Focus goes back to the button. Modal.open(dlg, { onClose }), Modal.close(dlg) for a person
   closing it (goes through history), Modal.hide(dlg) for the app closing it. */
(function () {
	'use strict';

	var stack = [], pressed = null, pressedAt = 0;
	var reduce = function () { return matchMedia('(prefers-reduced-motion: reduce)').matches; };

	/* the button that opens a modal is the last thing pressed */
	function remember(ev) {
		var t = ev.target && ev.target.closest && ev.target.closest('button, a, [role="button"], .piece, summary, label');
		if (t) { pressed = t; pressedAt = Date.now(); }
	}
	document.addEventListener('pointerdown', remember, true);
	document.addEventListener('click', remember, true);
	document.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') remember(ev); }, true);
	function opener() {
		if (pressed && pressed.isConnected && Date.now() - pressedAt < 1500) return pressed;
		var a = document.activeElement;
		return a && a !== document.body ? a : null;
	}
	function rectOf(el) {
		if (!el || !el.isConnected) return null;
		var r = el.getBoundingClientRect();
		return r.width && r.height ? r : null;
	}
	function ids() { return stack.map(function (d) { return d.id; }); }

	/* the modal's box drawn first over the button, then grown to its own place (FLIP) */
	function frames(dlg, from) {
		var o = rectOf(from), r = dlg.getBoundingClientRect();
		if (!o || !r.width) return [{ transform: 'translateY(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }];
		return [
			{ transform: 'translate(' + (o.left - r.left).toFixed(1) + 'px,' + (o.top - r.top).toFixed(1) + 'px) scale(' + (o.width / r.width).toFixed(4) + ',' + (o.height / r.height).toFixed(4) + ')', opacity: 0.5 },
			{ transform: 'none', opacity: 1 }
		];
	}
	function fadeKids(dlg, back) {
		for (var i = 0; i < dlg.children.length; i++)
			dlg.children[i].animate(back ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }], { duration: back ? 150 : 340, fill: back ? 'forwards' : 'none' });
	}

	function open(dlg, opts) {
		if (!dlg) return;
		opts = opts || {};
		if (opts.onClose) dlg._onClose = opts.onClose;
		if (dlg.open) {
			/* asked again while shrinking away: stay */
			if (dlg._closing) { dlg._closing = false; if (dlg._anim) dlg._anim.cancel(); for (var i = 0; i < dlg.children.length; i++) dlg.children[i].getAnimations().forEach(function (a) { a.cancel(); }); }
			return;
		}
		var from = opener();
		dlg._from = from && !dlg.contains(from) ? from : null;
		dlg.style.transformOrigin = '0 0';
		dlg.showModal();
		stack.push(dlg);
		history.pushState({ modals: ids() }, '');
		document.documentElement.classList.add('modal-open');
		if (!reduce()) {
			dlg._anim = dlg.animate(frames(dlg, dlg._from), { duration: 340, easing: 'cubic-bezier(.2, .9, .25, 1)' });
			fadeKids(dlg, false);
		}
		if (opts.onOpen) setTimeout(opts.onOpen, reduce() ? 0 : 350);
	}

	/* the app closes it: shrink back into its button, then close */
	function hide(dlg) {
		if (!dlg || !dlg.open || dlg._closing) return;
		dlg._closing = true;
		if (reduce()) { dlg.close(); return; }
		var k = frames(dlg, dlg._from).reverse();
		fadeKids(dlg, true);
		dlg._anim = dlg.animate(k, { duration: 240, easing: 'cubic-bezier(.4, 0, .8, .4)', fill: 'forwards' });
		dlg._anim.onfinish = function () { if (dlg._closing) dlg.close(); };
	}

	/* a person closes it: through history, so Back and × agree */
	function close(dlg) {
		if (!dlg || !dlg.open) return;
		var st = history.state && history.state.modals;
		if (stack[stack.length - 1] === dlg && st && st[st.length - 1] === dlg.id) history.back();
		else hide(dlg);
	}

	function closed(dlg) {
		var i = stack.indexOf(dlg);
		if (i < 0) return;
		stack.splice(i, 1);
		dlg._closing = false;
		if (dlg._anim) { dlg._anim.cancel(); dlg._anim = null; }
		for (var j = 0; j < dlg.children.length; j++) dlg.children[j].getAnimations().forEach(function (a) { a.cancel(); });
		/* closed by the app, not by Back: the history entry now says what is still open */
		var st = history.state && history.state.modals;
		if (st && st.indexOf(dlg.id) >= 0) history.replaceState({ modals: ids() }, '');
		if (!stack.length) document.documentElement.classList.remove('modal-open');
		var back = dlg._from;
		dlg._from = null;
		if (back && back.isConnected && back.getClientRects().length && !(stack.length && !stack[stack.length - 1].contains(back))) back.focus({ preventScroll: true });
		if (dlg._onClose) dlg._onClose();
	}

	window.addEventListener('popstate', function (ev) {
		var want = (ev.state && ev.state.modals) || [];
		stack.slice().reverse().forEach(function (d) { if (want.indexOf(d.id) < 0) hide(d); });
	});
	/* a modal is never open on load, whatever history says */
	if (history.state && history.state.modals) history.replaceState({ modals: [] }, '');

	/* Escape, a tap on the backdrop, and any [data-modal-close] */
	document.addEventListener('cancel', function (ev) {
		if (stack.indexOf(ev.target) < 0) return;
		ev.preventDefault();
		close(ev.target);
	}, true);
	document.addEventListener('close', function (ev) { closed(ev.target); }, true);
	document.addEventListener('click', function (ev) {
		var top = stack[stack.length - 1];
		if (!top) return;
		/* a dialog has no padding, its children fill it: a click on the dialog itself is on the backdrop */
		if (ev.target === top) { ev.preventDefault(); close(top); return; }
		var x = ev.target.closest && ev.target.closest('[data-modal-close]');
		if (x) { ev.preventDefault(); close(x.closest('dialog')); }
	});

	window.Modal = { open: open, close: close, hide: hide, top: function () { return stack[stack.length - 1] || null; } };
})();
