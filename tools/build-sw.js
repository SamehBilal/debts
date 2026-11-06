// Rewrites PRECACHE and VERSION in sw.js: the page, every script, stylesheet and icon. The version is a
// hash of their contents, so any change makes the installed app offer «Update now».
// Run from the repo root after changing files:  node tools/build-sw.js
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '..');

const list = ['./'];
const add = (rel) => list.push(rel.split(path.sep).join('/'));
add('index.html');
add('manifest.webmanifest');
const walk = (dir, test) => fs.readdirSync(path.join(root, dir), { withFileTypes: true })
	.sort((a, b) => (a.name < b.name ? -1 : 1))
	.forEach(d => {
		const rel = path.join(dir, d.name);
		if (d.isDirectory()) walk(rel, test); else if (test(rel)) add(rel);
	});
walk('assets/js', f => /\.js$/.test(f));
walk('assets/css', f => /\.css$/.test(f));
walk('assets/img', f => /\.(png|svg|jpe?g|webp)$/.test(f));

const hash = crypto.createHash('sha1');
list.slice(1).forEach(f => hash.update(f).update(fs.readFileSync(path.join(root, f))));
const version = 'debts-' + hash.digest('hex').slice(0, 10);

const swPath = path.join(root, 'sw.js');
let sw = fs.readFileSync(swPath, 'utf8');
sw = sw.replace(/var VERSION = '[^']*';/, "var VERSION = '" + version + "';")
	.replace(/var PRECACHE = \[[\s\S]*?\n\];/, 'var PRECACHE = [\n' + list.map(f => "\t'" + f + "'").join(',\n') + '\n];');
fs.writeFileSync(swPath, sw);
console.log(version, list.length, 'files');
