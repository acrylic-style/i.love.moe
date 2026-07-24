import { getDomain, getSubdomain } from "tldts";
import { authenticateSession } from "./service";
import { asciiHostname, canUseServerPlus } from "./servers";

const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

interface CloudflareHostname {
  id: string;
  hostname: string;
  status?: string;
  ownership_verification?: { type?: string; name?: string; value?: string };
  ownership_verification_http?: { http_url?: string; http_body?: string };
  ssl?: {
    status?: string;
    validation_records?: Array<{ status?: string; txt_name?: string; txt_value?: string }>;
    validation_errors?: Array<{ message?: string }>;
  };
}

interface CloudflareResult<T> {
  success: boolean;
  result?: T;
  errors?: Array<{ code?: number; message?: string }>;
}

export interface CustomDomainRow {
  id: string;
  server_id: string;
  hostname_ascii: string;
  cloudflare_hostname_id: string | null;
  status: "pending" | "active" | "grace" | "error" | "deprovisioned";
  hostname_status: string | null;
  ssl_status: string | null;
  validation_records_json: string | null;
  last_error: string | null;
  created_at: number;
  updated_at: number;
  grace_ends_at: number | null;
}

export async function customDomainForServer(
  env: CloudflareEnv,
  serverId: string,
): Promise<CustomDomainRow | null> {
  return env.DB.prepare("SELECT * FROM server_custom_domains WHERE server_id = ?")
    .bind(serverId)
    .first<CustomDomainRow>();
}

export async function activeCustomDomainForServer(
  env: CloudflareEnv,
  serverId: string,
): Promise<string | null> {
  const row = await env.DB.prepare(
    "SELECT hostname_ascii FROM server_custom_domains WHERE server_id = ? AND status = 'active'",
  )
    .bind(serverId)
    .first<{ hostname_ascii: string }>();
  return row?.hostname_ascii ?? null;
}

export async function resolveCustomDomain(
  env: CloudflareEnv,
  hostname: string,
): Promise<
  | (CustomDomainRow & {
      server_code: string;
      server_slug: string | null;
      server_display_name: string | null;
      server_display_address: string | null;
      server_icon_key: string | null;
    })
  | null
> {
  return env.DB.prepare(
    `SELECT d.*, s.code AS server_code, s.slug AS server_slug,
        s.display_name AS server_display_name, s.icon_key AS server_icon_key,
        a.display_address AS server_display_address
      FROM server_custom_domains d
      JOIN servers s ON s.id = d.server_id
      LEFT JOIN server_addresses a ON a.server_id = s.id AND a.is_primary = 1
      WHERE d.hostname_ascii = ? AND d.status IN ('active', 'grace')`,
  )
    .bind(hostname.toLowerCase())
    .first<
      CustomDomainRow & {
        server_code: string;
        server_slug: string | null;
        server_display_name: string | null;
        server_display_address: string | null;
        server_icon_key: string | null;
      }
    >();
}

