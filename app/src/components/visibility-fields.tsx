"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { PassphraseInput } from "@/components/passphrase-input";
import type { Visibility } from "@/types";

const OPTIONS: Array<{ value: Visibility; label: string; description: string }> = [
  { value: "unlisted", label: "URL限定公開", description: "URLを知っている人が見られます。" },
  { value: "private", label: "非公開", description: "ログイン中のあなただけが見られます。" },
  { value: "passphrase", label: "合言葉付き公開", description: "合言葉を知っている人が見られます。" },
];

export function VisibilityFields({ initialVisibility = "unlisted", hasPassphrase = false, idPrefix = "share", allowProtected = true }: {
  initialVisibility?: Visibility;
  hasPassphrase?: boolean;
  idPrefix?: string;
  allowProtected?: boolean;
}) {
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  return <fieldset className="space-y-3 rounded-lg border p-4">
    <legend className="px-2 text-sm font-medium">公開範囲</legend>
    <div className="grid gap-2 sm:grid-cols-3">{OPTIONS.map((option) => (
      <Label key={option.value} className="flex items-start gap-3 rounded-lg border p-3 has-checked:border-primary has-checked:bg-primary/10">
        <input className="mt-1 accent-primary" type="radio" name="visibility" value={option.value}
          checked={visibility === option.value} onChange={() => setVisibility(option.value)}
          disabled={!allowProtected && option.value !== "unlisted" && option.value !== initialVisibility} />
        <span><span className="block font-medium">{option.label}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{option.description}</span></span>
      </Label>
    ))}</div>
    {!allowProtected && <p className="text-xs text-muted-foreground">非公開と合言葉付き公開はPlusで使えます。 <a className="text-primary hover:underline" href="/plus">Plusを見る</a></p>}
    {visibility === "passphrase" && <div className="space-y-2 pt-2">
      <Label htmlFor={`${idPrefix}-passphrase`}>合言葉</Label>
      <PassphraseInput id={`${idPrefix}-passphrase`} required={!hasPassphrase && allowProtected}
        placeholder={hasPassphrase ? "変更するときだけ入力" : "4文字以上100文字以内"} disabled={!allowProtected} />
      <p className="text-xs text-muted-foreground">{hasPassphrase ? "空欄のままなら、今の合言葉を使います。" : "4文字以上100文字以内で決めてください。"}</p>
    </div>}
  </fieldset>;
}
