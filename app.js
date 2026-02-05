/**
 * 領収書撮影アプリ - メインロジック
 *
 * 【ファイル連携】
 * - index.html: DOMの構造を提供（ボタン、input、ステータス表示エリア）
 * - style.css: UIのスタイリングを担当
 * - manifest.json: PWAとしてインストール可能にする設定
 * - sw.js: オフラインキャッシュとPWA要件を満たす
 */

// ============================================
// 設定
// ============================================

/**
 * Make (Integromat) のWebhook URL
 * ここを実際のWebhook URLに書き換えてください
 */
const WEBHOOK_URL = 'https://hook.eu1.make.com/bew33hwohwsbvp5odb6oyiakgezq9qg1';

// ============================================
// DOM要素の取得
// ============================================
const captureBtn = document.getElementById('captureBtn');
const cameraInput = document.getElementById('cameraInput');
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
// イベントリスナー
// ============================================

// 撮影ボタンクリック → カメラ入力を起動
captureBtn.addEventListener('click', () => {
    cameraInput.click();
});

// 画像が選択（撮影）されたとき
cameraInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];

    if (!file) {
        return;
    }

    // プレビュー表示
    showPreview(file);

    // Webhookに送信
    await sendToWebhook(file);

    // 入力をリセット（同じ画像を再度選択できるように）
    cameraInput.value = '';
});

// ============================================
// 関数定義
// ============================================

/**
 * 画像のプレビューを表示
 * @param {File} file - 画像ファイル
 */
function showPreview(file) {
    const reader = new FileReader();

    reader.onload = (e) => {
        previewDiv.innerHTML = `<img src="${e.target.result}" alt="撮影した領収書">`;
    };

    reader.readAsDataURL(file);
}

/**
 * ステータス表示を更新
 * @param {string} message - 表示するメッセージ
 * @param {string} type - 'sending' | 'success' | 'error'
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
 * Webhookに画像を送信
 * @param {File} file - 送信する画像ファイル
 */
async function sendToWebhook(file) {
    // Webhook URLが設定されているかチェック
    if (WEBHOOK_URL === 'CHANGE_THIS_TO_YOUR_MAKE_WEBHOOK_URL') {
        showStatus('Webhook URLを設定してください', 'error');
        console.error('WEBHOOK_URL が設定されていません。app.js の WEBHOOK_URL を変更してください。');
        return;
    }

    // 送信中表示
    showStatus('送信中...', 'sending');
    captureBtn.disabled = true;

    try {
        // FormDataを使用して画像を送信
        const formData = new FormData();
        formData.append('receipt', file, file.name);
        formData.append('timestamp', new Date().toISOString());
        formData.append('filename', file.name);

        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            body: formData,
        });

        if (response.ok) {
            showStatus('✅ 送信完了！', 'success');

            // 3秒後にステータスをクリア
            setTimeout(() => {
                clearStatus();
            }, 3000);
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        console.error('送信エラー:', error);
        showStatus(`❌ 送信失敗: ${error.message}`, 'error');
    } finally {
        captureBtn.disabled = false;
    }
}

// ============================================
// 初期化
// ============================================
console.log('領収書撮影アプリが起動しました');