export async function createCustomDomain(
  request: Request,
  env: CloudflareEnv,
  serverId: string,
): Promise<Response> {
  const session = await authenticateSession(request, env);
  if (
    !session ||
    !(await isServerOwner(env, serverId, session.user_id)) ||
    !(await canUseServerPlus(env, serverId))
  )
    return Response.json({ error: "plus_required" }, { status: 403 });
  if (!env.CLOUDFLARE_SAAS_API_TOKEN || !env.CLOUDFLARE_SAAS_ZONE_ID || !env.SAAS_CNAME_TARGET)
    return Response.json({ error: "custom_domains_unavailable" }, { status: 503 });
  const form = await request.formData();
  const rawHostname = form.get("hostname");
  const hostname = typeof rawHostname === "string" ? asciiHostname(rawHostname) : null;
  if (
    !hostname ||
    !getDomain(hostname, { allowPrivateDomains: true }) ||
    !getSubdomain(hostname, { allowPrivateDomains: true })
  )
    return Response.json({ error: "invalid_subdomain" }, { status: 400 });
  const officialHosts = [
    new URL(env.PUBLIC_BASE_URL).hostname,
    new URL(env.MINECRAFT_PUBLIC_BASE_URL).hostname,
    env.SAAS_CNAME_TARGET,
    env.SAAS_FALLBACK_ORIGIN,
  ].filter(Boolean);
  if (officialHosts.includes(hostname))
    return Response.json({ error: "reserved_hostname" }, { status: 400 });
  const existing = await customDomainForServer(env, serverId);
  if (existing && existing.status !== "deprovisioned")
    return Response.json({ error: "domain_already_configured" }, { status: 409 });

  const response = await cloudflareRequest<CloudflareHostname>(env, "", {
    method: "POST",
    body: JSON.stringify({
      hostname,
      ssl: { method: "txt", type: "dv" },
    }),
  });
  if (!response.success || !response.result)
    return Response.json(
      { error: "cloudflare_rejected", details: safeCloudflareError(response) },
      { status: 502 },
    );
  const now = Date.now();
  const id = existing?.id ?? crypto.randomUUID();
  const values = domainState(response.result);
  try {
    await env.DB.prepare(
      `INSERT INTO server_custom_domains
      (id, server_id, hostname_ascii, cloudflare_hostname_id, status, hostname_status, ssl_status,
        validation_records_json, last_error, created_by_user_id, created_at, updated_at, grace_ends_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      ON CONFLICT(server_id) DO UPDATE SET hostname_ascii = excluded.hostname_ascii,
        cloudflare_hostname_id = excluded.cloudflare_hostname_id, status = excluded.status,
        hostname_status = excluded.hostname_status, ssl_status = excluded.ssl_status,
        validation_records_json = excluded.validation_records_json, last_error = excluded.last_error,
        created_by_user_id = excluded.created_by_user_id, updated_at = excluded.updated_at,
        grace_ends_at = NULL`,
    )
      .bind(
        id,
        serverId,
        hostname,
        response.result.id,
        values.status,
        values.hostnameStatus,
        values.sslStatus,
        JSON.stringify(values.validationRecords),
        values.error,
        session.user_id,
        existing?.created_at ?? now,
        now,
      )
      .run();
  } catch (error) {
    await cloudflareRequest(env, `/${response.result.id}`, { method: "DELETE" });
    throw error;
  }
  return Response.json({
    hostname,
    cnameTarget: env.SAAS_CNAME_TARGET,
    ...values,
  });
}

export async function refreshCustomDomain(
  request: Request,
  env: CloudflareEnv,
  serverId: string,
): Promise<Response> {
  const session = await authenticateSession(request, env);
  if (!session || !(await isServerOwner(env, serverId, session.user_id)))
    return new Response(null, { status: 404 });
  const row = await customDomainForServer(env, serverId);
  if (!row?.cloudflare_hostname_id)
    return Response.json({ error: "domain_not_configured" }, { status: 404 });
  const updated = await syncCustomDomain(env, row);
  return Response.json({
    ...updated,
    cnameTarget: env.SAAS_CNAME_TARGET,
    validationRecords: parseValidationRecords(updated.validation_records_json),
  });
}

export async function deleteCustomDomain(
  request: Request,
  env: CloudflareEnv,
  serverId: string,
): Promise<Response> {
  const session = await authenticateSession(request, env);
  if (!session || !(await isServerOwner(env, serverId, session.user_id)))
    return new Response(null, { status: 404 });
  const row = await customDomainForServer(env, serverId);
  if (!row) return new Response(null, { status: 204 });
  if (row.cloudflare_hostname_id) {
    const result = await cloudflareRequest<unknown>(env, `/${row.cloudflare_hostname_id}`, {
      method: "DELETE",
    });
    if (!result.success)
      return Response.json({ error: "cloudflare_delete_failed" }, { status: 502 });
  }
  await env.DB.prepare(
    `UPDATE server_custom_domains SET status = 'deprovisioned', cloudflare_hostname_id = NULL,
      hostname_status = NULL, ssl_status = NULL, validation_records_json = NULL,
      grace_ends_at = NULL, updated_at = ? WHERE id = ?`,
  )
    .bind(Date.now(), row.id)
    .run();
  return new Response(null, { status: 204 });
}

export async function syncCustomDomains(env: CloudflareEnv): Promise<void> {
  const rows = await env.DB.prepare(
    `SELECT * FROM server_custom_domains
      WHERE (status IN ('pending', 'error') AND updated_at < ?)
        OR (status = 'grace' AND grace_ends_at <= ?)
      ORDER BY updated_at LIMIT 50`,
  )
    .bind(Date.now() - 10 * 60 * 1000, Date.now())
    .all<CustomDomainRow>();
  for (const row of rows.results) {
    try {
      if (row.status === "grace" && (row.grace_ends_at ?? 0) <= Date.now()) {
        if (row.cloudflare_hostname_id)
          await cloudflareRequest(env, `/${row.cloudflare_hostname_id}`, { method: "DELETE" });
        await env.DB.prepare(
          `UPDATE server_custom_domains SET status = 'deprovisioned',
            cloudflare_hostname_id = NULL, updated_at = ? WHERE id = ?`,
        )
          .bind(Date.now(), row.id)
          .run();
      } else {
        await syncCustomDomain(env, row);
      }
    } catch (error) {
      console.error("custom_domain_sync_failed", row.id, error);
    }
  }
}

