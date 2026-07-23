import { ServerIcon } from "lucide-react";
import { getI18n } from "@/i18n/server";

export async function ServerMetadata({
  name,
  address,
  compact = false,
}: {
  name: string | null;
  address: string | null;
  compact?: boolean;
}) {
  if (!name && !address) return null;
  const { t } = await getI18n();
  return (
    <div
      className={
        compact
          ? "flex items-start gap-2 text-xs text-muted-foreground"
          : "flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm"
      }
    >
      <ServerIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0">
        {!compact && <p className="font-medium text-foreground">{t("server.capturedOn")}</p>}
        {name && <p className={compact ? "truncate text-foreground" : "text-foreground"}>{name}</p>}
        {address && <p className="break-all text-muted-foreground">{address}</p>}
      </div>
    </div>
  );
}
