// Service Worker — 컨텐츠 마스터즈
// 오프라인 작동 + PWA 설치 트리거

const CACHE_NAME = 'content-masters-v701';
const FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png',
  './hero-trophy.png',
  './sorter-icon.png'
];

// 설치 시 캐싱
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES))
  );
  self.skipWaiting();
});

// 활성화 시 이전 캐시 정리
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// fetch — 네트워크 우선, 실패 시 캐시
// v412: 같은 출처의 정적 파일만 캐시한다.
//   기존엔 모든 GET을 캐시에 넣어서 Supabase 등 API 응답까지 저장됐고,
//   오프라인/네트워크 오류일 때 낡은 API 데이터가 되살아날 수 있었다.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let sameOrigin = false;
  try { sameOrigin = new URL(req.url).origin === self.location.origin; } catch (_) { return; }
  if (!sameOrigin) return; // 외부(API·CDN)는 SW가 손대지 않음 — 브라우저에 맡김

  e.respondWith(
    fetch(req)
      .then((res) => {
        // 정상 응답만 저장 (에러 페이지·부분 응답이 캐시에 박히는 것 방지)
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => {
          if (cached) return cached;
          // 페이지 이동 요청일 때만 앱 껍데기로 폴백
          if (req.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        })
      )
  );
});
