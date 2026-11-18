/* Service Worker —— 网络优先（保证更新立刻生效），离线回退缓存 */
const CACHE = 'feedtimer-v18';
const ASSETS = ['./', './index.html', './manifest.json', './icon-180.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => caches.open(CACHE))
      .then(c => c.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 云端数据 JSON 不缓存，避免读到旧记录
  if (url.pathname.indexOf('/shared/') === 0) return;

  // 全部走网络优先，离线才回退缓存
  // 关键：cache:'reload' 绕过浏览器 HTTP 缓存（微信内置浏览器缓存很顽固）
  const isHtml = req.mode === 'navigate' || (req.headers.get('accept')||'').includes('text/html');
  e.respondWith(
    fetch(req, isHtml ? {cache:'reload'} : undefined).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
