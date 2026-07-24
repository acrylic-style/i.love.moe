import type { Metadata } from "next";
import { LegalDocument, LegalList, LegalSection } from "@/components/legal-document";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { title: locale === "ja" ? "プライバシーポリシー" : "Privacy Policy" };
}

export default async function PrivacyPage() {
  const { locale } = await getI18n();
  if (locale === "en") return <EnglishPrivacy />;
  return (
    <LegalDocument title="プライバシーポリシー" description="制定・施行日：2026年7月24日">
      <p>
        i.らぶ.moeの運営者（以下「運営者」といいます。）は、本サービスで取り扱う利用者情報を、個人情報の保護に関する法律その他の関係法令に従い、次のとおり取り扱います。
      </p>

      <LegalSection title="1. 取得する情報">
        <p>運営者は、次の情報を取得します。</p>
        <LegalList>
          <li>
            <span className="text-foreground">アカウント情報：</span>
            メールアドレス、利用者ID、登録日時
          </li>
          <li>
            <span className="text-foreground">端末・認証情報：</span>
            端末ID、端末トークン・ログインリンク・セッション・合言葉閲覧許可トークンのハッシュ、作成日時、有効期限、最終利用日時
          </li>
          <li>
            <span className="text-foreground">投稿データ：</span>
            スクリーンショット、画像タイトル、画像サイズ・寸法、アルバム名・説明・並び順、タグ、お気に入り、公開範囲、Minecraftサーバー名・アドレス、サーバーページのプロフィール・検証情報・編集者、接続する独自ドメイン、短縮URL、保存期限
          </li>
          <li>
            <span className="text-foreground">Discord連携情報：</span>
            暗号化したWebhook URL、管理画面上の表示名、有効・無効状態、送信成否と日時
          </li>
          <li>
            <span className="text-foreground">Minecraftプロフィール情報：</span>
            Modから画像と一緒に送信されたMinecraft UUID、Minecraft
            ID、送信元端末、初回・最終確認日時、画像ごとの表示設定
          </li>
          <li>
            <span className="text-foreground">保護設定：</span>
            合言葉から生成したソルトとハッシュ。合言葉そのものは保存しません。
          </li>
          <li>
            <span className="text-foreground">契約情報：</span>Stripe Customer ID、Subscription
            ID、Price
            ID、契約状態、請求周期、料金、解約予定日時、支払い成功・失敗の状態。カード番号などの決済情報はStripeが取り扱い、運営者のデータベースには保存しません。
          </li>
          <li>
            <span className="text-foreground">利用・セキュリティ情報：</span>
            アップロードやアクセスの日時、画像の自動確認結果・モデルバージョン、エラー・処理ログ、レート制限と匿名お気に入りの重複防止のために秘密鍵付きハッシュへ変換したIPアドレス、レート制限のために同様に変換したメールアドレス、ブラウザや通信に伴う技術情報
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="2. 利用目的">
        <LegalList>
          <li>画像の保存、短縮URLによる共有、アルバム、公開範囲その他本サービスの提供</li>
          <li>端末認証、マジックリンクログイン、セッション維持、本人確認</li>
          <li>Plusプランの申込み、支払い、契約状態の反映、解約および問い合わせ対応</li>
          <li>保存期限、利用上限、画像移行その他プランごとの機能管理</li>
          <li>確認済みサーバーの管理者が設定したDiscordチャンネルへの公開画像の通知</li>
          <li>
            不正アクセス、合言葉の総当たり、過剰な端末登録、禁止コンテンツその他の規約違反の検知・防止
          </li>
          <li>障害調査、品質改善、利用状況の把握、運営上必要な連絡</li>
          <li>法令上の義務の履行、紛争・権利侵害への対応</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="3. Cookieとローカルな認証情報">
        <LegalList>
          <li>
            本サービスは、ログイン状態を最長30日間維持するため、HttpOnly・Secure・SameSite=Lax属性のセッションCookieを使用します。
          </li>
          <li>
            合言葉付きコンテンツの閲覧許可を最長24時間維持するため、同様に保護されたCookieを使用します。
          </li>
          <li>
            Fabric
            Modは、端末を識別してアップロードを認証するためのトークンを利用者の端末に保持します。
          </li>
          <li>
            Modは初回アップロードの直前に送信内容を案内し、利用者が同意した後に限り、画像と一緒にMinecraft
            UUIDとMinecraft IDを送信します。画像をアップロードする前には送信しません。
          </li>
          <li>
            フッターで選んだ言語を最長1年間保存するため、SameSite=Lax属性の言語設定Cookieを使用します。
          </li>
          <li>
            これらは本サービスの提供と安全確保に必要なものであり、広告目的の追跡Cookieは使用していません。
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="4. 公開と共有に関する注意">
        <LegalList>
          <li>
            一般公開を選んだ投稿データ、サーバーページのプロフィール、検証済み接続先は、検索結果や利用者が接続した独自ドメインを含め、誰でも閲覧できます。
          </li>
          <li>URL限定公開を選んだ投稿データは、短縮URLを知るすべての人が閲覧できます。</li>
          <li>
            合言葉付き公開を選んだ投稿データは、URLと合言葉を知る人が閲覧できます。合言葉の第三者への共有は利用者自身で管理してください。
          </li>
          <li>
            非公開を選んだ投稿データは、原則として所有者としてログインした利用者だけが閲覧できます。
          </li>
          <li>
            利用者が自ら第三者へ共有した情報については、共有先で保存・再共有される場合があります。
          </li>
          <li>
            サーバー管理者がDiscord
            Webhookを設定している場合、そのサーバーに紐づく一般公開画像のタイトル、画像、共有URL、サーバー情報および公開設定中のMinecraft
            IDが、設定先のDiscordチャンネルへ送信されます。
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="5. 外部サービスと委託">
        <p>
          運営者は、本サービスの提供に必要な範囲で、次の事業者へ情報の取扱いを委託します。各事業者は国外の設備を利用する場合があります。
        </p>
        <LegalList>
          <li>
            <span className="text-foreground">Cloudflare, Inc.：</span>
            Workers、D1、R2、Queues、メール送信、Turnstile、配信・セキュリティ・ログ基盤
          </li>
          <li>
            <span className="text-foreground">Stripe, Inc.およびその関連会社：</span>
            決済、継続課金、Customer Portal、不正利用防止
          </li>
          <li>
            <span className="text-foreground">Amazon Web Services, Inc.：</span>
            禁止コンテンツの自動確認。保存前の画像を縮小・変換した一時的な複製をAmazon
            Rekognitionへ送信し、判定結果とモデルのバージョンを記録します。
          </li>
          <li>
            <span className="text-foreground">Discord Inc.：</span>
            確認済みサーバーの管理者がWebhook連携を有効にした場合の、公開画像のチャンネル通知
          </li>
        </LegalList>
        <p>外部事業者による取扱いには、各事業者のプライバシーポリシーが適用されます。</p>
      </LegalSection>

      <LegalSection title="6. 第三者提供">
        <p>
          運営者は、利用者の同意がある場合、法令に基づく場合、人の生命・身体・財産の保護に必要な場合、事業承継に伴う場合、または法令上第三者提供に当たらない委託の場合を除き、個人データを第三者へ提供しません。
        </p>
      </LegalSection>

      <LegalSection title="7. 保存期間と削除">
        <LegalList>
          <li>
            画像ファイルは、原則としてアップロード時に表示された期限まで保存します。本ポリシー制定時点では無料プランが30日、Plusプランが365日です。
          </li>
          <li>
            利用者が画像を削除した場合、または保存期限を過ぎた場合、画像ファイルは削除対象となります。短時間の処理待ち、キャッシュ、障害復旧用の残存が生じる場合があります。
          </li>
          <li>
            マジックリンクは15分、ログインセッションは30日、合言葉閲覧許可は24時間を有効期間とします。
          </li>
          <li>
            アカウント情報、契約・取引記録、セキュリティログ、削除済みデータの最小限のメタデータは、サービス運営、法令遵守、紛争対応、不正利用防止に必要な期間保存し、不要になった後に削除または識別できない形へ処理します。
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="8. 安全管理措置">
        <p>
          運営者は、アクセス制御、認証トークンと合言葉のハッシュ化、通信の暗号化、権限分離、レート制限、ログ監視、保存期限による削除など、取り扱う情報の性質に応じた安全管理措置を講じます。ただし、インターネット上の安全性を完全に保証するものではありません。
        </p>
      </LegalSection>

      <LegalSection title="9. 開示・訂正・利用停止などの請求">
        <p>
          利用者は、法令の定めに従い、自身の保有個人データについて、利用目的の通知、開示、訂正、追加、削除、利用停止、消去または第三者提供の停止を請求できます。本人確認を行ったうえで、法令に従って対応します。請求方法は、フッターの「特定商取引法に基づく表記」に記載する連絡先へお問い合わせください。
        </p>
      </LegalSection>

      <LegalSection title="10. 未成年者の情報">
        <p>
          未成年者は、親権者など法定代理人の同意を得て本サービスを利用してください。必要に応じて、同意の確認をお願いする場合があります。
        </p>
      </LegalSection>

      <LegalSection title="11. ポリシーの変更">
        <p>
          運営者は、法令やサービス内容の変更に応じて本ポリシーを変更できます。重要な変更は、効力発生日までにウェブサイトその他適切な方法で案内します。
        </p>
      </LegalSection>

      <LegalSection title="12. お問い合わせ">
        <p>
          本ポリシー、個人情報の取扱い、開示などの請求に関するお問い合わせは、フッターの「特定商取引法に基づく表記」に記載する運営者の連絡先へお願いします。
        </p>
      </LegalSection>
    </LegalDocument>
  );
}

