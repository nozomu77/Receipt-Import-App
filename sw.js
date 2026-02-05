/**
 * Service Worker - オフライン対応とPWA要件
 *
 * 【役割】
 * - アプリのファイルをキャッシュしてオフラインでも表示可能にする
 * - PWAとしてインストール可能にするための必須要件
 *
 * 【ファイル連携】
 * - app.js から登録される
 * - index.html, style.css, app.js をキャッシュ
 */

// キャッシュ名（バージョン管理用）
const CACHE_NAME = 'receipt-app-v1';

// キャッシュするファイル一覧
const FILES_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

// ============================================
// インストール時：ファイルをキャッシュ
// ============================================
self.addEventListener('install', (event) => {
    console.log('[Service Worker] インストール中...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] ファイルをキャッシュ中...');
                return cache.addAll(FILES_TO_CACHE);
            })
            .then(() => {
                console.log('[Service Worker] インストール完了');
                // 即座にアクティブ化
                return self.skipWaiting();
            })
    );
});

// ============================================
// アクティブ化時：古いキャッシュを削除
// ============================================
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] アクティブ化中...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // 現在のキャッシュ名と異なる古いキャッシュを削除
                        if (cacheName !== CACHE_NAME) {
                            console.log('[Service Worker] 古いキャッシュを削除:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[Service Worker] アクティブ化完了');
                // 即座にページを制御
                return self.clients.claim();
            })
    );
});

// ============================================
// フェッチ時：キャッシュファーストストラテジー
// ============================================
self.addEventListener('fetch', (event) => {
    // Webhook送信（POST）はキャッシュしない
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // キャッシュがあればそれを返す
                if (cachedResponse) {
                    return cachedResponse;
                }

                // キャッシュがなければネットワークからフェッチ
                return fetch(event.request)
                    .then((networkResponse) => {
                        // 正常なレスポンスのみキャッシュ
                        if (networkResponse && networkResponse.status === 200) {
                            const responseClone = networkResponse.clone();

                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseClone);
                                });
                        }

                        return networkResponse;
                    })
                    .catch(() => {
                        // オフラインでindex.html以外にアクセスした場合
                        // メインページにフォールバック
                        if (event.request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                    });
            })
    );
});
