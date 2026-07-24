import type { Metadata } from "next";
import { LegalDocument, LegalList, LegalSection } from "@/components/legal-document";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { title: locale === "ja" ? "利用規約" : "Terms of Service" };
}

export default async function TermsPage() {
  const { locale } = await getI18n();
  if (locale === "en") return <EnglishTerms />;
  return (
    <LegalDocument title="利用規約" description="制定・施行日：2026年7月23日">
      <p>
        この利用規約（以下「本規約」といいます。）は、i.らぶ.moeの運営者（以下「運営者」といいます。）が提供するMinecraftスクリーンショットの保存・共有サービス「i.らぶ.moe」（以下「本サービス」といいます。）の利用条件を定めるものです。
      </p>

      <LegalSection title="第1条 適用と同意">
        <LegalList>
          <li>
            本規約は、本サービスを利用するすべての方（以下「利用者」といいます。）と運営者との間に適用されます。
          </li>
          <li>
            利用者は、本サービスを利用した時点、またはPlusプランを申し込んだ時点で、本規約と
            <a className="text-primary hover:underline" href="/privacy">
              プライバシーポリシー
            </a>
            に同意したものとします。
          </li>
          <li>未成年者は、親権者など法定代理人の同意を得たうえで本サービスを利用してください。</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="第2条 本サービスの内容">
        <LegalList>
          <li>
            本サービスは、Fabric
            ModからMinecraftのスクリーンショットをアップロードし、短縮URLで閲覧・共有する機能を提供します。
          </li>
          <li>
            ログインした利用者は、画像タイトル、Minecraftサーバー名・アドレス、アルバム、タグ、お気に入り、公開範囲などを管理できます。
          </li>
          <li>
            公開範囲には、一般公開、URL限定公開、非公開、合言葉付き公開があります。一般公開はサーバーページ、検索結果、接続された独自ドメインに掲載されます。URL限定公開は検索一覧への掲載を意図しない方式ですが、URLを知る人の閲覧を技術的に制限するものではありません。
          </li>
          <li>
            本サービスはMojang StudiosまたはMicrosoft
            Corporationが提供、承認、後援するものではありません。Minecraftに関する商標その他の権利は各権利者に帰属します。
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="第3条 端末情報とアカウント">
        <LegalList>
          <li>
            利用者は、Modに発行された端末トークン、ログイン用メール、セッションその他の認証情報を適切に管理してください。
          </li>
          <li>
            認証情報を使って行われた操作は、運営者に故意または重過失がある場合を除き、その利用者による操作として扱います。
          </li>
          <li>
            不正利用のおそれがある場合、利用者は速やかに認証情報の利用を中止し、運営者へ連絡してください。
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="第4条 投稿データと共有">
        <LegalList>
          <li>
            利用者は、アップロードする画像、タイトル、アルバム説明、サーバー情報その他のデータ（以下「投稿データ」といいます。）について、保存・共有に必要な権利または許可を有することを保証します。
          </li>
          <li>
            Minecraftのスクリーンショットには、他のプレイヤーの名前、スキン、チャット、サーバー情報などが含まれる場合があります。利用者は、関係者のプライバシー、各サーバーの規約、著作権その他の権利に配慮してください。
          </li>
          <li>
            短縮URLや合言葉を第三者へ渡したことによる閲覧については、利用者自身で共有先と取扱いを管理してください。
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="第5条 投稿データの権利">
        <LegalList>
          <li>投稿データに関する権利は、利用者または正当な権利者に留保されます。</li>
          <li>
            利用者は運営者に対し、本サービスの提供、保存、バックアップ、表示、送信、サイズ調整、障害対応に必要な範囲で、投稿データを複製、公衆送信その他利用する非独占的な権利を許諾します。この許諾は、本サービス提供のために必要な範囲に限られます。
          </li>
          <li>
            運営者は、法令違反、権利侵害、セキュリティ上の危険または本規約違反があると合理的に判断した投稿データを、非公開化または削除できるものとします。
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="第6条 保存期間と削除">
        <LegalList>
          <li>
            画像の保存期限はアップロード時に決まり、管理画面などに表示されます。本規約制定時点では、無料プランはアップロードから30日、Plusプランは365日です。
          </li>
          <li>
            保存期限を過ぎた画像は自動的に削除され、復元できません。利用者による削除操作も原則として取り消せません。
          </li>
          <li>
            Plus加入時には、まだ保存期限を迎えていない対象画像をPlus用保存領域へ移行します。障害などにより移行できない場合があるため、重要な画像は利用者自身でも保管してください。
          </li>
          <li>
            Plus解約後も既存画像の保存期限と公開状態は維持されますが、新しいアップロードや編集には無料プランの制限が適用されます。
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="第7条 Plusプランと支払い">
        <LegalList>
          <li>
            Plusプランの料金、請求周期、機能、上限その他の条件は、申込画面および特定商取引法に基づく表記に表示します。
          </li>
          <li>
            支払いと定期購入の管理にはStripeを利用します。利用者はStripeが定める条件にも従うものとします。
          </li>
          <li>Plusプランは、利用者が解約しない限り、表示された請求周期で自動更新されます。</li>
          <li>
            利用者は契約管理画面から解約できます。期間終了時の解約を選んだ場合、支払い済み期間の末日までPlusを利用できます。
          </li>
          <li>
            法令上必要な場合または運営者が別途認めた場合を除き、支払い済み料金の日割り返金は行いません。
          </li>
          <li>支払いが確認できない場合、運営者は猶予期間を設けたうえでPlus機能を停止できます。</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="第8条 禁止事項">
        <p>利用者は、次の行為をしてはいけません。</p>
        <LegalList>
          <li>法令、公序良俗、第三者の権利、Minecraftまたは各サーバーの利用条件に違反する行為</li>
          <li>
            権利侵害、嫌がらせ、差別、脅迫、わいせつ、児童の安全を害する内容その他他者へ重大な不利益を与える投稿
          </li>
          <li>マルウェア、不正なコード、過度な負荷を生じさせるデータの送信</li>
          <li>認証情報の不正取得、他者へのなりすまし、アクセス制御やレート制限の回避</li>
          <li>本サービスまたは関連システムへの不正アクセス、解析、脆弱性の悪用</li>
          <li>
            本サービスの運営を妨害する行為、または運営者が同等の危険があると合理的に判断する行為
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="第9条 利用停止">
        <p>
          運営者は、利用者が本規約に違反した場合、セキュリティ上必要な場合、料金の支払いがない場合、または法令・権利者から適法な要請を受けた場合、事前の通知なく投稿データの非公開化、機能制限、利用停止または契約解除を行うことがあります。ただし、状況に応じて可能な範囲で理由や対応方法を案内します。
        </p>
      </LegalSection>

      <LegalSection title="第10条 サービスの変更・中断・終了">
        <LegalList>
          <li>
            運営者は、保守、障害、セキュリティ対応、外部サービスの停止、法令対応その他必要な場合に、本サービスの全部または一部を変更・中断できます。
          </li>
          <li>
            本サービスを終了するときは、緊急の場合を除き、合理的な期間を設けてウェブサイトその他適切な方法で案内します。
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="第11条 保証と責任の範囲">
        <LegalList>
          <li>
            運営者は、本サービスに中断、エラー、データ消失、第三者による閲覧その他の不具合が生じないことを保証しません。重要な画像は利用者自身でもバックアップしてください。
          </li>
          <li>
            運営者の責任を法令上制限できる場合、運営者が負う損害賠償責任は、通常かつ直接の損害に限り、有料利用者については損害発生前6か月間に受領した利用料金、無料利用者については1,000円を上限とします。
          </li>
          <li>
            前項は、運営者の故意または重過失による場合、生命・身体への損害が生じた場合、その他消費者契約法などの法令により責任を制限できない場合には適用しません。
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="第12条 規約の変更">
        <p>
          運営者は、法令の変更、本サービス内容の変更その他合理的な必要がある場合、本規約を変更できます。利用者へ重大な影響がある変更は、効力発生日までにウェブサイトその他適切な方法で案内します。変更後に本サービスを利用した場合、変更後の規約に同意したものとします。
        </p>
      </LegalSection>

      <LegalSection title="第13条 準拠法と裁判管轄">
        <p>
          本規約は日本法に準拠します。本サービスに関する紛争については、法令で別段の定めがある場合を除き、東京地方裁判所または東京簡易裁判所を第一審の専属的合意管轄裁判所とします。
        </p>
      </LegalSection>

      <LegalSection title="第14条 お問い合わせ">
        <p>
          本規約または本サービスに関するお問い合わせは、フッターの「特定商取引法に基づく表記」に記載する連絡先へお願いします。
        </p>
      </LegalSection>
    </LegalDocument>
  );
}

