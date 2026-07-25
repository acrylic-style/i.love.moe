"use client";

import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { ImageIcon, LoaderCircleIcon, UploadIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VisibilityFields } from "@/components/visibility-fields";
import { useI18n } from "@/i18n/client";
import type { VerifiedMinecraftProfile } from "@/web-auth";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const UPLOAD_ERRORS = new Set([
  "image_required",
  "invalid_image_type",
  "image_too_large",
  "invalid_png",
  "upload_limit_reached",
  "upload_rate_limited",
  "image_rejected",
  "moderation_unavailable",
  "invalid_origin",
]);

interface UploadedImage {
  id: string;
  previewUrl: string;
  suggestedTitle: string;
}

export function DashboardImageUploader({
  minecraftProfiles,
  allowProtected,
}: {
  minecraftProfiles: VerifiedMinecraftProfile[];
  allowProtected: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (uploadedImage && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [uploadedImage]);

  useEffect(
    () => () => {
      if (uploadedImage) URL.revokeObjectURL(uploadedImage.previewUrl);
    },
    [uploadedImage],
  );

  async function upload(file: File) {
    setUploadError(null);
    if (file.type !== "image/png") {
      setUploadError("invalid_image_type");
      return;
    }
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      setUploadError("image_too_large");
      return;
    }

    setUploading(true);
    const previewUrl = URL.createObjectURL(file);
    const form = new FormData();
    form.set("image", file);
    try {
      const response = await fetch("/manage/images/upload", {
        method: "POST",
        headers: { accept: "application/json" },
        body: form,
      });
      const result = (await response.json().catch(() => null)) as {
        id?: string;
        error?: string;
      } | null;
      if (!response.ok || !result?.id) {
        URL.revokeObjectURL(previewUrl);
        setUploadError(result?.error ?? "request_failed");
        return;
      }
      setUploadedImage({
        id: result.id,
        previewUrl,
        suggestedTitle: file.name.replace(/\.png$/i, ""),
      });
    } catch {
      URL.revokeObjectURL(previewUrl);
      setUploadError("request_failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (!uploading) {
      const file = event.dataTransfer.files.item(0);
      if (file) void upload(file);
    }
  }

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.item(0);
    if (file) void upload(file);
  }

  function activatePicker(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.key === "Enter" || event.key === " ") && !uploading) {
      event.preventDefault();
      inputRef.current?.click();
    }
  }

  async function saveMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uploadedImage) return;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(`/manage/images/${uploadedImage.id}/finalize-upload`, {
        method: "POST",
        headers: { accept: "application/json" },
        body: new FormData(event.currentTarget),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setSaveError(result?.error ?? "request_failed");
        return;
      }
      dialogRef.current?.close();
    } catch {
      setSaveError("request_failed");
    } finally {
      setSaving(false);
    }
  }

  function finishDialog() {
    if (!uploadedImage) return;
    URL.revokeObjectURL(uploadedImage.previewUrl);
    setUploadedImage(null);
    setSaveError(null);
    router.refresh();
  }

  const uploadErrorKey =
    uploadError && UPLOAD_ERRORS.has(uploadError)
      ? `upload.error.${uploadError}`
      : "upload.error.request_failed";
  const saveErrorKey =
    saveError === "invalid_passphrase"
      ? "image.invalidPassphrase"
      : saveError === "invalid_server_metadata"
        ? "upload.error.invalid_server_metadata"
        : saveError === "plus_required"
          ? "image.protectedPlusOnly"
          : saveError === "invalid_minecraft_profile"
            ? "dashboardUpload.invalidMinecraftProfile"
            : "dashboardUpload.saveError";

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboardUpload.title")}</CardTitle>
          <CardDescription>{t("dashboardUpload.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            role="button"
            tabIndex={uploading ? -1 : 0}
            aria-disabled={uploading}
            className={`grid min-h-48 place-items-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
              dragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/60"
            } ${uploading ? "cursor-wait opacity-70" : "cursor-pointer"}`}
            onClick={() => !uploading && inputRef.current?.click()}
            onKeyDown={activatePicker}
            onDragEnter={(event) => {
              event.preventDefault();
              if (!uploading) setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (
                !(event.relatedTarget instanceof Node) ||
                !event.currentTarget.contains(event.relatedTarget)
              )
                setDragging(false);
            }}
            onDrop={drop}
          >
            <div className="space-y-3">
              {uploading ? (
                <LoaderCircleIcon
                  className="mx-auto size-10 animate-spin text-primary"
                  aria-hidden
                />
              ) : (
                <ImageIcon className="mx-auto size-10 text-primary" aria-hidden />
              )}
              <div>
                <p className="font-medium">
                  {uploading
                    ? t("upload.uploading")
                    : dragging
                      ? t("dashboardUpload.dropActive")
                      : t("dashboardUpload.drop")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{t("upload.imageHelp")}</p>
              </div>
              {!uploading && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation();
                    inputRef.current?.click();
                  }}
                >
                  <UploadIcon className="size-4" aria-hidden />
                  {t("dashboardUpload.choose")}
                </Button>
              )}
            </div>
          </div>
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept="image/png,.png"
            onChange={choose}
            disabled={uploading}
          />
          {uploadError && (
            <p className="text-sm text-destructive" role="alert">
              {t(uploadErrorKey)}
            </p>
          )}
          <p className="text-sm text-muted-foreground">{t("upload.moderationNotice")}</p>
        </CardContent>
      </Card>

      <dialog
        ref={dialogRef}
        className="m-auto max-h-[92vh] w-[min(94vw,56rem)] overflow-y-auto rounded-xl border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-black/70"
        onClose={finishDialog}
        onClick={(event) => {
          if (event.target === event.currentTarget && !saving) event.currentTarget.close();
        }}
      >
        {uploadedImage && (
          <form className="space-y-6 p-6 sm:p-8" onSubmit={saveMetadata}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">{t("dashboardUpload.dialogTitle")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("dashboardUpload.dialogDescription")}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={t("common.close")}
                disabled={saving}
                onClick={() => dialogRef.current?.close()}
              >
                <XIcon className="size-4" aria-hidden />
              </Button>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="mx-auto max-h-72 max-w-full rounded-lg bg-black/30 object-contain"
              src={uploadedImage.previewUrl}
              alt=""
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dashboard-upload-title">{t("image.titleLabel")}</Label>
                <Input
                  id="dashboard-upload-title"
                  name="title"
                  maxLength={100}
                  defaultValue={uploadedImage.suggestedTitle}
                  autoFocus
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dashboard-upload-server-address">{t("upload.serverAddress")}</Label>
                <Input
                  id="dashboard-upload-server-address"
                  name="serverAddress"
                  maxLength={255}
                  placeholder="play.example.com"
                  disabled={saving}
                />
              </div>
              {minecraftProfiles.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="dashboard-upload-profile">{t("upload.minecraftProfile")}</Label>
                  <select
                    id="dashboard-upload-profile"
                    name="minecraftProfileUuid"
                    defaultValue={minecraftProfiles[0]?.uuid ?? ""}
                    disabled={saving}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">{t("upload.minecraftProfileNone")}</option>
                    {minecraftProfiles.map((profile) => (
                      <option key={profile.uuid} value={profile.uuid}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dashboard-upload-description">{t("image.descriptionLabel")}</Label>
              <Textarea
                id="dashboard-upload-description"
                name="description"
                maxLength={1000}
                rows={4}
                disabled={saving}
              />
            </div>

            <VisibilityFields
              idPrefix="dashboard-upload"
              allowProtected={allowProtected}
              initialVisibility="unlisted"
              initialDiscoverability="hidden"
            />

            {saveError && (
              <p className="text-sm text-destructive" role="alert">
                {t(saveErrorKey)}
              </p>
            )}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => dialogRef.current?.close()}
              >
                {t("dashboardUpload.later")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
                ) : (
                  <UploadIcon className="size-4" aria-hidden />
                )}
                {saving ? t("common.saving") : t("dashboardUpload.save")}
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