export async function reconcileCustomDomainEntitlement(
  env: CloudflareEnv,
  serverId: string,
): Promise<void> {
  const row = await customDomainForServer(env, serverId);
  if (!row) return;
  const entitled = await canUseServerPlus(env, serverId);
  if (entitled && row.status === "grace") {
    await env.DB.prepare(
      `UPDATE server_custom_domains SET status = CASE
        WHEN hostname_status = 'active' AND ssl_status = 'active' THEN 'active' ELSE 'pending' END,
        grace_ends_at = NULL, updated_at = ? WHERE id = ?`,
    )
      .bind(Date.now(), row.id)
      .run();
  } else if (!entitled && (row.status === "active" || row.status === "pending")) {
    await env.DB.prepare(
      "UPDATE server_custom_domains SET status = 'grace', grace_ends_at = ?, updated_at = ? WHERE id = ?",
    )
      .bind(Date.now() + GRACE_PERIOD_MS, Date.now(), row.id)
      .run();
  }
}

async function syncCustomDomain(
  env: CloudflareEnv,
  row: CustomDomainRow,
): Promise<CustomDomainRow> {
  if (!row.cloudflare_hostname_id) return row;
  const response = await cloudflareRequest<CloudflareHostname>(
    env,
    `/${row.cloudflare_hostname_id}`,
  );
  if (!response.success || !response.result) {
    await env.DB.prepare(
      "UPDATE server_custom_domains SET status = 'error', last_error = ?, updated_at = ? WHERE id = ?",
    )
      .bind(safeCloudflareError(response), Date.now(), row.id)
      .run();
  } else {
    const state = domainState(response.result);
    await env.DB.prepare(
      `UPDATE server_custom_domains SET status = ?, hostname_status = ?, ssl_status = ?,
        validation_records_json = ?, last_error = ?, updated_at = ? WHERE id = ?`,
    )
      .bind(
        state.status,
        state.hostnameStatus,
        state.sslStatus,
        JSON.stringify(state.validationRecords),
        state.error,
        Date.now(),
        row.id,
      )
      .run();
  }
  return (await customDomainForServer(env, row.server_id)) ?? row;
}

function domainState(hostname: CloudflareHostname) {
  const hostnameStatus = hostname.status ?? "pending";
  const sslStatus = hostname.ssl?.status ?? "pending";
  const validationRecords = [
    hostname.ownership_verification && {
      type: hostname.ownership_verification.type ?? "TXT",
      name: hostname.ownership_verification.name,
      value: hostname.ownership_verification.value,
    },
    ...(hostname.ssl?.validation_records ?? []).map((record) => ({
      type: "TXT",
      name: record.txt_name,
      value: record.txt_value,
      status: record.status,
    })),
  ].filter(Boolean);
  return {
    status:
      hostnameStatus === "active" && sslStatus === "active"
        ? ("active" as const)
        : ("pending" as const),
    hostnameStatus,
    sslStatus,
    validationRecords,
    error:
      hostname.ssl?.validation_errors
        ?.map((error) => error.message)
        .filter(Boolean)
        .join("; ") || null,
  };
}

function parseValidationRecords(value: string | null): unknown[] {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function cloudflareRequest<T>(
  env: CloudflareEnv,
  path: string,
  init: RequestInit = {},
): Promise<CloudflareResult<T>> {
  if (!env.CLOUDFLARE_SAAS_API_TOKEN || !env.CLOUDFLARE_SAAS_ZONE_ID)
    return { success: false, errors: [{ message: "Cloudflare for SaaS is not configured" }] };
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_SAAS_ZONE_ID}/custom_hostnames${path}`,
    {
      ...init,
      headers: {
        authorization: `Bearer ${env.CLOUDFLARE_SAAS_API_TOKEN}`,
        "content-type": "application/json",
        ...init.headers,
      },
    },
  );
  return (await response.json()) as CloudflareResult<T>;
}

function safeCloudflareError(result: CloudflareResult<unknown>): string {
  return (
    result.errors
      ?.map((error) => error.message ?? `Cloudflare error ${error.code ?? ""}`)
      .join("; ")
      .slice(0, 500) || "Cloudflare request failed"
  );
}

async function isServerOwner(
  env: CloudflareEnv,
  serverId: string,
  userId: string,
): Promise<boolean> {
  return Boolean(
    await env.DB.prepare("SELECT 1 AS owned FROM servers WHERE id = ? AND owner_user_id = ?")
      .bind(serverId, userId)
      .first(),
  );
}
