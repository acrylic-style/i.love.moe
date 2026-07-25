# i.らぶ.moe Fabric Mod

Fabric 1.20.1、1.20.4、1.21.11、26.1.2、26.2向けクライアントModです。F2でPNGの保存が成功した直後をMixinで捕捉し、クリック可能なアップロード操作をチャットへ追加します。

Plus利用者は`/ilovemoe auto-upload on`で、F2撮影後の自動アップロードを有効にできます。無料プランでは従来どおりチャットのボタンから手動でアップロードできます。

アップロード完了後のチャットには`[公開]`ボタンが表示されます。押すと画像を一般公開へ変更し、撮影サーバー情報がある場合は対応するサーバーページにも掲載します。一般公開は無料プランでも利用できます。

同じメッセージの`[名前変更]`を押すと、`/ilovemoe rename <画像ID> `がチャット欄へ入力されます。続けて日本語を含む画像タイトルを入力して実行できます。

マルチプレイ中に撮影した画像には、サーバー一覧の名前と接続先アドレスをメタデータとして添付します。この情報は画像の共有ページとアルバムにも表示されます。シングルプレイと古い画像では表示されません。

ゲーム内の表示は英語（`en_us`）と日本語（`ja_jp`）に対応し、Minecraftの言語設定に合わせて切り替わります。

## 対応バージョン

| Minecraft | Java | Gradleモジュール | 成果物 |
| --- | --- | --- | --- |
| 1.20.1 | 17 | `:versions:mc1_20_1` | `i-love-moe-mc1.20.1-<version>.jar` |
| 1.20.4 | 17 | `:versions:mc1_20_4` | `i-love-moe-mc1.20.4-<version>.jar` |
| 1.21.11 | 21 | `:versions:mc1_21_11` | `i-love-moe-mc1.21.11-<version>.jar` |
| 26.1.2 | 25 | `:versions:mc26_1_2` | `i-love-moe-mc26.1.2-<version>.jar` |
| 26.2 | 25 | `:versions:mc26_2` | `i-love-moe-mc26.2-<version>.jar` |

HTTP通信、端末認証、設定保存、メタデータのエンコードは`common`に置いています。Minecraft APIへ触れるコードは`versions`配下に分離しています。Yarn系で共通のコードは`versions/mc1_yarn`、1.20系の差分は`versions/mc1_20`、26系で共通のコードは`versions/mc26`にあります。

## 開発

5バージョンをまとめてビルドします。

```powershell
.\gradlew.bat build
```

個別にビルドする場合は、対象モジュールを指定します。

```powershell
.\gradlew.bat :versions:mc1_20_1:build
.\gradlew.bat :versions:mc1_20_4:build
.\gradlew.bat :versions:mc1_21_11:build
.\gradlew.bat :versions:mc26_1_2:build
.\gradlew.bat :versions:mc26_2:build
```

JARは各モジュールの`build/libs`に生成されます。Java 25がローカルにない場合は、Gradle Toolchainsが対応JDKを自動取得します。

初回起動時に `config/i-love-moe.json` を作成します。既定APIは `https://i.らぶ.moe` です。ローカル開発時は設定内の `apiBaseUrl` を変更してください。

## コマンド

- `/ilovemoe login`: Turnstile付きのログインフォームを開く
- `/ilovemoe manage`: Web管理画面を開く
- `/ilovemoe auto-upload`: 現在の設定を表示
- `/ilovemoe auto-upload on`: Plusを確認して自動アップロードを有効化
- `/ilovemoe auto-upload off`: 自動アップロードを無効化
- `/ilovemoe publish <画像ID>`: アップロード済み画像を一般公開
- `/ilovemoe rename <画像ID> <タイトル>`: アップロード済み画像のタイトルを変更

## Modrinthへの公開

Minotaurで5バージョンをまとめて公開できます。ModrinthのProject IDまたはslugは
`MODRINTH_PROJECT_ID`、APIトークンは`MODRINTH_TOKEN`、リリースノートは
`CHANGELOG`へ設定します。先にModrinth上でプロジェクトを作成してください。
Project IDを省略した場合は`i-love-moe`を使います。

```powershell
$env:MODRINTH_TOKEN = "..."
$env:MODRINTH_PROJECT_ID = "i-love-moe"
$env:CHANGELOG = "Release notes"
.\gradlew.bat modrinth --no-daemon
```

1バージョンだけ公開する場合は、たとえば
`.\gradlew.bat :versions:mc1_21_11:modrinth --no-daemon`を実行します。同じ
`mod_version`とMinecraftバージョンの組み合わせは再公開できないため、公開前に
`gradle.properties`の`mod_version`を更新してください。

GitHub Actionsは手動実行または`v*`タグのpushで同じタスクを実行します。Repository
Secretに`MODRINTH_TOKEN`を登録し、slugが`i-love-moe`でない場合だけRepository
Variableの`MODRINTH_PROJECT_ID`も設定してください。

## CurseForgeへの公開

CurseForgeGradleでProject ID `1624436`へ5バージョンをまとめて公開できます。
CurseForge Authorsで発行したアップロード用トークンを`CURSEFORGE_TOKEN`、リリース
ノートを`CHANGELOG`へ設定します。

```powershell
$env:CURSEFORGE_TOKEN = "..."
$env:CHANGELOG = "Release notes"
.\gradlew.bat curseforge --no-daemon
```

各ファイルにはMinecraftバージョン、Fabric、Client環境、Javaバージョン、
Fabric APIの必須依存関係が設定されます。別のProject IDで確認する場合だけ
`CURSEFORGE_PROJECT_ID`で上書きできます。

1バージョンだけ公開する場合は、たとえば
`.\gradlew.bat :versions:mc1_20_1:curseforge --no-daemon`を実行します。同じ
`mod_version`とMinecraftバージョンの組み合わせを重複して公開しないよう、
公開前に`gradle.properties`の`mod_version`を更新してください。

GitHub Actionsは手動実行または`v*`タグのpushで全バージョンを公開します。
Repository Secretに`CURSEFORGE_TOKEN`を登録してください。プロジェクトや
各ファイルが審査中の場合、アップロード後も承認されるまでは一般公開されません。
