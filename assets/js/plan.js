/* The payoff plan: month by month, with the money you can put to debts each month (settings.budget).
   Each month any interest is added (APR / 12), every debt gets its minimum payment, and what is left
   goes to the debt first in line until it is gone, then the next — so each paid-off debt frees its
   share for the rest (the «snowball»). The line is the strategy:
     snowball  — smallest balance first: quick wins, fewer names on the list
     avalanche — highest interest first: the least paid in interest
     due       — nearest due date first, then smallest
     custom    — the reader's own order (settings.order)
   Plan.run(...) → { ok, reason, months, end, interest, debts: [{ id, rank, month, now }], curve }. */
(function () {
	'use strict';

	var MAX = 600;

	function sorter(strategy, order) {
		return function (a, b) {
			if (strategy === 'avalanche') return (b.apr - a.apr) || (a.bal - b.bal);
			if (strategy === 'due') {
				var da = a.due || '9999', db = b.due || '9999';
				return da < db ? -1 : da > db ? 1 : a.bal - b.bal;
			}
			if (strategy === 'custom') {
				var ia = order.indexOf(a.id), ib = order.indexOf(b.id);
				if (ia < 0) ia = 1e6; if (ib < 0) ib = 1e6;
				return (ia - ib) || (a.bal - b.bal);
			}
			return (a.bal - b.bal) || (b.apr - a.apr);
		};
	}

	function run(debts, budget, strategy, order) {
		var S = window.Store;
		var items = debts.map(function (d) {
			return { id: d.id, name: d.name, bal: S.balance(d), apr: d.apr || 0, min: d.minPay || 0, due: d.due, month: null, now: 0, paid: 0 };
		}).filter(function (x) { return x.bal > 0; });
		items.sort(sorter(strategy, order || []));
		items.forEach(function (x, i) { x.rank = i + 1; });

		var out = { ok: true, reason: '', months: 0, interest: 0, debts: items, curve: [], mins: 0 };
		out.mins = items.reduce(function (s, x) { return s + Math.min(x.min, x.bal); }, 0);
		if (!items.length) return out;
		if (!(budget > 0)) { out.ok = false; out.reason = 'nobudget'; return out; }

		var start = items.reduce(function (s, x) { return s + x.bal; }, 0);
		out.curve.push(start);
		var m = 0, last = start;
		for (; m < MAX; m++) {
			var left = budget;
			items.forEach(function (x) {
				if (x.bal <= 0) return;
				var i = x.bal * x.apr / 1200;
				x.bal += i; out.interest += i;
			});
			/* minimums, then everything else down the line */
			items.forEach(function (x) {
				if (x.bal <= 0 || left <= 0) return;
				var p = Math.min(x.min, x.bal, left);
				x.bal -= p; left -= p; if (m === 0) x.now += p;
			});
			items.forEach(function (x) {
				if (x.bal <= 0 || left <= 0) return;
				var p = Math.min(x.bal, left);
				x.bal -= p; left -= p; if (m === 0) x.now += p;
			});
			var total = 0;
			items.forEach(function (x) {
				if (x.bal < 0.005) { x.bal = 0; if (x.month == null) x.month = m; }
				total += x.bal;
			});
			out.curve.push(total);
			if (total <= 0) break;
			/* the debt grows faster than it is paid */
			if (m % 12 === 11) { if (total >= last - 0.01) { out.ok = false; out.reason = 'toolow'; break; } last = total; }
		}
		if (m >= MAX) { out.ok = false; out.reason = 'toolow'; }
		out.months = m + 1;
		var end = new Date(); end.setDate(1); end.setMonth(end.getMonth() + m);
		out.end = end;
		out.interest = Math.round(out.interest * 100) / 100;
		items.forEach(function (x) { x.now = Math.round(x.now * 100) / 100; });
		return out;
	}

	/* the same debts and budget under each strategy, to show what the choice changes */
	function compare(debts, budget, order) {
		var r = {};
		['snowball', 'avalanche', 'due', 'custom'].forEach(function (s) { r[s] = run(debts, budget, s, order); });
		return r;
	}

	window.Plan = { run: run, compare: compare };
})();
