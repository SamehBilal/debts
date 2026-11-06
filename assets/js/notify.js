/* Notes in the corner: Notify(message, { type, title, ttl, html, actions }) — they stack, close
   themselves after ttl ms (0: stay), and can carry buttons: actions = [{ label, run }]. */
(function () {
	'use strict';
	var stack = null;
	function ensure() {
		if (stack && stack.isConnected) return stack;
		stack = document.createElement('div');
		stack.className = 'toasts';
		stack.setAttribute('role', 'status');
		stack.setAttribute('aria-live', 'polite');
		document.body.appendChild(stack);
		return stack;
	}
	window.Notify = function (message, opt) {
		opt = opt || {};
		var box = document.createElement('div');
		box.className = 'toast toast-' + (opt.type || 'notice');
		box.innerHTML = (opt.title ? '<b class="toast-title">' + I18n.esc(opt.title) + '</b>' : '') +
			'<p>' + (opt.html ? message : I18n.esc(message)) + '</p>' +
			'<div class="toast-actions"></div>' +
			'<button type="button" class="toast-x" aria-label="' + L('إغلاق', 'Close') + '">×</button>';
		var acts = box.querySelector('.toast-actions');
		(opt.actions || []).forEach(function (a) {
			var b = document.createElement('button');
			b.type = 'button'; b.className = 'btn btn-small'; b.textContent = a.label;
			b.addEventListener('click', function () { dismiss(); a.run(); });
			acts.appendChild(b);
		});
		var root = ensure();
		root.insertBefore(box, root.firstChild);
		while (root.children.length > 3) root.lastChild.remove();
		var t = 0;
		function dismiss() { clearTimeout(t); box.classList.add('out'); setTimeout(function () { box.remove(); }, 250); }
		box.querySelector('.toast-x').addEventListener('click', dismiss);
		var ttl = opt.ttl == null ? 3500 : opt.ttl;
		if (ttl) t = setTimeout(dismiss, ttl);
		return { el: box, dismiss: dismiss };
	};
})();
