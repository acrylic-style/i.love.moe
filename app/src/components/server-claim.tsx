"use client";

import { useState } from "react";
import { type AsyncStatus, StatusButton } from "./async-form";

export function ServerClaim({
  serverId,
  addressId,
  japanese,
}: {
  serverId: string;
  addressId: string;
  japanese: boolean;
}) {
  const [challenge, setChallenge] = useState<{
    id: string;
    token: string;
    dnsName: string;
    dnsValue: string;
    motdValue: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [operation, setOperation] = useState<{ key: string; status: AsyncStatus }>({
    key: "",
    status: "idle",
  });

  const statusFor = (key: string): AsyncStatus =>
    operation.key === key ? operation.status : "idle";

  async function start(method: "dns" | "motd") {
    const key = `start-${method}`;
    setOperation({ key, status: "pending" });
    const form = new FormData();
    form.set("method", method);
    const response = await fetch(
      `/manage/servers/${serverId}/verification?addressId=${encodeURIComponent(addressId)}`,
      { method: "POST", body: form },
    );
    const body = (await response.json().catch(() => null)) as typeof challenge & { error?: string };
    if (!response.ok || !body) {
      setOperation({ key, status: "failed" });
      return setError(body?.error ?? "request_failed");
    }
    setChallenge(body);
    setError("");
    setOperation({ key, status: "saved" });
    window.setTimeout(() => setOperation({ key: "", status: "idle" }), 2400);
  }

  async function check() {
    if (!challenge) return;
    setOperation({ key: "check", status: "pending" });
    const response = await fetch(`/manage/servers/${serverId}/verification/${challenge.id}`, {
      method: "POST",
    });
    if (!response.ok) {
      setOperation({ key: "check", status: "failed" });
      return setError(japanese ? "まだ確認できませんでした。" : "Verification was not found yet.");
    }
    setError("");
    setOperation({ key: "check", status: "saved" });
    window.setTimeout(() => {
      window.location.href = `/manage/servers/${serverId}`;
    }, 600);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <StatusButton
          onClick={() => start("dns")}
          status={statusFor("start-dns")}
          idle={japanese ? "DNSで確認" : "Verify with DNS"}
          pending={japanese ? "処理中…" : "Working…"}
          saved={japanese ? "準備しました" : "Ready"}
          failed={japanese ? "失敗しました" : "Failed"}
        />
        <StatusButton
          variant="outline"
          onClick={() => start("motd")}
          status={statusFor("start-motd")}
          idle={japanese ? "MOTDで確認" : "Verify with MOTD"}
          pending={japanese ? "処理中…" : "Working…"}
          saved={japanese ? "準備しました" : "Ready"}
          failed={japanese ? "失敗しました" : "Failed"}
        />
      </div>
      {challenge && (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="break-all font-mono text-sm">Token: {challenge.token}</p>
          <p className="break-all font-mono text-sm">
            {challenge.dnsName} = {challenge.dnsValue}
          </p>
          <p className="break-all font-mono text-sm">MOTD: {challenge.motdValue}</p>
          <p className="text-sm text-muted-foreground">
            {japanese
              ? "MOTD方式では、一時的にMOTD全体をトークンだけにしてください。"
              : "For MOTD verification, temporarily set the entire MOTD to the token only."}
          </p>
          <StatusButton
            onClick={check}
            status={statusFor("check")}
            idle={japanese ? "設定を確認" : "Check configuration"}
            pending={japanese ? "確認中…" : "Checking…"}
            saved={japanese ? "確認しました" : "Verified"}
            failed={japanese ? "確認できませんでした" : "Not verified"}
          />
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
