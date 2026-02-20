/**
 * Service Worker - オフライン対応 + Share Target API対応
 *
 * 【役割】
 * - アプリのファイルをキャッシュしてオフラインでも表示可能にする
 * - Share Target APIのPOSTリクエストを受け取り、IndexedDBにファイルを保存する
 *
 * 【ファイル連携】
 * - app.js から登録される
 * - manifest.json の share_target.action に一致するURLをインターセプト
 * - IndexedDB経由で app.js にファイルを渡す
 */

// キャッシュ名（バージョン変更で古いキャッシュを自動削除）
const CACHE_NAME = 'receipt-app-v3';

// IndexedDB設定
const DB_NAME = 'receipt-share-db';
const DB_STORE = 'shared-files';
const DB_KEY = 'pending';

// キャッシュするファイル一覧
const FILES_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

// ============================================
// IndexedDB ヘルパー
// ============================================

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            e.target.result.createObjectStore(DB_STORE);
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveSharedFile(file) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put(file, DB_KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

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
                        if (cacheName !== CACHE_NAME) {
                            console.log('[Service Worker] 古いキャッシュを削除:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[Service Worker] アクティブ化完了');
                return self.clients.claim();
            })
    );
});

// ============================================
// フェッチ時：Share Target POSTの処理 + キャッシュ
// ============================================
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // --- Share Target APIのPOSTリクエストを処理 ---
    // manifest.jsonの share_target.action と一致するリクエストをインターセプト
    if (event.request.method === 'POST' && url.searchParams.has('share-target')) {
        event.respondWith(
            (async () => {
                try {
                    const formData = await event.request.formData();
                    // manifest.json の params.files[].name に合わせる
                    const file = formData.get('receipt');

                    if (file && file.size > 0) {
                        await saveSharedFile(file);
                        console.log('[Service Worker] 共有ファイルを保存:', file.name);
                    }
                } catch (err) {
                    console.error('[Service Worker] 共有ファイルの保存に失敗:', err);
                }

                // ファイルを保存後、メインページにリダイレクト
                // ?shared=true でapp.jsにIndexedDBを確認するよう通知
                return Response.redirect('./?shared=true', 303);
            })()
        );
        return;
    }

    // --- 通常のGETリクエスト：キャッシュファーストストラテジー ---
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(event.request, responseClone);
                            });
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        if (event.request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                    });
            })
    );
});
