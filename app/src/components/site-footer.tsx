export function SiteFooter({ legalNoticeUrl }: { legalNoticeUrl?: string }) {
  return <footer className="mx-auto mt-16 w-full max-w-6xl border-t py-6 text-sm text-muted-foreground">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p>© 2026 i.らぶ.moe</p>
      <nav aria-label="法的情報" className="flex flex-wrap gap-x-5 gap-y-2">
        <a className="hover:text-foreground" href="/terms">利用規約</a>
        <a className="hover:text-foreground" href="/privacy">プライバシーポリシー</a>
        {legalNoticeUrl && <a className="hover:text-foreground" href={legalNoticeUrl} rel="noreferrer">特定商取引法に基づく表記</a>}
      </nav>
    </div>
  </footer>;
}
