// ビルド後に dist/ の全ファイルを列挙し、事前キャッシュする Service Worker を書く。
// 中身が変われば版が変わり、古いキャッシュは消える。
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist', import.meta.url));
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f !== 'sw.js') files.push(p);
  }
})(dist);
const hash = createHash('sha256');
for (const f of files.sort()) hash.update(relative(dist, f)).update(readFileSync(f));
const version = hash.digest('hex').slice(0, 12);
const urls = ['./', ...files.map((f) => './' + relative(dist, f).split('\\').join('/'))];

const sw = `// 自動生成（scripts/gen-sw.mjs）。手で直さない。
const CACHE = 'rinsho-${version}';
const URLS = ${JSON.stringify(urls)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(URLS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('rinsho-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((r) => r || fetch(req)));
});
`;
writeFileSync(join(dist, 'sw.js'), sw);
console.log(`sw.js: ${urls.length} files, version ${version}`);
