// Takes the install screenshots in the manifest (assets/img/screens/*.jpg) with headless Chrome,
// over a sample set of debts — your own data is never touched (a throwaway browser profile).
// Run from the repo root with the app served (node tools/serve.js):  node tools/screens.js [port]
// Needs Chrome or Edge; set CHROME=path\to\chrome.exe if it isn't found.
const fs = require('fs'), os = require('os'), path = require('path'), { spawn } = require('child_process');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'assets/img/screens');
const port = +process.argv[2] || 5180;
const base = 'http://localhost:' + port + '/index.html';

const chrome = [process.env.CHROME,
	'C:/Program Files/Google/Chrome/Application/chrome.exe',
	'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	'/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find(p => fs.existsSync(p));
if (!chrome) { console.error('No Chrome found; set CHROME'); process.exit(1); }

/* sample debts around Cairo, dated relative to today so the plan always looks current */
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const ago = (n) => new Date(Date.now() - n * 864e5).toISOString();
function sample(lang) {
	const ar = lang === 'ar', T = (a, e) => (ar ? a : e);
	const debts = [
		{ id: 'd1', name: T('أحمد', 'Ahmed'), kind: 'person', amount: 1500, note: T('سلفة إيجار', 'Rent help'), place: { lat: 30.0626, lng: 31.2497, label: T('مقهى في الزمالك', 'Café in Zamalek') },
			entries: [{ type: 'pay', amount: 500, date: day(-20) }], created: ago(60) },
		{ id: 'd2', name: T('بقالة الحاج سيد', 'Hajj Sayed’s grocery'), kind: 'store', amount: 420, place: { lat: 30.0444, lng: 31.2357, label: T('وسط البلد', 'Downtown') },
			entries: [{ type: 'borrow', amount: 180, date: day(-6) }], created: ago(40) },
		{ id: 'd3', name: T('بطاقة الائتمان', 'Credit card'), kind: 'card', amount: 12000, apr: 28, minPay: 900, due: day(9), place: null,
			entries: [{ type: 'pay', amount: 2500, date: day(-35) }, { type: 'pay', amount: 1500, date: day(-5) }], created: ago(120) },
		{ id: 'd4', name: T('قرض السيارة', 'Car loan'), kind: 'loan', amount: 45000, apr: 14, minPay: 2200, due: day(17), place: { lat: 30.0131, lng: 31.4089, label: T('البنك — التجمع', 'Bank — New Cairo') },
			entries: [{ type: 'pay', amount: 2200, date: day(-40) }, { type: 'pay', amount: 2200, date: day(-10) }], created: ago(200) },
		{ id: 'd5', name: T('مكتبة الشروق', 'Shorouk bookshop'), kind: 'store', amount: 350, place: { lat: 30.0566, lng: 31.2243, label: T('المهندسين', 'Mohandessin') },
			entries: [], created: ago(15) },
		{ id: 'd6', name: T('منى', 'Mona'), kind: 'person', amount: 800, place: { lat: 29.9792, lng: 31.1342, label: T('الهرم', 'Giza') },
			entries: [{ type: 'pay', amount: 800, date: day(-3) }], created: ago(30) }
	].map(d => Object.assign({ apr: 0, minPay: 0, due: '', note: '' }, d, { entries: d.entries.map((e, i) => Object.assign({ id: d.id + 'e' + i, note: '' }, e)) }));
	return { version: 1, settings: { lang, theme: 'light', currency: 'EGP', budget: 6000, strategy: 'avalanche', order: [], nearby: false },
		debts, meta: { peak: 62000, created: ago(200) } };
}

const shots = [
	{ file: 'wide-home', w: 1280, h: 720, lang: 'en', label: 'Home — الرئيسية' },
	{ file: 'wide-plan', w: 1280, h: 720, lang: 'en', panel: 'plan', label: 'Payoff plan — خطة السداد' },
	{ file: 'wide-places', w: 1280, h: 720, lang: 'en', panel: 'places', label: 'Places — الأماكن' },
	{ file: 'narrow-home', w: 412, h: 915, lang: 'ar', label: 'الرئيسية — Home' },
	{ file: 'narrow-debts', w: 412, h: 915, lang: 'ar', panel: 'debts', label: 'الديون — Debts' },
	{ file: 'narrow-plan', w: 412, h: 915, lang: 'ar', panel: 'plan', label: 'خطة السداد — Payoff plan' }
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
	const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'debts-shots-'));
	const proc = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile,
		'--no-first-run', '--hide-scrollbars', '--force-prefers-reduced-motion', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
	const wsUrl = await new Promise((res, rej) => {
		let buf = '';
		proc.stderr.on('data', (c) => { buf += c; const m = /ws:\/\/\S+/.exec(buf); if (m) res(m[0]); });
		setTimeout(() => rej(new Error('Chrome did not start')), 15000);
	});
	const browser = new WebSocket(wsUrl);
	await new Promise(r => browser.addEventListener('open', r, { once: true }));
	let seq = 0; const waiting = new Map();
	browser.addEventListener('message', (ev) => {
		const m = JSON.parse(ev.data);
		if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.error ? w.rej(new Error(m.error.message)) : w.res(m.result); }
	});
	const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
		const id = ++seq; waiting.set(id, { res, rej });
		browser.send(JSON.stringify({ id, method, params, sessionId }));
	});
	const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
	const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
	const page = (m, p) => send(m, p, sessionId);
	const evaluate = (expr) => page('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
	await page('Page.enable');
	await page('Runtime.enable');

	fs.mkdirSync(out, { recursive: true });
	for (const s of shots) {
		await page('Emulation.setDeviceMetricsOverride', { width: s.w, height: s.h, deviceScaleFactor: 1, mobile: s.w < 600 });
		await page('Page.navigate', { url: base });
		await sleep(800);
		await evaluate('localStorage.setItem("debts-state", ' + JSON.stringify(JSON.stringify(sample(s.lang))) + ')');
		await page('Page.navigate', { url: base + '?shot=' + s.file });
		await sleep(1800);
		if (s.panel) {
			await evaluate('document.querySelector(\'[data-panel="' + s.panel + '"]\').click()');
			await sleep(s.panel === 'places' ? 4000 : 1200);
			await evaluate('document.activeElement && document.activeElement.blur()'); // no focus ring on ×
			await sleep(300);
		}
		const { data } = await page('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
		fs.writeFileSync(path.join(out, s.file + '.jpg'), Buffer.from(data, 'base64'));
		console.log(s.file + '.jpg', s.w + 'x' + s.h);
	}
	browser.close(); proc.kill();
	try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}

	/* the manifest lists exactly these, one per line, just before "prefer_related_applications" */
	const mPath = path.join(root, 'manifest.webmanifest');
	let man = fs.readFileSync(mPath, 'utf8').replace(/\t"screenshots": \[[\s\S]*?\n\t\],\n/, '');
	const block = '\t"screenshots": [\n' + shots.map(s => '\t\t' + JSON.stringify({ src: 'assets/img/screens/' + s.file + '.jpg', sizes: s.w + 'x' + s.h,
		type: 'image/jpeg', form_factor: s.w > s.h ? 'wide' : 'narrow', label: s.label }).replace(/^\{|\}$/g, m => (m === '{' ? '{ ' : ' }')).replace(/","/g, '", "').replace(/":"/g, '": "')).join(',\n') + '\n\t],\n';
	man = man.replace(/(\t"prefer_related_applications")/, block + '$1');
	JSON.parse(man); // still valid
	fs.writeFileSync(mPath, man);
	console.log('manifest: ' + shots.length + ' screenshots');
})().catch((e) => { console.error(e); process.exit(1); });