function EnglishPrivacy() {
  return (
    <LegalDocument title="Privacy Policy" description="Established and effective: July 24, 2026">
      <p>
        The operator of i.らぶ.moe (the “Operator”) handles user information processed through the
        Service as described below, in accordance with Japan’s Act on the Protection of Personal
        Information and other applicable laws.
      </p>

      <LegalSection title="1. Information we collect">
        <p>The Operator collects the following information:</p>
        <LegalList>
          <li>
            <span className="text-foreground">Account information: </span>
            Email address, user ID, and registration time.
          </li>
          <li>
            <span className="text-foreground">Device and authentication information: </span>
            Device IDs; hashes of device tokens, sign-in links, sessions, and passphrase access
            tokens; creation and expiration times; and last-used times.
          </li>
          <li>
            <span className="text-foreground">Uploaded data: </span>
            Screenshots, image titles, file sizes and dimensions, album names and descriptions,
            display order, tags, favorites, visibility, Minecraft server names and addresses,
            server-page profiles, verification and editor information, connected custom domains,
            short URLs, and expiration dates.
          </li>
          <li>
            <span className="text-foreground">Discord integration information: </span>
            Encrypted webhook URLs, management display names, enabled or disabled status, delivery
            results, and delivery times.
          </li>
          <li>
            <span className="text-foreground">Minecraft profile information: </span>
            Minecraft UUIDs and Minecraft IDs sent by the Mod with images, source devices, first-
            and last-seen times, and per-image display settings.
          </li>
          <li>
            <span className="text-foreground">Protection settings: </span>
            Salts and hashes derived from passphrases. The passphrases themselves are not stored.
          </li>
          <li>
            <span className="text-foreground">Subscription information: </span>
            Stripe Customer, Subscription, and Price IDs; subscription status; billing interval;
            price; scheduled cancellation time; and payment success or failure. Stripe handles card
            numbers and other payment credentials, which are not stored in the Operator’s database.
          </li>
          <li>
            <span className="text-foreground">Usage and security information: </span>
            Upload and access times, automated image-check results and model versions, error and
            processing logs, IP addresses transformed into keyed hashes for rate limiting and
            anonymous-favorite deduplication, email addresses similarly transformed for rate
            limiting, and technical information accompanying browser and network communication.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="2. Purposes of use">
        <LegalList>
          <li>
            To provide image storage, short-URL sharing, albums, visibility controls, and other
            Service features.
          </li>
          <li>
            To authenticate devices, send magic links, maintain sessions, and verify identity.
          </li>
          <li>
            To process Plus enrollment, payment, subscription status, cancellation, and support.
          </li>
          <li>To manage expiration, usage limits, migration, and other plan-specific features.</li>
          <li>
            To notify Discord channels configured by verified-server managers about public images.
          </li>
          <li>
            To detect and prevent unauthorized access, passphrase guessing, excessive device
            registration, prohibited content, and other violations of the Terms.
          </li>
          <li>
            To investigate failures, improve quality, understand usage, and send operational
            notices.
          </li>
          <li>To comply with legal obligations and address disputes or rights infringements.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="3. Cookies and locally stored authentication information">
        <LegalList>
          <li>
            The Service uses an HttpOnly, Secure, SameSite=Lax session cookie to maintain sign-in
            for up to 30 days.
          </li>
          <li>
            A similarly protected cookie maintains permission to view passphrase-protected content
            for up to 24 hours.
          </li>
          <li>
            The Fabric Mod stores a token on your device to identify it and authenticate uploads.
          </li>
          <li>
            Immediately before the first upload, the Mod explains what will be sent. Only after you
            agree does it send the Minecraft UUID and Minecraft ID with an image. It does not send
            them before an upload.
          </li>
          <li>
            A SameSite=Lax preference cookie stores the language selected in the footer for up to
            one year.
          </li>
          <li>
            These technologies are necessary to provide and secure the Service. The Operator does
            not use advertising-tracking cookies.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="4. Public and shared content">
        <LegalList>
          <li>
            Public Uploaded Data, server-page profiles, and verified connection addresses can be
            viewed by anyone, including through search results and user-connected custom domains.
          </li>
          <li>
            Uploaded Data shared with anyone who has the URL can be viewed by anyone who knows it.
          </li>
          <li>
            Passphrase-protected Uploaded Data can be viewed by people who know both the URL and the
            passphrase. You are responsible for managing disclosure of the passphrase.
          </li>
          <li>Private Uploaded Data can generally be viewed only by its signed-in owner.</li>
          <li>
            Information you share with another person may be stored or reshared by that recipient.
          </li>
          <li>
            If a server manager configures a Discord webhook, public images associated with that
            server may send their title, image, sharing URL, server details, and any publicly
            displayed Minecraft ID to the configured Discord channel.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="5. Service providers">
        <p>
          The Operator entrusts information to the following providers only as necessary to provide
          the Service. They may use infrastructure outside Japan.
        </p>
        <LegalList>
          <li>
            <span className="text-foreground">Cloudflare, Inc.: </span>
            Workers, D1, R2, Queues, email delivery, Turnstile, content delivery, security, and
            logging infrastructure.
          </li>
          <li>
            <span className="text-foreground">Stripe, Inc. and its affiliates: </span>
            Payments, recurring billing, Customer Portal, and fraud prevention.
          </li>
          <li>
            <span className="text-foreground">Amazon Web Services, Inc.: </span>
            Automated prohibited-content checks. Before storage, a resized and converted temporary
            copy of an image is sent to Amazon Rekognition. The moderation result and model version
            are recorded.
          </li>
          <li>
            <span className="text-foreground">Discord Inc.: </span>
            Channel notifications for public images when enabled by a verified-server manager.
          </li>
        </LegalList>
        <p>Each provider’s privacy policy applies to its handling of information.</p>
      </LegalSection>

      <LegalSection title="6. Disclosure to third parties">
        <p>
          The Operator does not provide personal data to third parties except with your consent, as
          required by law, when necessary to protect life, body, or property, in connection with a
          business succession, or when processing is entrusted in a manner that is not legally
          treated as third-party disclosure.
        </p>
      </LegalSection>

      <LegalSection title="7. Retention and deletion">
        <LegalList>
          <li>
            Image files are generally retained until the expiration shown at upload. As of this
            Policy’s effective date, the period is 30 days for Free and 365 days for Plus.
          </li>
          <li>
            When you delete an image or its retention period expires, the image is scheduled for
            deletion. Short processing delays, cached copies, or disaster-recovery remnants may
            temporarily remain.
          </li>
          <li>
            Magic links remain valid for 15 minutes, sign-in sessions for 30 days, and passphrase
            viewing permission for 24 hours.
          </li>
          <li>
            Account information, subscription and transaction records, security logs, and minimal
            metadata about deleted data are retained only as necessary for operation, legal
            compliance, dispute handling, and abuse prevention, then deleted or de-identified.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="8. Security measures">
        <p>
          The Operator uses measures appropriate to the information handled, including access
          controls, hashing of authentication tokens and passphrases, encrypted transport,
          separation of privileges, rate limits, log monitoring, and expiration-based deletion.
          However, internet security cannot be guaranteed completely.
        </p>
      </LegalSection>

      <LegalSection title="9. Requests for disclosure, correction, or suspension">
        <p>
          Subject to applicable law, you may request notice of purpose, disclosure, correction,
          addition, deletion, suspension of use, erasure, or suspension of third-party provision of
          your retained personal data. The Operator will verify identity and respond in accordance
          with law. Use the contact information in the Commercial Transactions Disclosure linked
          from the footer.
        </p>
      </LegalSection>

      <LegalSection title="10. Information about minors">
        <p>
          Minors must use the Service with consent from a parent or other legal representative. The
          Operator may request confirmation of that consent when necessary.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes to this Policy">
        <p>
          The Operator may change this Policy in response to changes in law or the Service. Material
          changes will be announced through the website or another appropriate method before taking
          effect.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          For questions about this Policy, handling of personal information, or disclosure requests,
          use the Operator contact information in the Commercial Transactions Disclosure linked from
          the footer.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
