import type { AlbumImageRow, AlbumRow, ImageRow, ServerRow } from "@/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ServerMetadata } from "@/components/server-metadata";
import { VisibilityFields } from "@/components/visibility-fields";
import { getI18n } from "@/i18n/server";

export async function AlbumForm({
  action,
  images,
  album,
  selectedImages = [],
  error,
  submitLabel,
  allowProtected = true,
  maxImages = 50,
  servers = [],
}: {
  action: string;
  images: ImageRow[];
  album?: AlbumRow;
  selectedImages?: AlbumImageRow[];
  error?: string;
  submitLabel: string;
  allowProtected?: boolean;
  maxImages?: number;
  servers?: ServerRow[];
}) {
  const { t } = await getI18n();
  const errorMessages: Record<string, string> = {
    invalid_album: t("album.invalid"),
    invalid_images: t("album.invalidImages"),
    album_limit_reached: t("album.limitReached"),
    invalid_access: t("album.invalidAccess"),
    plus_required: t("album.plusRequired"),
    invalid_server: t("album.invalidServer"),
  };
  const selected = new Set(selectedImages.map((image) => image.id));
  return (
    <form className="space-y-6" method="post" action={action}>
      {error && errorMessages[error] && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessages[error]}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="album-title">{t("album.titleLabel")}</Label>
        <Input
          id="album-title"
          name="title"
          required
          maxLength={100}
          defaultValue={album?.title ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="album-description">{t("album.descriptionLabel")}</Label>
        <Textarea
          id="album-description"
          name="description"
          maxLength={1000}
          rows={4}
          defaultValue={album?.description ?? ""}
        />
      </div>
      <VisibilityFields
        initialVisibility={album?.visibility ?? "unlisted"}
        initialDiscoverability={album?.discoverability ?? "hidden"}
        hasPassphrase={Boolean(album?.has_passphrase)}
        idPrefix="album"
        allowProtected={allowProtected}
      />
      <p className="text-sm text-muted-foreground">{t("album.visibilityNote")}</p>
      <div className="space-y-2">
        <Label htmlFor="album-server">{t("album.serverLabel")}</Label>
        <select
          id="album-server"
          name="serverId"
          defaultValue={album?.server_id ?? ""}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
        >
          <option value="">{t("album.noServer")}</option>
          {servers.map((server) => (
            <option key={server.id} value={server.id}>
              {server.display_name ?? server.display_address ?? server.code}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">{t("album.serverDescription")}</p>
      </div>
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-medium">
          {t("album.imagesLegend", { count: maxImages })}
        </legend>
        {images.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("album.noAvailableImages")}</p>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((image) => (
              <Label
                className="group relative grid cursor-pointer gap-2 rounded-lg border p-2 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/10"
                key={image.id}
              >
                <Checkbox
                  className="absolute left-3 top-3 z-10 bg-background"
                  name="imageIds"
                  value={image.id}
                  defaultChecked={selected.has(image.id)}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="h-28 w-full rounded-md object-cover"
                  src={`/raw/${image.code}`}
                  alt=""
                />
                <span className="truncate px-1">{image.title ?? image.code}</span>
                <ServerMetadata name={image.server_name} address={image.server_address} compact />
              </Label>
            ))}
          </div>
        )}
      </fieldset>
      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
