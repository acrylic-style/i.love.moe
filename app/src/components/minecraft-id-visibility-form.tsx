"use client";

import { type FormEvent, useState } from "react";
import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/client";

type SaveState = "idle" | "saving" | "saved" | "error";

export function MinecraftIdVisibilityForm({
  imageId,
  minecraftName,
  minecraftUuid,
  initialPublic,
}: {
  imageId: string;
  minecraftName: string;
  minecraftUuid: string;
  initialPublic: boolean;
}) {
  const { t } = useI18n();
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [state, setState] = useState<SaveState>("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    try {
      const body = new FormData();
      body.set("minecraftIdPublic", String(isPublic));
      const response = await fetch(`/manage/images/${imageId}/minecraft-id`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        setState("error");
        return;
      }
      setState("saved");
      window.setTimeout(() => setState("idle"), 1600);
    } catch {
      setState("error");
    }
  }

  const saving = state === "saving";
  return (
    <form className="space-y-3" onSubmit={submit}>
      <div>
        <h2 className="font-semibold">{t("image.minecraftIdHeading")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("image.minecraftIdDescription")}</p>
      </div>
      <div className="rounded-lg border bg-muted/30 p-4 text-sm">
        <p className="font-medium">{minecraftName}</p>
        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{minecraftUuid}</p>
      </div>
      <div className="flex items-start gap-3">
        <Checkbox
          id={`minecraft-id-public-${imageId}`}
          checked={isPublic}
          onCheckedChange={(checked) => setIsPublic(checked === true)}
          disabled={saving}
        />
        <div className="space-y-1">
          <Label htmlFor={`minecraft-id-public-${imageId}`}>{t("image.minecraftIdPublic")}</Label>
          <p className="text-sm text-muted-foreground">{t("image.minecraftIdPublicDescription")}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("image.minecraftIdUnverified")}</p>
      <Button className="w-40" type="submit" disabled={saving}>
        {saving && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />}
        {state === "saved" && <CheckIcon className="size-4" aria-hidden="true" />}
        {saving ? t("common.saving") : state === "saved" ? t("common.saved") : t("common.save")}
      </Button>
      {state === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {t("image.minecraftIdSaveError")}
        </p>
      )}
    </form>
  );
}
