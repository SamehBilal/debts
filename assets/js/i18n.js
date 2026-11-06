/* Language and numbers. L(ar, en) picks the text for the current language; the language is
   the reader's choice (settings), else the browser's. money() formats in the chosen currency.
   Loaded first, on the one page. */
(function () {
	'use strict';

	var I18n = {
		lang: 'en',
		currency: 'USD',
		set: function (lang, currency) {
			if (lang) I18n.lang = lang === 'ar' ? 'ar' : 'en';
			if (currency) I18n.currency = currency;
			var html = document.documentElement;
			html.lang = I18n.lang;
			html.dir = I18n.lang === 'ar' ? 'rtl' : 'ltr';
			fmt = {};
		}
	};

	/* the browser's language, and a currency that fits its region */
	I18n.guessLang = function () { return /^ar\b/i.test(navigator.language || '') ? 'ar' : 'en'; };
	var REGION = {
		EG: 'EGP', SA: 'SAR', AE: 'AED', KW: 'KWD', QA: 'QAR', BH: 'BHD', OM: 'OMR', JO: 'JOD', LB: 'LBP', IQ: 'IQD',
		MA: 'MAD', DZ: 'DZD', TN: 'TND', LY: 'LYD', SD: 'SDG', SY: 'SYP', YE: 'YER', PS: 'ILS', TR: 'TRY',
		US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', IN: 'INR', PK: 'PKR', JP: 'JPY', CN: 'CNY', BR: 'BRL', MX: 'MXN',
		DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', IE: 'EUR', PT: 'EUR', FI: 'EUR', GR: 'EUR'
	};
	I18n.guessCurrency = function () {
		var m = /[-_]([A-Z]{2})\b/.exec(navigator.language || '');
		return (m && REGION[m[1]]) || (/^ar\b/i.test(navigator.language || '') ? 'EGP' : 'USD');
	};
	I18n.CURRENCIES = ['EGP', 'SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD', 'MAD', 'TND', 'IQD', 'LBP', 'USD', 'EUR', 'GBP', 'TRY', 'INR', 'PKR', 'CAD', 'AUD'];

	window.L = function (ar, en) { return I18n.lang === 'ar' ? ar : en; };

	var fmt = {};
	function nf(key, opts) {
		if (!fmt[key]) {
			var loc = I18n.lang === 'ar' ? 'ar-EG' : 'en';
			try { fmt[key] = new Intl.NumberFormat(loc, opts); } catch (e) { fmt[key] = new Intl.NumberFormat(loc); }
		}
		return fmt[key];
	}
	I18n.money = function (n, short) {
		n = Math.round((+n || 0) * 100) / 100;
		var whole = Math.abs(n % 1) < 0.005;
		var opts = { style: 'currency', currency: I18n.currency, currencyDisplay: 'narrowSymbol' };
		if (whole || short) { opts.minimumFractionDigits = 0; opts.maximumFractionDigits = short ? 0 : 2; }
		if (short && Math.abs(n) >= 10000) { opts.notation = 'compact'; opts.maximumFractionDigits = 1; }
		try { return nf('m' + (whole ? 'w' : '') + (short ? 's' : '') + (short && Math.abs(n) >= 10000 ? 'c' : ''), opts).format(n); }
		catch (e) { return n.toFixed(2) + ' ' + I18n.currency; }
	};
	I18n.num = function (n) { return nf('n', { maximumFractionDigits: 1 }).format(+n || 0); };
	I18n.pct = function (n) { return nf('p', { style: 'percent', maximumFractionDigits: 0 }).format(+n || 0); };
	I18n.date = function (d, opts) {
		if (!d) return '';
		var dt = typeof d === 'string' ? new Date(d.length === 10 ? d + 'T00:00:00' : d) : d;
		if (isNaN(dt)) return '';
		try { return dt.toLocaleDateString(I18n.lang === 'ar' ? 'ar-EG' : 'en', opts || { day: 'numeric', month: 'short', year: 'numeric' }); }
		catch (e) { return dt.toDateString(); }
	};
	I18n.month = function (d) { return I18n.date(d, { month: 'long', year: 'numeric' }); };
	/* «3 months», «1 year 2 months» */
	I18n.span = function (months) {
		if (months <= 0) return L('هذا الشهر', 'this month');
		var y = Math.floor(months / 12), m = months % 12, out = [];
		if (y) out.push(I18n.lang === 'ar' ? (y === 1 ? 'سنة' : y === 2 ? 'سنتان' : I18n.num(y) + (y <= 10 ? ' سنوات' : ' سنة')) : y + (y === 1 ? ' year' : ' years'));
		if (m) out.push(I18n.lang === 'ar' ? (m === 1 ? 'شهر' : m === 2 ? 'شهران' : I18n.num(m) + (m <= 10 ? ' أشهر' : ' شهرًا')) : m + (m === 1 ? ' month' : ' months'));
		return out.join(L(' و', ' '));
	};

	I18n.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

	window.I18n = I18n;
})();
