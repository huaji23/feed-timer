/* Service Worker —— 网络优先（保证更新立刻生效），离线回退缓存 */
const CACHE = 'feedtimer-v23';
const ASSETS = ['./manifest.json', './icon-180.png', './icon-512.png'];  // HTML 不缓存

self.addEventListener('install', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => caches.open(CACHE))
      .then(c => c.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

/* 页面发来 SKIP_WAITING → 立刻接管 */
self.addEventListener('message', e => {
  if(e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
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

  // HTML：永远走网络，cache:'no-store' 彻底绕过 HTTP 缓存和 SW 缓存
  const isHtml = req.mode === 'navigate' || (req.headers.get('accept')||'').includes('text/html');
  if(isHtml){
    e.respondWith(
      fetch(req, {cache:'no-store'}).catch(() => new Response(
        '<h1>加载失败</h1><p>请检查网络后刷新重试</p>',
        {status:503, headers:{'Content-Type':'text/html; charset=utf-8'}}
      ))
    );
    return;
  }

  // 静态资源：网络优先 + 缓存兜底
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req))
  );
});
