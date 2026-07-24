"use client";

import { useState } from "react";
import { Heart, LoaderCircle } from "lucide-react";
import { Button } from "./ui/button";

export function FavoriteButton({
  endpoint,
  initialCount,
  initialFavorited,
  label,
  failedLabel,
}: {
  endpoint: string;
  initialCount: number;
  initialFavorited: boolean;
  label: string;
  failedLabel: string;
}) {
  const [count, setCount] = useState(initialCount);
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function toggle() {
    if (pending) return;
    setPending(true);
    setFailed(false);
    const form = new FormData();
    form.set("favorited", favorited ? "0" : "1");
    try {
      const response = await fetch(endpoint, { method: "POST", body: form });
      const body = (await response.json().catch(() => null)) as {
        favorited?: boolean;
        count?: number;
      } | null;
      if (!response.ok || typeof body?.favorited !== "boolean" || typeof body.count !== "number")
        throw new Error("request_failed");
      setFavorited(body.favorited);
      setCount(body.count);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={favorited ? "text-rose-600 dark:text-rose-400" : ""}
      aria-pressed={favorited}
      aria-label={`${label}: ${count}`}
      title={failed ? failedLabel : label}
      onClick={toggle}
    >
      {pending ? (
        <LoaderCircle className="size-4 animate-spin" />
      ) : (
        <Heart className={`size-4 ${favorited ? "fill-current" : ""}`} />
      )}
      <span>{count}</span>
    </Button>
  );
}
