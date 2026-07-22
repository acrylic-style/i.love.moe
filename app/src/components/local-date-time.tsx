"use client";

import { useEffect, useState } from "react";

export function LocalDateTime({ value }: { value: string }) {
  const [formatted, setFormatted] = useState<string>();

  useEffect(() => {
    const date = new Date(value);
    setFormatted(new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(date));
  }, [value]);

  return <time dateTime={value}>{formatted ?? "読み込み中…"}</time>;
}