function EnglishTerms() {
  return (
    <LegalDocument title="Terms of Service" description="Established and effective: July 23, 2026">
      <p>
        These Terms of Service (the “Terms”) set out the conditions for using i.らぶ.moe (the
        “Service”), a Minecraft screenshot storage and sharing service provided by the operator of
        i.らぶ.moe (the “Operator”).
      </p>

      <LegalSection title="Article 1 — Application and acceptance">
        <LegalList>
          <li>These Terms apply between the Operator and every person who uses the Service.</li>
          <li>
            By using the Service or subscribing to Plus, you agree to these Terms and the{" "}
            <a className="text-primary hover:underline" href="/privacy">
              Privacy Policy
            </a>
            .
          </li>
          <li>
            Minors must obtain consent from a parent or other legal representative before using the
            Service.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Article 2 — Service description">
        <LegalList>
          <li>
            The Service lets users upload Minecraft screenshots from the Fabric Mod and view or
            share them through short URLs.
          </li>
          <li>
            Signed-in users can manage image titles, Minecraft server names and addresses, albums,
            tags, favorites, visibility, and related settings.
          </li>
          <li>
            Visibility options include public, anyone with the URL, private, and
            passphrase-protected. Public content may appear on server pages, search results, and
            connected custom domains. Anyone-with-the-URL sharing is not intended for search
            listings, but it does not technically restrict access by a person who knows the URL.
          </li>
          <li>
            The Service is not provided, approved, or sponsored by Mojang Studios or Microsoft
            Corporation. Minecraft trademarks and other rights belong to their respective owners.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Article 3 — Devices and accounts">
        <LegalList>
          <li>
            You must properly manage device tokens issued to the Mod, sign-in email, sessions, and
            other authentication information.
          </li>
          <li>
            Unless the Operator acted intentionally or with gross negligence, operations performed
            with your authentication information are treated as operations performed by you.
          </li>
          <li>
            If you suspect unauthorized use, stop using the affected authentication information and
            contact the Operator promptly.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Article 4 — Uploaded data and sharing">
        <LegalList>
          <li>
            You represent that you have the rights or permission needed to store and share images,
            titles, album descriptions, server information, and other data you submit (“Uploaded
            Data”).
          </li>
          <li>
            Minecraft screenshots may contain player names, skins, chat, and server information. You
            must respect the privacy of others, server rules, copyright, and other rights.
          </li>
          <li>
            You are responsible for choosing recipients and managing short URLs or passphrases that
            you disclose to others.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Article 5 — Rights in Uploaded Data">
        <LegalList>
          <li>Rights in Uploaded Data remain with you or the applicable rights holder.</li>
          <li>
            You grant the Operator a non-exclusive right to reproduce, transmit, display, resize,
            back up, and otherwise use Uploaded Data only as necessary to provide, maintain, and
            troubleshoot the Service.
          </li>
          <li>
            The Operator may make Uploaded Data private or delete it when the Operator reasonably
            determines that it violates law, infringes rights, creates a security risk, or breaches
            these Terms.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Article 6 — Retention and deletion">
        <LegalList>
          <li>
            An image expiration date is determined at upload and displayed in the dashboard or
            elsewhere. As of the effective date of these Terms, Free images are retained for 30 days
            and Plus images for 365 days.
          </li>
          <li>
            Images are automatically deleted after expiration and cannot be restored. User-initiated
            deletion also generally cannot be undone.
          </li>
          <li>
            When you join Plus, eligible unexpired images are moved to Plus storage. Because a
            failure may prevent migration, keep your own copies of important images.
          </li>
          <li>
            After Plus is canceled, existing expiration dates and visibility remain unchanged, but
            Free limits apply to new uploads and edits.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Article 7 — Plus and payment">
        <LegalList>
          <li>
            Pricing, billing periods, features, limits, and other Plus conditions are shown during
            checkout and in the Commercial Transactions Disclosure.
          </li>
          <li>
            Stripe handles payments and subscriptions. You must also comply with Stripe’s applicable
            terms.
          </li>
          <li>Plus renews automatically for the displayed billing period until canceled.</li>
          <li>
            You can cancel from the subscription management page. If cancellation is scheduled for
            period end, Plus remains available through the paid period.
          </li>
          <li>
            Paid fees are not prorated or refunded unless required by law or separately approved by
            the Operator.
          </li>
          <li>
            If payment cannot be confirmed, the Operator may suspend Plus after providing a grace
            period.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Article 8 — Prohibited conduct">
        <p>You must not:</p>
        <LegalList>
          <li>Violate law, public order, third-party rights, Minecraft terms, or server rules.</li>
          <li>
            Upload infringing, harassing, discriminatory, threatening, obscene, child-endangering,
            or otherwise seriously harmful content.
          </li>
          <li>Transmit malware, malicious code, or data that creates excessive load.</li>
          <li>
            Improperly obtain credentials, impersonate others, or evade access controls or rate
            limits.
          </li>
          <li>
            Access systems without authorization, analyze them improperly, or exploit weaknesses.
          </li>
          <li>
            Interfere with operation of the Service or engage in conduct the Operator reasonably
            considers similarly dangerous.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Article 9 — Suspension">
        <p>
          The Operator may make Uploaded Data private, restrict features, suspend use, or terminate
          a subscription without advance notice if you breach these Terms, security requires it,
          payment is overdue, or the Operator receives a lawful request from an authority or rights
          holder. Where appropriate, the Operator will provide reasons and available remedies when
          reasonably possible.
        </p>
      </LegalSection>

      <LegalSection title="Article 10 — Changes, interruptions, and termination">
        <LegalList>
          <li>
            The Operator may change or interrupt all or part of the Service for maintenance,
            failures, security response, third-party service outages, legal compliance, or other
            necessary reasons.
          </li>
          <li>
            Except in emergencies, the Operator will provide reasonable advance notice through the
            website or another appropriate method before ending the Service.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Article 11 — Warranties and limitation of liability">
        <LegalList>
          <li>
            The Operator does not guarantee that the Service will be uninterrupted or free from
            errors, data loss, unauthorized viewing, or other defects. Keep your own backups of
            important images.
          </li>
          <li>
            Where liability may legally be limited, the Operator is liable only for ordinary and
            direct damages. Liability is capped at fees received during the six months preceding the
            damage for paid users and JPY 1,000 for free users.
          </li>
          <li>
            The preceding limitation does not apply to intentional misconduct or gross negligence,
            death or personal injury, or any other case in which liability cannot be limited under
            consumer protection or other law.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Article 12 — Changes to these Terms">
        <p>
          The Operator may amend these Terms when reasonably necessary because of changes in law,
          the Service, or other circumstances. Material changes will be announced through the
          website or another appropriate method before taking effect. Continued use after a change
          constitutes acceptance of the revised Terms.
        </p>
      </LegalSection>

      <LegalSection title="Article 13 — Governing law and jurisdiction">
        <p>
          These Terms are governed by Japanese law. Unless otherwise required by law, the Tokyo
          District Court or Tokyo Summary Court has exclusive jurisdiction as the court of first
          instance over disputes concerning the Service.
        </p>
      </LegalSection>

      <LegalSection title="Article 14 — Contact">
        <p>
          For questions about these Terms or the Service, use the Operator contact information in
          the Commercial Transactions Disclosure linked from the footer.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
