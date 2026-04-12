// Kaka Chat Service Worker
const BUILD_ID = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE_NAME = `kaka-chat-${BUILD_ID}`;
const APP_CACHE_PREFIX = 'kaka-chat-';
const IS_LOCALHOST = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
const ICON_VERSION = BUILD_ID;
const APP_ICON = `./icons/icon-192.png?v=${ICON_VERSION}`;
const APP_BADGE = `./icons/icon-192.png?v=${ICON_VERSION}`;

// 核心资源 - 必须缓存以支持离线启动
const CORE_ASSETS = [
  './',
  './index.html',
  `./manifest.json?v=${ICON_VERSION}`,
  `./icons/icon-192.png?v=${ICON_VERSION}`,
  `./icons/icon-512.png?v=${ICON_VERSION}`
];

// 可缓存的资源类型
const CACHEABLE_TYPES = ['document', 'script', 'style', 'font'];

// 缓存大小限制（条目数）
// 生产构建后的 assets 往往 > 50（拆包、字体等），过小会导致离线缓存被频繁淘汰。
const MAX_CACHE_ITEMS = 250;

// 安装事件 - 只缓存核心资源
self.addEventListener('install', (event) => {
  if (IS_LOCALHOST) {
    event.waitUntil(self.skipWaiting());
    return;
  }

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 激活事件 - 清理所有旧缓存
self.addEventListener('activate', (event) => {
  if (IS_LOCALHOST) {
    event.waitUntil(
      caches.keys()
        .then((names) => Promise.all(names.map((name) => caches.delete(name))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.matchAll({ type: 'window' }))
        .then((clients) => {
          clients.forEach((client) => client.navigate(client.url));
        })
    );
    return;
  }

  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          // 只清理本应用旧缓存，避免误删第三方库自己的缓存。
          .filter((name) => name.startsWith(APP_CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// 清理过多的缓存条目
async function trimCache() {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  if (keys.length > MAX_CACHE_ITEMS) {
    // 删除最早的条目
    const toDelete = keys.slice(0, keys.length - MAX_CACHE_ITEMS);
    await Promise.all(toDelete.map((key) => cache.delete(key)));
  }
}

function normalizeNotificationPayload(raw) {
  const payload = raw && typeof raw === 'object' ? raw : {};
  const timestamp = Number(payload.timestamp);
  const vibrate = Array.isArray(payload.vibrate) ? payload.vibrate : undefined;
  return {
    title: String(payload.title || 'AI Chat'),
    body: String(payload.body || ''),
    tag: payload.tag || undefined,
    data: payload.data || undefined,
    icon: payload.icon || APP_ICON,
    badge: payload.badge || APP_BADGE,
    silent: !!payload.silent,
    renotify: !!payload.renotify,
    requireInteraction: !!payload.requireInteraction,
    timestamp: Number.isFinite(timestamp) ? timestamp : undefined,
    vibrate
  };
}

async function showNotificationFromPayload(payload) {
  const normalized = normalizeNotificationPayload(payload);
  await self.registration.showNotification(normalized.title, {
    body: normalized.body,
    tag: normalized.tag,
    data: normalized.data,
    icon: normalized.icon,
    badge: normalized.badge,
    silent: normalized.silent,
    renotify: normalized.renotify,
    requireInteraction: normalized.requireInteraction,
    timestamp: normalized.timestamp,
    vibrate: normalized.vibrate
  });
}

// 请求拦截
self.addEventListener('fetch', (event) => {
  if (IS_LOCALHOST) return;

  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 跳过外部资源（CDN 等）
  if (url.origin !== location.origin) return;

  // 跳过 API 请求
  if (url.pathname.includes('/api/') || url.pathname.includes('/v1/')) return;
  if (
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@vite/') ||
    url.pathname.startsWith('/node_modules/')
  ) return;

  const dest = event.request.destination;

  // HTML 文档 - 网络优先，确保获取最新版本
  if (dest === 'document' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // JS/CSS/字体 - 缓存优先（带 hash 的文件名不会变）
  if (CACHEABLE_TYPES.includes(dest)) {
    event.respondWith(
      caches.match(event.request)
        .then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
              trimCache(); // 异步清理
            });
            return response;
          });
        })
    );
    return;
  }

  // 其他资源（图片等）- 不缓存，直接网络请求
  // 图片通常存在 IndexedDB 或由浏览器自身缓存管理
});

self.addEventListener('push', (event) => {
  let payload = null;
  try {
    payload = event.data ? event.data.json() : null;
  } catch {
    payload = { body: event.data ? event.data.text() : '你有一条新消息' };
  }
  event.waitUntil(showNotificationFromPayload(payload));
});

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const data = (notification && notification.data) || {};
  const targetUrl = String(data.url || '#/messages');
  let absoluteTarget = targetUrl;
  try {
    absoluteTarget = new URL(targetUrl, self.registration.scope || self.location.href).href;
  } catch {
    absoluteTarget = targetUrl;
  }
  if (notification) notification.close();

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (clients.length > 0) {
      let client = clients[0];
      try {
        if ('navigate' in client) {
          const navigated = await client.navigate(absoluteTarget);
          if (navigated) client = navigated;
        }
      } catch {
        // Fallback to postMessage when navigate fails.
      }
      try {
        client.postMessage({ type: 'navigate', url: targetUrl, data });
      } catch {
        // ignore
      }
      if ('focus' in client) return client.focus();
      return null;
    }
    if (self.clients.openWindow) {
      return self.clients.openWindow(absoluteTarget);
    }
    return null;
  })());
});

// 监听消息 - 支持手动清理缓存
self.addEventListener('message', (event) => {
  const data = event.data;
  if (data === 'clearCache') {
    caches.delete(CACHE_NAME).then(() => {
      caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS));
    });
    return;
  }

  if (data && typeof data === 'object' && data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data && typeof data === 'object' && data.type === 'show_local_notification') {
    const payload = data.payload || {};
    event.waitUntil(showNotificationFromPayload(payload));
    return;
  }

  if (data && typeof data === 'object' && data.type === 'liveness_keepalive_ping') {
    // Keepalive ping: intentionally lightweight.
  }
});

