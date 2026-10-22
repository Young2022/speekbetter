/**
 * SpeekBetter Service Worker
 * 缓存核心资源，支持离线打开页面和播放已缓存的示范音频。
 */
const CACHE_NAME = "speekbetter-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./print.css",
  "./pronunciation.js",
  "./data/modules.js",
  "./app.js",
  "./manifest.json"
];

// 安装：预缓存核心资源
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// 激活：清理旧缓存
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

// 请求拦截
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 音频文件：缓存优先，网络回退，成功则回填缓存（支持离线播放已缓存音频）
  if (url.pathname.includes("/assets/audio/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML/JS/CSS：缓存优先，网络回退
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.method === "GET") {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => {
        // 离线时如果找不到缓存，返回 index.html（单页应用离线回退）
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    })
  );
});