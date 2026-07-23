"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { PassphraseInput } from "@/components/passphrase-input";
import type { Visibility } from "@/types";
import { useI18n } from "@/i18n/client";

export function VisibilityFields({
  initialVisibility = "unlisted",
  hasPassphrase = false,
  idPrefix = "share",
  allowProtected = true,
}: {
  initialVisibility?: Visibility;
  hasPassphrase?: boolean;
  idPrefix?: string;
  allowProtected?: boolean;
}) {
  const { t } = useI18n();
  const options: Array<{ value: Visibility; label: string; description: string }> = [
    {
      value: "unlisted",
      label: t("visibility.unlisted"),
      description: t("visibility.unlistedDescription"),
    },
    {
      value: "private",
      label: t("visibility.private"),
      description: t("visibility.privateDescription"),
    },
    {
      value: "passphrase",
      label: t("visibility.passphrase"),
      description: t("visibility.passphraseDescription"),
    },
  ];
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  return (
    <fieldset className="space-y-3 rounded-lg border p-4">
      <legend className="px-2 text-sm font-medium">{t("visibility.heading")}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <Label
            key={option.value}
            className="flex items-start gap-3 rounded-lg border p-3 has-checked:border-primary has-checked:bg-primary/10"
          >
            <input
              className="mt-1 accent-primary"
              type="radio"
              name="visibility"
              value={option.value}
              checked={visibility === option.value}
              onChange={() => setVisibility(option.value)}
              disabled={
                !allowProtected && option.value !== "unlisted" && option.value !== initialVisibility
              }
            />
            <span>
              <span className="block font-medium">{option.label}</span>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {option.description}
              </span>
            </span>
          </Label>
        ))}
      </div>
      {!allowProtected && (
        <p className="text-xs text-muted-foreground">
          {t("visibility.plusOnly")}{" "}
          <a className="text-primary hover:underline" href="/plus">
            {t("home.viewPlus")}
          </a>
        </p>
      )}
      {visibility === "passphrase" && (
        <div className="space-y-2 pt-2">
          <Label htmlFor={`${idPrefix}-passphrase`}>{t("visibility.passphraseLabel")}</Label>
          <PassphraseInput
            id={`${idPrefix}-passphrase`}
            required={!hasPassphrase && allowProtected}
            placeholder={
              hasPassphrase
                ? t("visibility.passphraseChangePlaceholder")
                : t("visibility.passphrasePlaceholder")
            }
            disabled={!allowProtected}
          />
          <p className="text-xs text-muted-foreground">
            {hasPassphrase ? t("visibility.passphraseKeep") : t("visibility.passphraseRule")}
          </p>
        </div>
      )}
    </fieldset>
  );
}
