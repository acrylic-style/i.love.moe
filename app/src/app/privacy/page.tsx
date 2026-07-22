import type { Metadata } from "next";
import { LegalDocument, LegalList, LegalSection } from "@/components/legal-document";

export const metadata: Metadata = { title: "プライバシーポリシー" };

export default function PrivacyPage() {
  return <LegalDocument title="プライバシーポリシー" description="制定・施行日：2026年7月23日">
    <p>i.らぶ.moeの運営者（以下「運営者」といいます。）は、本サービスで取り扱う利用者情報を、個人情報の保護に関する法律その他の関係法令に従い、次のとおり取り扱います。</p>

    <LegalSection title="1. 取得する情報">
      <p>運営者は、次の情報を取得します。</p>
      <LegalList>
        <li><span className="text-foreground">アカウント情報：</span>メールアドレス、利用者ID、登録日時</li>
        <li><span className="text-foreground">端末・認証情報：</span>端末ID、端末トークン・ログインリンク・セッション・合言葉閲覧許可トークンのハッシュ、作成日時、有効期限、最終利用日時</li>
        <li><span className="text-foreground">投稿データ：</span>スクリーンショット、画像タイトル、画像サイズ・寸法、アルバム名・説明・並び順、公開範囲、Minecraftサーバー名・アドレス、短縮URL、保存期限</li>
        <li><span className="text-foreground">保護設定：</span>合言葉から生成したソルトとハッシュ。合言葉そのものは保存しません。</li>
        <li><span className="text-foreground">契約情報：</span>Stripe Customer ID、Subscription ID、Price ID、契約状態、請求周期、料金、解約予定日時、支払い成功・失敗の状態。カード番号などの決済情報はStripeが取り扱い、運営者のデータベースには保存しません。</li>
        <li><span className="text-foreground">利用・セキュリティ情報：</span>アップロードやアクセスの日時、エラー・処理ログ、レート制限のために秘密鍵付きハッシュへ変換したIPアドレス、ブラウザや通信に伴う技術情報</li>
      </LegalList>
    </LegalSection>

    <LegalSection title="2. 利用目的">
      <LegalList>
        <li>画像の保存、短縮URLによる共有、アルバム、公開範囲その他本サービスの提供</li>
        <li>端末認証、マジックリンクログイン、セッション維持、本人確認</li>
        <li>Plusプランの申込み、支払い、契約状態の反映、解約および問い合わせ対応</li>
        <li>保存期限、利用上限、画像移行その他プランごとの機能管理</li>
        <li>不正アクセス、合言葉の総当たり、過剰な端末登録、規約違反の検知・防止</li>
        <li>障害調査、品質改善、利用状況の把握、運営上必要な連絡</li>
        <li>法令上の義務の履行、紛争・権利侵害への対応</li>
      </LegalList>
    </LegalSection>

    <LegalSection title="3. Cookieとローカルな認証情報">
      <LegalList>
        <li>本サービスは、ログイン状態を最長30日間維持するため、HttpOnly・Secure・SameSite=Lax属性のセッションCookieを使用します。</li>
        <li>合言葉付きコンテンツの閲覧許可を最長24時間維持するため、同様に保護されたCookieを使用します。</li>
        <li>Fabric Modは、端末を識別してアップロードを認証するためのトークンを利用者の端末に保持します。</li>
        <li>これらは本サービスの提供と安全確保に必要なものであり、広告目的の追跡Cookieは使用していません。</li>
      </LegalList>
    </LegalSection>

    <LegalSection title="4. 公開と共有に関する注意">
      <LegalList>
        <li>URL限定公開を選んだ投稿データは、短縮URLを知るすべての人が閲覧できます。</li>
        <li>合言葉付き公開を選んだ投稿データは、URLと合言葉を知る人が閲覧できます。合言葉の第三者への共有は利用者自身で管理してください。</li>
        <li>非公開を選んだ投稿データは、原則として所有者としてログインした利用者だけが閲覧できます。</li>
        <li>利用者が自ら第三者へ共有した情報については、共有先で保存・再共有される場合があります。</li>
      </LegalList>
    </LegalSection>

    <LegalSection title="5. 外部サービスと委託">
      <p>運営者は、本サービスの提供に必要な範囲で、次の事業者へ情報の取扱いを委託します。各事業者は国外の設備を利用する場合があります。</p>
      <LegalList>
        <li><span className="text-foreground">Cloudflare, Inc.：</span>Workers、D1、R2、Queues、メール送信、配信・セキュリティ・ログ基盤</li>
        <li><span className="text-foreground">Stripe, Inc.およびその関連会社：</span>決済、継続課金、Customer Portal、不正利用防止</li>
      </LegalList>
      <p>外部事業者による取扱いには、各事業者のプライバシーポリシーが適用されます。</p>
    </LegalSection>

    <LegalSection title="6. 第三者提供">
      <p>運営者は、利用者の同意がある場合、法令に基づく場合、人の生命・身体・財産の保護に必要な場合、事業承継に伴う場合、または法令上第三者提供に当たらない委託の場合を除き、個人データを第三者へ提供しません。</p>
    </LegalSection>

    <LegalSection title="7. 保存期間と削除">
      <LegalList>
        <li>画像ファイルは、原則としてアップロード時に表示された期限まで保存します。本ポリシー制定時点では無料プランが30日、Plusプランが365日です。</li>
        <li>利用者が画像を削除した場合、または保存期限を過ぎた場合、画像ファイルは削除対象となります。短時間の処理待ち、キャッシュ、障害復旧用の残存が生じる場合があります。</li>
        <li>マジックリンクは15分、ログインセッションは30日、合言葉閲覧許可は24時間を有効期間とします。</li>
        <li>アカウント情報、契約・取引記録、セキュリティログ、削除済みデータの最小限のメタデータは、サービス運営、法令遵守、紛争対応、不正利用防止に必要な期間保存し、不要になった後に削除または識別できない形へ処理します。</li>
      </LegalList>
    </LegalSection>

    <LegalSection title="8. 安全管理措置">
      <p>運営者は、アクセス制御、認証トークンと合言葉のハッシュ化、通信の暗号化、権限分離、レート制限、ログ監視、保存期限による削除など、取り扱う情報の性質に応じた安全管理措置を講じます。ただし、インターネット上の安全性を完全に保証するものではありません。</p>
    </LegalSection>

    <LegalSection title="9. 開示・訂正・利用停止などの請求">
      <p>利用者は、法令の定めに従い、自身の保有個人データについて、利用目的の通知、開示、訂正、追加、削除、利用停止、消去または第三者提供の停止を請求できます。本人確認を行ったうえで、法令に従って対応します。請求方法は、フッターの「特定商取引法に基づく表記」に記載する連絡先へお問い合わせください。</p>
    </LegalSection>

    <LegalSection title="10. 未成年者の情報">
      <p>未成年者は、親権者など法定代理人の同意を得て本サービスを利用してください。必要に応じて、同意の確認をお願いする場合があります。</p>
    </LegalSection>

    <LegalSection title="11. ポリシーの変更">
      <p>運営者は、法令やサービス内容の変更に応じて本ポリシーを変更できます。重要な変更は、効力発生日までにウェブサイトその他適切な方法で案内します。</p>
    </LegalSection>

    <LegalSection title="12. お問い合わせ">
      <p>本ポリシー、個人情報の取扱い、開示などの請求に関するお問い合わせは、フッターの「特定商取引法に基づく表記」に記載する運営者の連絡先へお願いします。</p>
    </LegalSection>
  </LegalDocument>;
}
