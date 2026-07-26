"use client";

import { type FormEvent, useState } from "react";
import { CheckIcon, ClipboardIcon, KeyRoundIcon, LoaderCircleIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { LocalDateTime } from "@/components/local-date-time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ManagedServerApiToken } from "@/server-api";

export function ServerApiTokens({
  serverId,
  tokens,
  locale,
  plus,
}: {
  serverId: string;
  tokens: ManagedServerApiToken[];
  locale: "ja" | "en";
  plus: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ token: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ja = locale === "ja";
  const copy = ja
    ? {
        title: "読み取り専用APIトークン",
        description:
          "このサーバーで一般公開されている画像・アルバムをAPIから取得できます。編集操作には利用できません。",
        plusRequired:
          "APIトークンの発行と利用にはPlusが必要です。既存のトークンはPlusへ再加入するまで利用できません。",
        startPlus: "Plusを始める",
        inactive: "Plus未加入のため無効",
        name: "トークン名",
        placeholder: "Webサイト連携",
        create: "トークンを発行",
        creating: "発行中…",
        created: "トークンを発行しました",
        once: "秘密値が表示されるのは一度だけです。安全な場所へ保存してください。",
        copy: "コピー",
        copied: "コピーしました",
        active: "有効なトークン",
        empty: "有効なトークンはありません。",
        createdAt: "作成",
        lastUsed: "最終利用",
        neverUsed: "未使用",
        revoke: "失効",
        revoking: "失効中…",
        confirm: "このAPIトークンを失効しますか？元に戻せません。",
        error: "操作できませんでした。もう一度試してください。",
        limit: "有効なトークンは10個までです。",
        endpoints: "GET /api/v1/server/images と GET /api/v1/server/albums で利用できます。",
      }
    : {
        title: "Read-only API tokens",
        description:
          "Use these tokens to retrieve publicly listed images and albums for this server. Editing is not supported.",
        plusRequired:
          "Plus is required to create and use API tokens. Existing tokens remain inactive until you subscribe to Plus again.",
        startPlus: "Start Plus",
        inactive: "Inactive without Plus",
        name: "Token name",
        placeholder: "Website integration",
        create: "Create token",
        creating: "Creating…",
        created: "Token created",
        once: "This secret is shown only once. Store it somewhere safe.",
        copy: "Copy",
        copied: "Copied",
        active: "Active tokens",
        empty: "There are no active tokens.",
        createdAt: "Created",
        lastUsed: "Last used",
        neverUsed: "Never used",
        revoke: "Revoke",
        revoking: "Revoking…",
        confirm: "Revoke this API token? This cannot be undone.",
        error: "The operation failed. Please try again.",
        limit: "A server can have up to 10 active tokens.",
        endpoints: "Use GET /api/v1/server/images and GET /api/v1/server/albums.",
      };

  async function createToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    setSecret(null);
    const form = event.currentTarget;
    try {
      const response = await fetch(`/manage/servers/${serverId}/api-tokens`, {
        method: "POST",
        headers: { accept: "application/json" },
        body: new FormData(form),
      });
      const result = (await response.json().catch(() => null)) as {
        token?: string;
        name?: string;
        error?: string;
      } | null;
      if (!response.ok || !result?.token || !result.name) {
        setError(result?.error === "token_limit_reached" ? copy.limit : copy.error);
        return;
      }
      setSecret({ token: result.token, name: result.name });
      form.reset();
      router.refresh();
    } catch {
      setError(copy.error);
    } finally {
      setCreating(false);
    }
  }

  async function copySecret() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret.token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(copy.error);
    }
  }

  async function revokeToken(tokenId: string) {
    if (!window.confirm(copy.confirm)) return;
    setRevokingId(tokenId);
    setError(null);
    try {
      const response = await fetch(`/manage/servers/${serverId}/api-tokens/${tokenId}`, {
        method: "DELETE",
        headers: { accept: "application/json" },
      });
      if (!response.ok) {
        setError(copy.error);
        return;
      }
      router.refresh();
    } catch {
      setError(copy.error);
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <section className="space-y-5 rounded-xl border border-amber-500/40 bg-amber-500/5 p-5">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-2xl font-semibold">
          <KeyRoundIcon className="size-5 text-amber-600" aria-hidden />
          {copy.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
        <p className="font-mono text-xs text-muted-foreground">{copy.endpoints}</p>
      </div>

      {!plus && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">{copy.plusRequired}</p>
          <Button asChild variant="outline" className="shrink-0">
            <a href="/plus">{copy.startPlus}</a>
          </Button>
        </div>
      )}

      {secret && (
        <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/10 p-4">
          <div>
            <p className="font-semibold">{copy.created}</p>
            <p className="text-sm text-muted-foreground">{copy.once}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-md border bg-background p-3 text-sm">
              {secret.token}
            </code>
            <Button type="button" variant="outline" onClick={copySecret}>
              {copied ? (
                <CheckIcon className="size-4" aria-hidden />
              ) : (
                <ClipboardIcon className="size-4" aria-hidden />
              )}
              {copied ? copy.copied : copy.copy}
            </Button>
          </div>
        </div>
      )}

      {plus && tokens.length < 10 && (
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={createToken}>
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor={`server-api-token-name-${serverId}`}>{copy.name}</Label>
            <Input
              id={`server-api-token-name-${serverId}`}
              name="name"
              required
              maxLength={100}
              placeholder={copy.placeholder}
              disabled={creating}
            />
          </div>
          <Button type="submit" disabled={creating}>
            {creating && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />}
            {creating ? copy.creating : copy.create}
          </Button>
        </form>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-3">
        <h3 className="font-semibold">{copy.active}</h3>
        {tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.empty}</p>
        ) : (
          <div className="space-y-2">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="flex flex-col justify-between gap-3 rounded-lg border bg-background/70 p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{token.name}</p>
                    {!plus && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                        {copy.inactive}
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    {token.token_prefix}••••••••
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {copy.createdAt}:{" "}
                      <LocalDateTime value={new Date(token.created_at).toISOString()} />
                    </span>
                    <span>
                      {copy.lastUsed}:{" "}
                      {token.last_used_at ? (
                        <LocalDateTime value={new Date(token.last_used_at).toISOString()} />
                      ) : (
                        copy.neverUsed
                      )}
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={revokingId === token.id}
                  onClick={() => void revokeToken(token.id)}
                >
                  {revokingId === token.id ? (
                    <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2Icon className="size-4" aria-hidden />
                  )}
                  {revokingId === token.id ? copy.revoking : copy.revoke}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
