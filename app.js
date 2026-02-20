/**
 * 領収書撮影アプリ - メインロジック
 *
 * 【ファイル連携】
 * - index.html: DOMの構造を提供（ボタン、input、ステータス表示エリア）
 * - style.css: UIのスタイリングを担当
 * - manifest.json: PWAとしてインストール可能、Share Targetとして登録
 * - sw.js: オフラインキャッシュ + Share Target POSTのインターセプト + IndexedDB保存
 *
 * 【Share Target APIのフロー】
 * 1. メールアプリで「共有」→ このアプリを選択
 * 2. ブラウザがsw.jsにPOSTリクエストを送信
 * 3. sw.jsがファイルをIndexedDBに保存し、?shared=true にリダイレクト
 * 4. このapp.jsが起動時にIndexedDBを確認してファイルを自動処理
 */

// ============================================
// 設定
// ============================================

/**
 * Make (Integromat) のWebhook URL
 * ここを実際のWebhook URLに書き換えてください
 */
const WEBHOOK_URL = 'https://hook.eu1.make.com/eu7rq7tcpbnhpda99gb2khg1bojdosps';

// IndexedDB設定（sw.jsと同じ値を使用）
const DB_NAME = 'receipt-share-db';
const DB_STORE = 'shared-files';
const DB_KEY = 'pending';

// ============================================
// DOM要素の取得
// ============================================
const captureBtn = document.getElementById('captureBtn');
const fileBtn = document.getElementById('fileBtn');
const cameraInput = document.getElementById('cameraInput');
const fileInput = document.getElementById('fileInput');
const statusDiv = document.getElementById('status');
const previewDiv = document.getElementById('preview');

// ============================================
// Service Worker の登録
// ============================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('sw.js');
            console.log('Service Worker 登録成功:', registration.scope);
        } catch (error) {
            console.log('Service Worker 登録失敗:', error);
        }
    });
}

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

/**
 * IndexedDBからShare Targetで受け取ったファイルを取得して削除
 * @returns {Promise<File|null>}
 */
async function getAndClearSharedFile() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        const store = tx.objectStore(DB_STORE);
        const getReq = store.get(DB_KEY);

        getReq.onsuccess = () => {
            const file = getReq.result || null;
            if (file) {
                store.delete(DB_KEY);
            }
            resolve(file);
        };
        getReq.onerror = () => reject(getReq.error);
    });
}

// ============================================
// Share Targetからの自動処理（起動時）
// ============================================

window.addEventListener('load', async () => {
    // sw.jsが ?shared=true にリダイレクトした場合に処理
    if (location.search.includes('shared=true')) {
        try {
            const file = await getAndClearSharedFile();
            if (file) {
                console.log('共有ファイルを受信:', file.name, file.type);
                showPreview(file);
                await sendToWebhook(file);
            }
        } catch (err) {
            console.error('共有ファイルの読み込みに失敗:', err);
            showStatus('共有ファイルの読み込みに失敗しました', 'error');
        }
        // URLをクリーンにする（リロード時に再実行しないように）
        history.replaceState(null, '', location.pathname);
    }
});

// ============================================
// イベントリスナー
// ============================================

// 撮影ボタン → 背面カメラを起動
captureBtn.addEventListener('click', () => {
    cameraInput.click();
});

// ファイル選択ボタン → ファイルピッカー（画像+PDF対応）
fileBtn.addEventListener('click', () => {
    fileInput.click();
});

// カメラで撮影されたとき
cameraInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    showPreview(file);
    await sendToWebhook(file);
    cameraInput.value = '';
});

// ファイルが選択されたとき（画像またはPDF）
fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    showPreview(file);
    await sendToWebhook(file);
    fileInput.value = '';
});

// ============================================
// 関数定義
// ============================================

/**
 * ファイルのプレビューを表示
 * 画像: <img> で表示
 * PDF: ファイル名とアイコンを表示
 * @param {File} file
 */
function showPreview(file) {
    if (file.type === 'application/pdf') {
        // PDFはファイル名+アイコンで表示
        previewDiv.innerHTML = `
            <div class="pdf-preview">
                <span class="pdf-icon">📄</span>
                <span class="pdf-name">${escapeHtml(file.name)}</span>
                <span class="pdf-size">${formatFileSize(file.size)}</span>
            </div>
        `;
    } else {
        // 画像はそのまま表示
        const reader = new FileReader();
        reader.onload = (e) => {
            previewDiv.innerHTML = `<img src="${e.target.result}" alt="撮影した領収書">`;
        };
        reader.readAsDataURL(file);
    }
}

/**
 * ステータス表示を更新
 * @param {string} message
 * @param {'sending'|'success'|'error'} type
 */
function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
}

/**
 * ステータス表示をクリア
 */
function clearStatus() {
    statusDiv.textContent = '';
    statusDiv.className = 'status';
}

/**
 * Webhookにファイルを送信（画像・PDF共通）
 * @param {File} file
 */
async function sendToWebhook(file) {
    if (WEBHOOK_URL === 'CHANGE_THIS_TO_YOUR_MAKE_WEBHOOK_URL') {
        showStatus('Webhook URLを設定してください', 'error');
        console.error('WEBHOOK_URL が設定されていません。app.js の WEBHOOK_URL を変更してください。');
        return;
    }

    showStatus('送信中...', 'sending');
    captureBtn.disabled = true;
    fileBtn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('receipt', file, file.name);
        formData.append('timestamp', new Date().toISOString());
        formData.append('filename', file.name);
        formData.append('filetype', file.type);

        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            body: formData,
        });

        if (response.ok) {
            showStatus('✅ 送信完了！', 'success');
            setTimeout(() => clearStatus(), 3000);
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        console.error('送信エラー:', error);
        showStatus(`❌ 送信失敗: ${error.message}`, 'error');
    } finally {
        captureBtn.disabled = false;
        fileBtn.disabled = false;
    }
}

// ============================================
// ユーティリティ
// ============================================

/**
 * XSS対策のHTMLエスケープ
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * ファイルサイズを読みやすい形式に変換
 * @param {number} bytes
 * @returns {string}
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================
// 初期化
// ============================================
console.log('領収書撮影アプリが起動しました');
