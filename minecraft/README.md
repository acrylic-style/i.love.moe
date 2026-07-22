# i.らぶ.moe Fabric Mod

Fabric 1.21.11向けクライアントModです。F2でPNGの保存が成功した直後をMixinで捕捉し、クリック可能なアップロード操作をチャットへ追加します。

## 開発

```powershell
.\gradlew.bat build
```

初回起動時に `config/i-love-moe.json` を作成します。既定APIは `https://i.らぶ.moe` です。ローカル開発時は設定内の `apiBaseUrl` を変更してください。

## コマンド

- `/ilovemoe login <email>`: 会員化用マジックリンクを送信
- `/ilovemoe manage`: Web管理画面を開く
