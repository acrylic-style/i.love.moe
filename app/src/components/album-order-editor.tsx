"use client";

import { useState } from "react";

interface OrderImage { id: string; title: string | null; code: string }

export function AlbumOrderEditor({ albumId, initialImages }: { albumId: string; initialImages: OrderImage[] }) {
  const [images, setImages] = useState(initialImages);
  const [status, setStatus] = useState<string>();
  const [draggedId, setDraggedId] = useState<string>();

  function move(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setImages(next);
    setStatus(undefined);
  }

  function drop(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    const from = images.findIndex((image) => image.id === draggedId);
    const to = images.findIndex((image) => image.id === targetId);
    const next = [...images];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    setImages(next);
    setDraggedId(undefined);
    setStatus(undefined);
  }

  async function save() {
    setStatus("保存中…");
    const response = await fetch(`/manage/albums/${albumId}/order`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageIds: images.map((image) => image.id) }),
    });
    if (response.ok) setStatus("保存しました。");
    else if (response.status === 409) setStatus("内容が変更されています。ページを再読み込みしてください。");
    else setStatus("保存できませんでした。");
  }

  if (images.length < 2) return null;
  return <section className="order-editor"><h2>表示順</h2><p className="muted">ドラッグ、または上下ボタンで並べ替えられます。</p>
    <ol className="order-list">{images.map((image, index) => <li key={image.id} draggable
      onDragStart={() => setDraggedId(image.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => drop(image.id)}>
      <span className="drag-handle">⋮⋮</span><span>{image.title ?? image.code}</span>
      <span className="order-buttons"><button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="上へ移動">↑</button><button type="button" onClick={() => move(index, 1)} disabled={index === images.length - 1} aria-label="下へ移動">↓</button></span>
    </li>)}</ol>
    <div className="inline-form"><button className="primary" type="button" onClick={save}>並び順を保存</button>{status && <span aria-live="polite">{status}</span>}</div>
  </section>;
}
