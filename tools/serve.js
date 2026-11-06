// A small static server for trying the app locally (service workers need http://localhost, not file://).
//   node tools/serve.js [port]   → http://localhost:5180
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const port = +process.argv[2] || 5180;
const types = {
	'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
	'.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json',
	'.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon'
};
http.createServer((req, res) => {
	let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
	if (p.endsWith('/')) p += 'index.html';
	const file = path.join(root, p);
	if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
	fs.readFile(file, (err, data) => {
		if (err) { res.writeHead(404); return res.end('Not found'); }
		res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
		res.end(data);
	});
}).listen(port, () => console.log('http://localhost:' + port));
