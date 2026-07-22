import type { AlbumImageRow, AlbumRow, ImageRow } from "@/types";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_album: "題名・説明・画像数をご確認ください。",
  invalid_images: "選択できない画像が含まれています。ページを再読み込みしてください。",
  album_limit_reached: "作成できるアルバムは20冊までです。",
};

export function AlbumForm({
  action,
  images,
  album,
  selectedImages = [],
  error,
  submitLabel,
}: {
  action: string;
  images: ImageRow[];
  album?: AlbumRow;
  selectedImages?: AlbumImageRow[];
  error?: string;
  submitLabel: string;
}) {
  const selected = new Set(selectedImages.map((image) => image.id));
  return (
    <form className="stack album-form" method="post" action={action}>
      {error && ERROR_MESSAGES[error] && <p className="error">{ERROR_MESSAGES[error]}</p>}
      <label htmlFor="album-title">題名</label>
      <input id="album-title" name="title" required maxLength={100} defaultValue={album?.title ?? ""} />
      <label htmlFor="album-description">説明（任意）</label>
      <textarea id="album-description" name="description" maxLength={1000} rows={4} defaultValue={album?.description ?? ""} />
      <fieldset><legend>収録画像（最大50枚）</legend>
        {images.length === 0 ? <p className="empty">追加できる画像がございません。</p> : <div className="image-picker">{images.map((image) => (
          <label className="image-choice" key={image.id}>
            <input type="checkbox" name="imageIds" value={image.id} defaultChecked={selected.has(image.id)} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/raw/${image.code}`} alt="" />
            <span>{image.title ?? image.code}</span>
          </label>
        ))}</div>}
      </fieldset>
      <button className="primary" type="submit">{submitLabel}</button>
    </form>
  );
}
