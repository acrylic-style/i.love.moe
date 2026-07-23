# i.らぶ.moe Fabric Mod

Fabric 1.21.11向けクライアントModです。F2でPNGの保存が成功した直後をMixinで捕捉し、クリック可能なアップロード操作をチャットへ追加します。

Plus利用者は`/ilovemoe auto-upload on`で、F2撮影後の自動アップロードを有効にできます。無料プランでは従来どおりチャットのボタンから手動でアップロードできます。

マルチプレイ中に撮影した画像には、サーバー一覧の名前と接続先アドレスをメタデータとして添付します。この情報は画像の共有ページとアルバムにも表示されます。シングルプレイと古い画像では表示されません。

## 開発

```powershell
.\gradlew.bat build
```

初回起動時に `config/i-love-moe.json` を作成します。既定APIは `https://i.らぶ.moe` です。ローカル開発時は設定内の `apiBaseUrl` を変更してください。

## コマンド

- `/ilovemoe login <email>`: 会員化用マジックリンクを送信
- `/ilovemoe manage`: Web管理画面を開く
- `/ilovemoe auto-upload`: 現在の設定を表示
- `/ilovemoe auto-upload on`: Plusを確認して自動アップロードを有効化
- `/ilovemoe auto-upload off`: 自動アップロードを無効化
