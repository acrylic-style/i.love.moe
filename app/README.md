# Next.js app

Next.js App Routerを`@opennextjs/cloudflare`でCloudflare Workersへ配置する、バックエンド兼Webアプリです。UIはTailwind CSS v4とshadcn/uiで構成し、D1、R2、Email SendingをWorkers Bindingとして利用します。

## セットアップ

1. `npm install`
2. D1データベースとR2バケットを作成する。
3. `wrangler.jsonc` の `database_id` と必要ならバケット名、公開URL、送信元を変更する。
4. `RATE_LIMIT_SALT` に32文字以上のランダムな秘密値を設定する。
   - ローカル: `.dev.vars.example` を `.dev.vars` へコピーして値を変更する。
   - 本番: `npm exec wrangler secret put RATE_LIMIT_SALT`
5. D1へマイグレーションを適用する。
   - ローカル: `npm run d1:migrate:local`
   - リモート: `npm run d1:migrate:remote`
6. Cloudflare Email Serviceで送信ドメインをオンボードする。
7. ローカル開発は `npm run dev`、OpenNext形式のローカル確認は `npm run preview`、本番配置は `npm run deploy` を実行する。

## コマンド

- `npm run dev`: Next.js開発サーバー
- `npm run build`: Next.js本体のビルド
- `npm run build:worker`: `.open-next/`へCloudflare Workerを生成
- `npm run preview`: Workerを生成してWranglerでローカル確認
- `npm run deploy`: Workerを生成してCloudflareへ配置
- `npm run cf-typegen`: Wrangler設定からBinding型を再生成

R2では `free/` プレフィックスに対して30日後削除のObject Lifecycle Ruleが設定済みであることを前提とします。アプリはこのルールを作成・変更しません。

## API

- `POST /api/v1/devices`: 匿名デバイスを登録
- `POST /api/v1/images`: Bearerトークン付きでPNGをアップロード
- `GET /api/v1/images`: 所有画像の一覧
- `DELETE /api/v1/images/{id}`: 所有画像を削除
- `POST /api/v1/auth/magic-links`: マジックリンクを送信
- `GET /auth/verify?token=...`: マジックリンクを検証
- `GET /{code}`: 画像またはアルバムの閲覧ページ
- `GET /raw/{code}`: PNG本体

ログイン後の `/manage` では、画像タイトルの編集とアルバムの作成・編集・並べ替え・削除ができます。アルバムはURL限定公開で、1会員20冊、1冊50枚までです。

デバイス登録はCloudflareの `CF-Connecting-IP` をHMAC-SHA-256で匿名化し、同一IPについてローリング24時間で3回まで許可します。4回目以降は `429` と `Retry-After` を返します。
