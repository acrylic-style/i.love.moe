# Next.js app

Next.js App Routerを`@opennextjs/cloudflare`でCloudflare Workersへ配置する、バックエンド兼Webアプリです。UIはTailwind CSS v4とshadcn/uiで構成し、D1、R2、Email SendingをWorkers Bindingとして利用します。

## セットアップ

1. `npm install`
2. D1データベースとR2バケットを作成する。
3. `wrangler.jsonc` の `database_id` と必要ならバケット名、公開URL、Minecraft表示用URL、送信元を変更する。
4. `RATE_LIMIT_SALT` に32文字以上のランダムな秘密値を設定する。
   - ローカル: `.dev.vars.example` を `.dev.vars` へコピーして値を変更する。
   - 本番: `npm exec wrangler secret put RATE_LIMIT_SALT`
   - Discord Webhook URLの暗号化には別の32文字以上の値を使う:
     `npm exec wrangler secret put WEBHOOK_ENCRYPTION_KEY`
5. Turnstileウィジェットを作成し、`mc.moe.pictures`と公開Webドメインを許可する。サイトキーと秘密キーを設定する。
   - 本番: `npm exec wrangler secret put TURNSTILE_SITE_KEY`
   - 本番: `npm exec wrangler secret put TURNSTILE_SECRET_KEY`
6. Amazon Rekognitionの`DetectModerationLabels`だけを許可したIAMユーザーを作り、認証情報をSecretへ登録する。リージョンは既定で東京（`ap-northeast-1`）。
   - 本番: `npm exec wrangler secret put AWS_ACCESS_KEY_ID`
   - 本番: `npm exec wrangler secret put AWS_SECRET_ACCESS_KEY`
7. D1へマイグレーションを適用する。
   - ローカル: `npm run d1:migrate:local`
   - リモート: `npm run d1:migrate:remote`
8. Cloudflare Email Serviceで送信ドメインをオンボードする。
9. ローカル開発は `npm run dev`、OpenNext形式のローカル確認は `npm run preview`、本番配置は `npm run deploy` を実行する。

## コマンド

- `npm run dev`: Next.js開発サーバー
- `npm run build`: Next.js本体のビルド
- `npm run build:worker`: `.open-next/`へCloudflare Workerを生成
- `npm run preview`: Workerを生成してWranglerでローカル確認
- `npm run deploy`: retention Workerを配置してから、アプリWorkerを生成してCloudflareへ配置
- `npm run deploy:app`: アプリWorkerだけを生成してCloudflareへ配置
- `npm run deploy:retention`: Queue consumerを持つretention WorkerだけをCloudflareへ配置
- `npm run cf-typegen`: Wrangler設定からBinding型を再生成
- `npm run format`: Prettierでソースと設定ファイルを整形
- `npm run format:check`: Prettierの整形漏れを検査
- `npm run typecheck`: TypeScriptの型を検査
- `npm test`: Vitestを実行

## 言語

Web UIは英語と日本語に対応します。言語を明示的に選んでいない場合はブラウザの`Accept-Language`を使い、対応しない言語では英語を表示します。フッターではブラウザ設定、日本語、英語を切り替えられます。明示的な選択は`i_love_moe_locale` Cookieへ最長1年間保存します。

R2では `free/` プレフィックスに30日後、`plus/` プレフィックスに365日後のObject Lifecycle Ruleが設定済みであることを前提とします。アプリはこれらのルールを作成・変更しません。

## PlusとStripe

1. Stripeで月額480円の継続Priceを作り、`wrangler.jsonc` の `STRIPE_PLUS_PRICE_ID`を実際のPrice IDへ変更する。
2. `STRIPE_SECRET_KEY` と `STRIPE_WEBHOOK_SECRET` をWorkers Secretへ登録する。
3. Stripe Webhookを `/api/stripe/webhook` へ向け、Checkout完了、Subscription作成・更新・削除、Invoice支払い成功・失敗を購読する。
4. `npx wrangler queues create i-love-moe-retention` でQueueを作る。
5. D1マイグレーション後、`npm run deploy`でretention Workerとアプリを順番にデプロイする。

無料プランは直近30日50枚・30日保存・アルバム1冊20枚・URL限定公開です。Plusは直近30日500枚・365日保存・アルバム100冊各200枚・非公開／合言葉付き公開です。加入前の未失効画像はQueue Workerが`plus/`へ移行します。

Checkout Sessionではプロモーションコード入力を許可します。カード決済には`request_three_d_secure: "any"`を指定し、3Dセキュアに対応するカードで認証を要求します。実際に追加操作が表示されるかは、Stripeとカード発行会社の判定によります。

Checkout作成の冪等性キーには仕様バージョンを含めます。Checkout Sessionへ送るパラメータを変更したときは、`PLUS_CHECKOUT_IDEMPOTENCY_VERSION`も更新してください。

## サーバーページとCloudflare for SaaS

一般公開にした画像は、正規化したMinecraft接続先ごとのサーバーページへ掲載されます。所有者はDNS TXTまたは一時的にMOTD全体をトークンだけにする方法で所有確認できます。1つのサーバーには複数の接続先を追加できますが、それぞれ個別の所有確認が必要です。

Plusのサーバーブランディングでは、アイコン、バナー、ページ背景に使うテーマカラー、ボタンなどに使うアクセントカラーを設定できます。カラーは6桁のHEX形式で保存します。

所有確認済みサーバーはDiscord Webhookを無料プランで1個、Plusで5個まで登録できます。画像が初めて一般公開になったとき、紐づいたサーバーの有効なWebhookへRich Embedを送ります。画像名はEmbedのdescriptionへ設定し、Embedタイトル、サーバーフィールド名、Minecraft IDフィールド名はWebhookごとに変更できます。`allowed_mentions.parse`は空配列で、すべてのメンションを無効にします。Webhook URLはAES-GCMで暗号化して保存し、Discordが403または404を返したWebhookは自動的に無効化します。それ以外の応答では有効状態を維持します。

