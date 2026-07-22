"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VisibilityFields } from "@/components/visibility-fields";
import type { Visibility } from "@/types";

type SaveState = "idle" | "saving" | "saved" | "error";

export function ImageVisibilityForm({ imageId, initialVisibility, hasPassphrase }: {
  imageId: string;
  initialVisibility: Visibility;
  hasPassphrase: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setError(null);
    try {
      const response = await fetch(`/manage/images/${imageId}/visibility`, { method: "POST", body: new FormData(event.currentTarget) });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        setError(body?.error === "invalid_passphrase" ? "合言葉は4文字以上100文字以内にしてください。" : "公開範囲を保存できませんでした。");
        setState("error");
        return;
      }
      setState("saved");
      router.refresh();
      window.setTimeout(() => setState("idle"), 1600);
    } catch {
      setError("公開範囲を保存できませんでした。もう一度試してください。");
      setState("error");
    }
  }

  const saving = state === "saving";
  return <form className="space-y-3" onSubmit={submit}>
    <VisibilityFields initialVisibility={initialVisibility} hasPassphrase={hasPassphrase} idPrefix={`image-${imageId}`} />
    <Button className="w-40" type="submit" disabled={saving}>
      {saving && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />}
      {state === "saved" && <CheckIcon className="size-4" aria-hidden="true" />}
      {saving ? "保存中" : state === "saved" ? "保存しました" : "公開範囲を保存"}
    </Button>
    {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
  </form>;
}
