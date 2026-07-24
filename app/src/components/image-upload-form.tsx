"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon, UploadIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/client";

export function ImageUploadForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [moderationReason, setModerationReason] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    setErrorCode(null);
    setModerationReason(null);

    try {
      const response = await fetch("/manage/images/upload", {
        method: "POST",
        headers: { accept: "application/json" },
        body: new FormData(event.currentTarget),
      });
      const result = (await response.json().catch(() => null)) as {
        id?: string;
        error?: string;
        reason?: string;
      } | null;
      if (!response.ok || !result?.id) {
        setErrorCode(result?.error ?? "request_failed");
        setModerationReason(result?.reason ?? null);
        return;
      }
      router.push(`/manage/images/${result.id}`);
      router.refresh();
    } catch {
      setErrorCode("request_failed");
    } finally {
      setUploading(false);
    }
  }

  const knownErrors = new Set([
    "image_required",
    "invalid_image_type",
    "image_too_large",
    "invalid_png",
    "invalid_upload_metadata",
    "invalid_server_metadata",
    "upload_limit_reached",
    "upload_rate_limited",
    "image_rejected",
    "moderation_unavailable",
    "invalid_origin",
  ]);
  const errorKey =
    errorCode && knownErrors.has(errorCode)
      ? `upload.error.${errorCode}`
      : "upload.error.request_failed";
  const knownModerationReasons = new Set([
    "configuration_missing",
    "image_transform_failed",
    "preview_empty",
    "preview_too_large",
    "rekognition_timeout",
    "rekognition_network_error",
    "rekognition_http_error",
    "invalid_rekognition_response",
  ]);
  const moderationReasonKey =
    moderationReason && knownModerationReasons.has(moderationReason)
      ? `upload.moderationReason.${moderationReason}`
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("upload.title")}</CardTitle>
        <CardDescription>{t("upload.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="upload-image">{t("upload.image")}</Label>
            <Input
              id="upload-image"
              name="image"
              type="file"
              accept="image/png,.png"
              required
              disabled={uploading}
            />
            <p className="text-sm text-muted-foreground">{t("upload.imageHelp")}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="upload-title">{t("upload.imageTitle")}</Label>
              <Input id="upload-title" name="title" maxLength={100} disabled={uploading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upload-server-address">{t("upload.serverAddress")}</Label>
              <Input
                id="upload-server-address"
                name="serverAddress"
                maxLength={255}
                placeholder="play.example.com"
                disabled={uploading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upload-server-name">{t("upload.serverName")}</Label>
              <Input
                id="upload-server-name"
                name="serverName"
                maxLength={100}
                disabled={uploading}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{t("upload.moderationNotice")}</p>
          {errorCode && (
            <div className="space-y-1 text-sm text-destructive" role="alert">
              <p>{t(errorKey)}</p>
              {errorCode === "moderation_unavailable" && moderationReasonKey && (
                <p>{t("upload.moderationReason", { reason: t(moderationReasonKey) })}</p>
              )}
            </div>
          )}
          <Button type="submit" className="min-w-44" disabled={uploading}>
            {uploading ? (
              <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <UploadIcon className="size-4" aria-hidden="true" />
            )}
            {uploading ? t("upload.uploading") : t("upload.submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
