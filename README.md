# 領収書撮影・送信アプリ

領収書をスマホで撮影するか、メール添付のPDFを共有するだけで、Make (Integromat) のWebhookに自動送信するPWAアプリです。

## 機能

- **カメラ撮影**: 背面カメラで領収書を直接撮影して送信
- **PDF対応**: メールアプリの「共有」ボタンからPDFを直接送信（Share Target API）
- **ファイル選択**: 画像・PDFをファイルピッカーから選択して送信
- **オフライン対応**: Service Workerによるキャッシュでオフラインでも起動可能
- **PWAインストール**: ホーム画面に追加してネイティブアプリのように使用可能

## ファイル構成

```
Receipt-Import-App/
├── index.html      # メイン画面（カメラ/ファイルボタン、ステータス表示）
├── style.css       # モバイルファーストのデザイン（ダークモード対応）
├── app.js          # カメラ撮影・ファイル選択・Webhook送信ロジック
├── manifest.json   # PWA設定（Share Target API含む）
└── sw.js           # Service Worker（キャッシュ + Share Target処理）
```

## セットアップ

### 1. Webhook URLを設定する

`app.js` の先頭にある `WEBHOOK_URL` を実際のMakeのWebhook URLに書き換えます。

```javascript
const WEBHOOK_URL = 'https://hook.eu1.make.com/xxxxxxxxxxxxxxxxxx';
```

### 2. HTTPSサーバーにデプロイする

PWA・Share Target API・カメラAPIはすべてHTTPS必須です。

| サービス | 手順 |
|---|---|
| GitHub Pages | リポジトリの Settings → Pages → ブランチを選択 |
| Netlify | リポジトリを接続してドラッグ＆ドロップでデプロイ |
| Vercel | `vercel` コマンド or GitHubリポジトリを接続 |

### 3. スマホでホーム画面に追加する

| OS | 手順 |
|---|---|
| Android (Chrome) | メニュー →「ホーム画面に追加」 |
| iOS (Safari) | 共有ボタン → 「ホーム画面に追加」 |

ホーム画面に追加すると、メールアプリの「共有」リストにこのアプリが表示されます。

## 使い方

### カメラで撮影する場合

1. アプリを開く
2. 「📷 カメラで領収書を撮影」をタップ
3. 背面カメラで撮影
4. 自動でWebhookに送信される

### メール添付のPDFを送信する場合（推奨）

1. メールアプリでPDFを開く
2. 「共有」ボタンをタップ
3. 共有先から「領収書送信」を選択
4. 自動でアプリが開き、Webhookに送信される

> **注意**: Share Target APIはAndroid Chrome/Edgeで完全対応。iOS Safariは15.4以降で対応しますが、一部制限があります。

### ファイルから選択する場合

1. アプリを開く
2. 「📎 PDFまたは画像を選択」をタップ
3. ファイルアプリ等からPDF/画像を選択
4. 自動でWebhookに送信される

## Makeシナリオの設定

Webhookモジュールが受け取るデータ:

| フィールド | 内容 |
|---|---|
| `receipt` | 画像またはPDFファイル本体 |
| `filename` | ファイル名 |
| `filetype` | MIMEタイプ（例: `image/jpeg`, `application/pdf`） |
| `timestamp` | 送信日時（ISO 8601形式） |

## ファイル連携の概要

```
[メールアプリ] --共有--> [manifest.json: Share Target]
                                    |
                                    v
                         [sw.js: POSTをインターセプト]
                                    |
                            IndexedDBに保存
                                    |
                         [app.js: 起動時に取得]
                                    |
                                    v
                         [Make Webhook に送信]
```

## 対応環境

| 機能 | Android Chrome | iOS Safari |
|---|---|---|
| カメラ撮影 | ✅ | ✅ |
| ファイル選択（PDF） | ✅ | ✅ |
| Share Target API | ✅ | ✅ (15.4+) |
| PWAインストール | ✅ | ✅ |
| オフライン起動 | ✅ | ✅ |
