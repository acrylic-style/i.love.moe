"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";

export function LocalDateTime({ value }: { value: string }) {
  const { locale, t } = useI18n();
  const [formatted, setFormatted] = useState<string>();

  useEffect(() => {
    const date = new Date(value);
    setFormatted(
      new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(date),
    );
  }, [locale, value]);

  return <time dateTime={value}>{formatted ?? t("common.loading")}</time>;
}
