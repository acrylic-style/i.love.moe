import { ServerIcon } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { VerifiedMark } from "@/components/verified-mark";

export async function ServerMetadata({
  name,
  address,
  compact = false,
  href,
  verified = false,
}: {
  name: string | null;
  address: string | null;
  compact?: boolean;
  href?: string;
  verified?: boolean;
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
        {href ? (
          <a className="hover:underline" href={href}>
            {name && (
              <p
                className={
                  compact
                    ? "flex items-center gap-1 truncate text-foreground"
                    : "flex items-center gap-1 text-foreground"
                }
              >
                <span className="truncate">{name}</span>
                {verified && <VerifiedMark label={t("servers.verified")} iconOnly />}
              </p>
            )}
            {address && <p className="break-all text-muted-foreground">{address}</p>}
          </a>
        ) : (
          <>
            {name && (
              <p
                className={
                  compact
                    ? "flex items-center gap-1 truncate text-foreground"
                    : "flex items-center gap-1 text-foreground"
                }
              >
                <span className="truncate">{name}</span>
                {verified && <VerifiedMark label={t("servers.verified")} iconOnly />}
              </p>
            )}
            {address && <p className="break-all text-muted-foreground">{address}</p>}
          </>
        )}
      </div>
    </div>
  );
}
