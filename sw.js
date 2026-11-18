/* Service Worker —— 网络优先（保证更新立刻生效），离线回退缓存 */
const CACHE = 'feedtimer-v21';
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

  // 全部走网络优先，离线才回退缓存
  // 关键：cache:'reload' 绕过浏览器 HTTP 缓存（微信内置浏览器缓存很顽固）
  const isHtml = req.mode === 'navigate' || (req.headers.get('accept')||'').includes('text/html');
  e.respondWith(
    fetch(req, isHtml ? {cache:'reload'} : undefined).then(res => {
      // HTML 不写缓存 —— 保证每次打开都是最新文件
      if(!isHtml){
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => {
      // HTML 不缓存 → 没有兜底旧版。返回错误而不是给用户旧代码
      if(isHtml) return new Response('<h1>加载失败</h1><p>请检查网络后重试</p>', {
        status:503, headers:{'Content-Type':'text/html; charset=utf-8'}
      });
      return caches.match(req);
    })
  );
});
