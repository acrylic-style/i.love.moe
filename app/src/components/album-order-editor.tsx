"use client";

import { useState } from "react";
import { GripVerticalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  return <section className="space-y-4 border-t pt-8"><div><h2 className="text-2xl font-semibold">表示順</h2><p className="text-muted-foreground">ドラッグ、または上下ボタンで並べ替えられます。</p></div>
    <ol className="grid gap-2">{images.map((image, index) => <li className="flex items-center gap-3 rounded-lg border bg-card p-3" key={image.id} draggable
      onDragStart={() => setDraggedId(image.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => drop(image.id)}>
      <GripVerticalIcon className="size-4 cursor-grab text-muted-foreground" /><span>{image.title ?? image.code}</span>
      <span className="ml-auto flex gap-1"><Button variant="outline" size="icon" type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="上へ移動">↑</Button><Button variant="outline" size="icon" type="button" onClick={() => move(index, 1)} disabled={index === images.length - 1} aria-label="下へ移動">↓</Button></span>
    </li>)}</ol>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center"><Button type="button" onClick={save}>並び順を保存</Button>{status && <span className="text-sm text-muted-foreground" aria-live="polite">{status}</span>}</div>
  </section>;
}
