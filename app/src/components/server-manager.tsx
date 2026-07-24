"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { type AsyncStatus, StatusButton } from "./async-form";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

interface Address {
  id: string;
  display_address: string;
  verified_at: number | null;
  is_primary: number;
  pending_server_id: string | null;
}

interface Domain {
  hostname_ascii: string;
  status: string;
  hostname_status: string | null;
  ssl_status: string | null;
  validation_records_json: string | null;
  grace_ends_at: number | null;
}

interface Copy {
  profile: string;
  name: string;
  description: string;
  slug: string;
  save: string;
  addresses: string;
  addressHelp: string;
  addAddress: string;
  add: string;
  verified: string;
  pending: string;
  dns: string;
  motd: string;
  startVerification: string;
  checkVerification: string;
  tokenOnly: string;
  remove: string;
  customDomain: string;
  domainHelp: string;
  hostname: string;
  connect: string;
  refresh: string;
  disconnect: string;
  cnameTarget: string;
  plusRequired: string;
  saving: string;
  working: string;
  saved: string;
  completed: string;
  failed: string;
}

export function ServerManager({
  serverId,
  profile,
  addresses,
  domain,
  plus,
  owner,
  canVerifyAddresses,
  transferVerification,
  cnameTarget,
  copy,
}: {
  serverId: string;
  profile: { displayName: string; description: string; slug: string };
  addresses: Address[];
  domain: Domain | null;
  plus: boolean;
  owner: boolean;
  canVerifyAddresses: boolean;
  transferVerification: boolean;
  cnameTarget: string;
  copy: Copy;
}) {
  const router = useRouter();
  const [operation, setOperation] = useState<{ key: string; status: AsyncStatus }>({
    key: "",
    status: "idle",
  });
  const [challenge, setChallenge] = useState<{
    id: string;
    addressId: string;
    token: string;
    dnsName: string;
    dnsValue: string;
    motdValue: string;
  } | null>(null);

  async function formRequest(url: string, form: FormData, method = "POST") {
    const response = await fetch(url, { method, body: form });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) throw new Error(body?.error ?? "request_failed");
    return body;
  }

  function statusFor(key: string): AsyncStatus {
    return operation.key === key ? operation.status : "idle";
  }

  async function run(key: string, action: () => Promise<void>, refresh = true) {
    if (operation.status === "pending") return;
    setOperation({ key, status: "pending" });
    try {
      await action();
      setOperation({ key, status: "saved" });
      if (refresh) window.setTimeout(() => router.refresh(), 600);
      window.setTimeout(() => setOperation({ key: "", status: "idle" }), 2400);
    } catch {
      setOperation({ key, status: "failed" });
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await run("profile", async () => {
      await formRequest(`/manage/servers/${serverId}/profile`, new FormData(form));
    });
  }

  async function addAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await run("add-address", async () => {
      await formRequest(`/manage/servers/${serverId}/addresses`, new FormData(form));
      form.reset();
    });
  }

  async function startVerification(addressId: string, method: "dns" | "motd") {
    const form = new FormData();
    form.set("method", method);
    await run(
      `verify-${addressId}-${method}`,
      async () => {
        const body = (await formRequest(
          `/manage/servers/${serverId}/verification?addressId=${encodeURIComponent(addressId)}`,
          form,
        )) as NonNullable<typeof challenge>;
        setChallenge({ ...body, addressId });
      },
      false,
    );
  }

  async function checkVerification() {
    if (!challenge) return;
    await run("check-verification", async () => {
      await formRequest(`/manage/servers/${serverId}/verification/${challenge.id}`, new FormData());
      setChallenge(null);
    });
  }

  async function removeAddress(addressId: string) {
    await run(`remove-${addressId}`, async () => {
      const response = await fetch(`/manage/servers/${serverId}/addresses/${addressId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("request_failed");
    });
  }

  async function domainAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await run("connect-domain", async () => {
      await formRequest(`/manage/servers/${serverId}/custom-domain`, new FormData(form));
    });
  }

  async function refreshDomain() {
    await run("refresh-domain", async () => {
      await formRequest(`/manage/servers/${serverId}/custom-domain?action=refresh`, new FormData());
    });
  }

  async function deleteDomain() {
    await run("delete-domain", async () => {
      const response = await fetch(`/manage/servers/${serverId}/custom-domain`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("request_failed");
    });
  }

  const validationRecords = parseRecords(domain?.validation_records_json);
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">{copy.profile}</h2>
        <form className="space-y-4" onSubmit={saveProfile}>
          <div className="space-y-2">
            <Label htmlFor="server-name">{copy.name}</Label>
            <Input
              id="server-name"
              name="displayName"
              maxLength={100}
              defaultValue={profile.displayName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="server-description">{copy.description}</Label>
            <Textarea
              id="server-description"
              name="description"
              maxLength={2000}
              defaultValue={profile.description}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="server-slug">{copy.slug}</Label>
            <Input id="server-slug" name="slug" maxLength={32} defaultValue={profile.slug} />
          </div>
          <StatusButton
            type="submit"
            status={statusFor("profile")}
            idle={copy.save}
            pending={copy.saving}
            saved={copy.saved}
            failed={copy.failed}
          />
        </form>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold">{copy.addresses}</h2>
          <p className="text-sm text-muted-foreground">{copy.addressHelp}</p>
        </div>
        <div className="space-y-3">
          {addresses.map((address) => (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
              key={address.id}
            >
              <div>
                <p className="font-medium">{address.display_address}</p>
                <p className="text-sm text-muted-foreground">
                  {address.verified_at ? copy.verified : copy.pending}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canVerifyAddresses && (!address.verified_at || transferVerification) && (
                  <>
                    <StatusButton
                      variant="outline"
                      size="sm"
                      onClick={() => startVerification(address.id, "dns")}
                      status={statusFor(`verify-${address.id}-dns`)}
                      idle={copy.dns}
                      pending={copy.working}
                      saved={copy.completed}
                      failed={copy.failed}
                    ></StatusButton>
                    <StatusButton
                      variant="outline"
                      size="sm"
                      onClick={() => startVerification(address.id, "motd")}
                      status={statusFor(`verify-${address.id}-motd`)}
                      idle={copy.motd}
                      pending={copy.working}
                      saved={copy.completed}
                      failed={copy.failed}
                    />
                  </>
                )}
                {owner && !address.is_primary && (
                  <StatusButton
                    variant="destructive"
                    size="sm"
                    onClick={() => removeAddress(address.id)}
                    status={statusFor(`remove-${address.id}`)}
                    idle={copy.remove}
                    pending={copy.working}
                    saved={copy.completed}
                    failed={copy.failed}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
        {owner && (
          <form className="flex gap-2" onSubmit={addAddress}>
            <Input
              name="address"
              required
              maxLength={255}
              placeholder="play.example.com:25565"
              aria-label={copy.addAddress}
            />
            <StatusButton
              type="submit"
              status={statusFor("add-address")}
              idle={copy.add}
              pending={copy.working}
              saved={copy.completed}
              failed={copy.failed}
            />
          </form>
        )}
        {canVerifyAddresses && challenge && (
          <div className="space-y-3 rounded-lg border border-primary/50 bg-primary/5 p-4">
            <p className="font-medium">{copy.startVerification}</p>
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Token</dt>
                <dd className="break-all font-mono">{challenge.token}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">DNS TXT</dt>
                <dd className="break-all font-mono">
                  {challenge.dnsName} = {challenge.dnsValue}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">MOTD</dt>
                <dd className="break-all font-mono">{challenge.motdValue}</dd>
              </div>
            </dl>
            <p className="text-sm text-muted-foreground">{copy.tokenOnly}</p>
            <StatusButton
              onClick={checkVerification}
              status={statusFor("check-verification")}
              idle={copy.checkVerification}
              pending={copy.working}
              saved={copy.completed}
              failed={copy.failed}
            />
          </div>
        )}
      </section>

      {owner && (
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold">{copy.customDomain}</h2>
            <p className="text-sm text-muted-foreground">{copy.domainHelp}</p>
          </div>
          {!plus ? (
            <p>{copy.plusRequired}</p>
          ) : domain && domain.status !== "deprovisioned" ? (
            <div className="space-y-3 rounded-lg border p-4">
              <p className="font-medium">{domain.hostname_ascii}</p>
              <p className="text-sm text-muted-foreground">
                Status: {domain.status} / TLS: {domain.ssl_status ?? "pending"}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">{copy.cnameTarget}: </span>
                <code>{cnameTarget}</code>
              </p>
              {validationRecords.map((record, index) => (
                <p className="break-all font-mono text-xs" key={index}>
                  {record.name} = {record.value}
                </p>
              ))}
              <div className="flex gap-2">
                <StatusButton
                  variant="outline"
                  onClick={refreshDomain}
                  status={statusFor("refresh-domain")}
                  idle={copy.refresh}
                  pending={copy.working}
                  saved={copy.completed}
                  failed={copy.failed}
                />
                <StatusButton
                  variant="destructive"
                  onClick={deleteDomain}
                  status={statusFor("delete-domain")}
                  idle={copy.disconnect}
                  pending={copy.working}
                  saved={copy.completed}
                  failed={copy.failed}
                />
              </div>
            </div>
          ) : (
            <form className="flex gap-2" onSubmit={domainAction}>
              <Input
                name="hostname"
                required
                placeholder="album.example.com"
                aria-label={copy.hostname}
              />
              <StatusButton
                type="submit"
                status={statusFor("connect-domain")}
                idle={copy.connect}
                pending={copy.working}
                saved={copy.completed}
                failed={copy.failed}
              />
            </form>
          )}
        </section>
      )}
    </div>
  );
}

function parseRecords(value: string | null | undefined): Array<{ name?: string; value?: string }> {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
