import type { AlbumImageRow, AlbumRow, ImageRow } from "@/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ServerMetadata } from "@/components/server-metadata";
import { VisibilityFields } from "@/components/visibility-fields";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_album: "題名・説明・画像数をご確認ください。",
  invalid_images: "選択できない画像が含まれています。ページを再読み込みしてください。",
  album_limit_reached: "作成できるアルバム数の上限に達しました。",
  invalid_access: "公開範囲と合言葉をご確認ください。",
  plus_required: "この操作にはPlusが必要です。",
};

export function AlbumForm({
  action,
  images,
  album,
  selectedImages = [],
  error,
  submitLabel,
  allowProtected = true,
  maxImages = 50,
}: {
  action: string;
  images: ImageRow[];
  album?: AlbumRow;
  selectedImages?: AlbumImageRow[];
  error?: string;
  submitLabel: string;
  allowProtected?: boolean;
  maxImages?: number;
}) {
  const selected = new Set(selectedImages.map((image) => image.id));
  return (
    <form className="space-y-6" method="post" action={action}>
      {error && ERROR_MESSAGES[error] && <p className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{ERROR_MESSAGES[error]}</p>}
      <div className="space-y-2"><Label htmlFor="album-title">題名</Label><Input id="album-title" name="title" required maxLength={100} defaultValue={album?.title ?? ""} /></div>
      <div className="space-y-2"><Label htmlFor="album-description">説明（任意）</Label><Textarea id="album-description" name="description" maxLength={1000} rows={4} defaultValue={album?.description ?? ""} /></div>
      <VisibilityFields initialVisibility={album?.visibility ?? "unlisted"} hasPassphrase={Boolean(album?.has_passphrase)} idPrefix="album" allowProtected={allowProtected} />
      <p className="text-sm text-muted-foreground">アルバムに入れた画像は、アルバムの公開範囲で表示されます。画像単体の公開範囲は変わりません。</p>
      <fieldset className="rounded-lg border p-4"><legend className="px-2 text-sm font-medium">収録画像（最大{maxImages}枚）</legend>
        {images.length === 0 ? <p className="text-sm text-muted-foreground">追加できる画像はありません。</p> : <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{images.map((image) => (
          <Label className="group relative grid cursor-pointer gap-2 rounded-lg border p-2 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/10" key={image.id}>
            <Checkbox className="absolute left-3 top-3 z-10 bg-background" name="imageIds" value={image.id} defaultChecked={selected.has(image.id)} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="h-28 w-full rounded-md object-cover" src={`/raw/${image.code}`} alt="" />
            <span className="truncate px-1">{image.title ?? image.code}</span>
            <ServerMetadata name={image.server_name} address={image.server_address} compact />
          </Label>
        ))}</div>}
      </fieldset>
      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