公開ギャラリーは24枚ずつ表示し、新着順とお気に入り数順を切り替えられます。匿名のお気に入りは`CF-Connecting-IP`を`RATE_LIMIT_SALT`でHMAC化した値を使い、同一IP・同一画像につき1票として保存します。生のIPアドレスはお気に入り用テーブルへ保存しません。管理画面の公開フィードも24枚ずつ表示し、掲載中・非表示・注目画像で絞り込めます。

トップページには確認済みサーバーを最大6件表示し、確認済みだけの一覧へ移動できます。確認済みサーバー自体にも、画像と同じIPハッシュ単位でお気に入りできます。

独自ドメインは`moe.pictures`ゾーンで次のように設定します。

1. `fallback.moe.pictures`へ値`100::`のoriginless `AAAA`レコードを作る。
2. Cloudflare for SaaSのfallback originに`fallback.moe.pictures`を指定する。
3. `mc.moe.pictures`から`fallback.moe.pictures`へのプロキシ済みCNAMEを作る。
4. `moe.pictures`ゾーンの`*/*` Worker routeを`i-love-moe` Workerへ割り当てる。
5. アプリとretention Workerの両方に`CLOUDFLARE_SAAS_API_TOKEN`と`CLOUDFLARE_SAAS_ZONE_ID`をSecretとして登録する。

利用者は所有するサブドメインを`mc.moe.pictures`へCNAME接続します。`moe.pictures`ゾーンで別サービスも運用している場合は、ワイルドカードルートを配置する前に、対象外ホストへWorkerなしの具体的なルートを追加してください。

## 法的情報

- `/terms`: 利用規約
- `/privacy`: プライバシーポリシー
- `wrangler.jsonc` の `LEGAL_NOTICE_URL`: 全ページ共通フッターに表示する「特定商取引法に基づく表記」のURL。空の場合はリンクを表示しません。

## API

- `POST /api/v1/devices`: 匿名デバイスを登録
- `GET /api/v1/account`: 端末に紐づくプランと自動アップロード可否を取得
- `POST /api/v1/images`: Bearerトークン付きでPNGをアップロード。Modは任意で撮影サーバー名・アドレスをBase64URLヘッダーへ添付
  - レスポンスの`url`はWeb用の正規URL、`minecraftUrl`はMinecraftのチャット表示・コピー用URL
- `POST /manage/images/upload`: ログイン済みWeb画面からPNG、任意のタイトル・サーバー情報をアップロード
- `GET /api/v1/images`: 所有画像の一覧
- `POST /api/v1/images/{id}/publish`: 端末が所有する画像を一般公開へ変更。無料プランでも利用可能
- `POST /api/v1/images/{id}/rename`: 端末が所有する画像のタイトルを変更
- `DELETE /api/v1/images/{id}`: 所有画像を削除
- `POST /api/v1/auth/browser-login`: 端末に紐づく一度限りのログインフォームURLを発行
- `POST /auth/browser-login`: Turnstile検証後にマジックリンクを送信
- `POST /api/v1/auth/magic-links`: 廃止済み。`410 browser_login_required`を返す
- `GET /auth/verify?token=...`: マジックリンクを検証
- `GET /{code}`: 画像またはアルバムの閲覧ページ
- `GET /raw/{code}`: PNG本体
- `POST /api/billing/checkout`: Stripe Checkoutを開始
- `POST /api/billing/portal`: Stripe Customer Portalを開始
- `POST /api/stripe/webhook`: Stripe署名付きWebhookを処理

ログイン後の `/manage` では、画像タイトルと撮影サーバー情報の確認、アルバムの作成・編集・並べ替え・削除ができます。画像とアルバムはURL限定公開、非公開、合言葉付き公開から選べます。合言葉の閲覧許可はHttpOnly Cookieで24時間保持され、設定変更時に無効になります。アルバムは1会員20冊、1冊50枚までです。撮影サーバー情報は画像・アルバムの共有ページにも表示されます。

すべての新規画像は、Cloudflare Imagesで最大1280pxのJPEGへ変換した検査用コピーをAmazon Rekognitionへ送信し、原本をR2へ保存する前に禁止コンテンツを確認します。拒否された画像や判定障害時の画像は保存しません。既存画像は遡って検査しません。アップロード試行はIPと利用者・端末の各単位でローリング1時間60回までです。公開画像の通報先は`wrangler.jsonc`の`ABUSE_CONTACT_EMAIL`で設定します。

Modは初回アップロードの直前に、Minecraft UUIDとMinecraft IDを画像と一緒に送信することをゲーム内で案内します。同意するまでプロフィール情報も画像も送信しません。同意後は撮影時のUUID・IDを画像へ保存し、共有ページでのMinecraft ID表示を初期状態でONにします。所有者は画像詳細画面から表示をOFFにできます。Modからの情報は自己申告として扱い、アカウント所有確認や権限判定には使いません。

Modの自動アップロード要求は`x-i-love-moe-auto-upload: true`を付けます。APIは端末に紐づく有効なPlus契約を確認し、無料プランには`plus_required`を返します。安全確認では`image_rejected`または`moderation_unavailable`、試行上限では`upload_rate_limited`を返します。

デバイス登録はCloudflareの `CF-Connecting-IP` をHMAC-SHA-256で匿名化し、同一IPについてローリング24時間で3回まで許可します。4回目以降は `429` と `Retry-After` を返します。
