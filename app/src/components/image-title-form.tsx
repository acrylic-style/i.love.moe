"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SaveState = "idle" | "saving" | "saved" | "error";

export function ImageTitleForm({ imageId, initialTitle }: { imageId: string; initialTitle: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<SaveState>("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form);
    setState("saving");

    try {
      const response = await fetch(`/manage/images/${imageId}/title`, {
        method: "POST",
        headers: { accept: "application/json" },
        body,
      });
      if (!response.ok) {
        setState("error");
        return;
      }
      setState("saved");
      router.refresh();
      window.setTimeout(() => setState("idle"), 1600);
    } catch {
      setState("error");
    }
  }

  const saving = state === "saving";
  return (
    <form className="space-y-2" method="post" action={`/manage/images/${imageId}/title`} onSubmit={submit}>
      <Label htmlFor={`title-${imageId}`}>画像タイトル</Label>
      <div className="flex gap-2">
        <Input id={`title-${imageId}`} name="title" defaultValue={initialTitle ?? ""} maxLength={100} placeholder="タイトルなし" disabled={saving} />
        <Button className="w-36" type="submit" disabled={saving} aria-disabled={saving}>
          {state === "saving" && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />}
          {state === "saved" && <CheckIcon className="size-4" aria-hidden="true" />}
          {state === "saving" ? "保存中" : state === "saved" ? "保存しました" : "保存"}
        </Button>
      </div>
      {state === "error" && <p className="text-sm text-destructive" role="alert">保存できませんでした。もう一度試してください。</p>}
    </form>
  );
}
