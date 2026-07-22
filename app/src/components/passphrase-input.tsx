"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PassphraseInput({ id, required, placeholder, autoFocus = false, autoComplete = "new-password", disabled = false }: {
  id: string;
  required?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  autoComplete?: "new-password" | "current-password";
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return <div className="flex gap-2">
    <Input className="min-w-0" id={id} name="passphrase" type={visible ? "text" : "password"}
      minLength={4} maxLength={100} required={required} autoComplete={autoComplete}
      placeholder={placeholder} autoFocus={autoFocus} disabled={disabled} />
    <Button className="w-24" type="button" variant="outline" aria-pressed={visible} disabled={disabled}
      aria-label={visible ? "合言葉を隠す" : "合言葉を表示する"} onClick={() => setVisible((current) => !current)}>
      {visible ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
      {visible ? "隠す" : "表示"}
    </Button>
  </div>;
}
