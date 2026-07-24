"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VisibilityFields } from "@/components/visibility-fields";
import type { Discoverability, Visibility } from "@/types";
import { useI18n } from "@/i18n/client";

type SaveState = "idle" | "saving" | "saved" | "error";

export function ImageVisibilityForm({
  imageId,
  initialVisibility,
  initialDiscoverability,
  hasPassphrase,
  allowProtected = true,
}: {
  imageId: string;
  initialVisibility: Visibility;
  initialDiscoverability: Discoverability;
  hasPassphrase: boolean;
  allowProtected?: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setError(null);
    try {
      const response = await fetch(`/manage/images/${imageId}/visibility`, {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(
          body?.error === "invalid_passphrase"
            ? t("image.invalidPassphrase")
            : body?.error === "plus_required"
              ? t("image.protectedPlusOnly")
              : t("image.visibilitySaveError"),
        );
        setState("error");
        return;
      }
      setState("saved");
      router.refresh();
      window.setTimeout(() => setState("idle"), 1600);
    } catch {
      setError(t("image.visibilityRetryError"));
      setState("error");
    }
  }

  const saving = state === "saving";
  return (
    <form className="space-y-3" onSubmit={submit}>
      <VisibilityFields
        initialVisibility={initialVisibility}
        initialDiscoverability={initialDiscoverability}
        hasPassphrase={hasPassphrase}
        idPrefix={`image-${imageId}`}
        allowProtected={allowProtected}
      />
      <Button className="w-40" type="submit" disabled={saving}>
        {saving && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />}
        {state === "saved" && <CheckIcon className="size-4" aria-hidden="true" />}
        {saving
          ? t("common.saving")
          : state === "saved"
            ? t("common.saved")
            : t("image.visibilitySave")}
      </Button>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
