// 版本号，更新时修改此处以触发重新安装
const CACHE_VERSION = 'v1.0.1';
const CACHE_NAME = `yt-weather-${CACHE_VERSION}`;

// 需要缓存的资源
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/style.css',
  '/app.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;700&display=swap'
];

// 安装事件 - 缓存核心资源
self.addEventListener('install', (event) => {
  console.log('[Service Worker] yt天气安装中...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] 缓存核心资源');
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] 跳过等待阶段，立即激活');
        return self.skipWaiting();
      })
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] yt天气激活中...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 删除旧版本的缓存
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] 删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] 已清理旧缓存，现在控制所有客户端');
      return self.clients.claim();
    })
  );
});

// 获取事件 - 网络优先，失败时使用缓存
self.addEventListener('fetch', (event) => {
  // 跳过非GET请求和Chrome扩展
  if (event.request.method !== 'GET' || 
      event.request.url.startsWith('chrome-extension://')) {
    return;
  }
  
  // 处理API请求 - 网络优先，失败时返回离线数据
  if (event.request.url.includes('api.caiyunapp.com')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // 克隆响应以用于缓存
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // 网络失败时尝试从缓存获取
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // 如果没有缓存的API数据，返回一个基本的离线响应
            return new Response(
              JSON.stringify({
                status: 'offline',
                message: '您当前处于离线状态。上次更新：' + new Date().toLocaleString()
              }),
              {
                status: 200,
                statusText: 'OK',
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
        })
    );
  } else {
    // 处理静态资源 - 缓存优先
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(event.request)
            .then((response) => {
              // 检查是否为有效响应
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              // 克隆响应以用于缓存
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
              
              return response;
            });
        })
    );
  }
});

// 监听消息事件
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
