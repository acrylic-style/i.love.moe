interface RetentionMessage {
  imageId: string;
}

interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  RETENTION_QUEUE: Queue<RetentionMessage>;
  CLOUDFLARE_SAAS_API_TOKEN: string;
  CLOUDFLARE_SAAS_ZONE_ID: string;
  STRIPE_PLUS_PRICE_ID: string;
}

interface JobRow {
  image_id: string;
  source_key: string;
  target_key: string;
  status: "pending" | "processing" | "complete" | "failed";
  attempts: number;
}

interface ImageRow {
  r2_key: string;
  created_at: number;
  expires_at: number;
  deleted_at: number | null;
  storage_tier: "free" | "plus";
}

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export default {
  async queue(batch: MessageBatch<RetentionMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) await migrateImage(message, env);
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await env.DB.prepare(
      "UPDATE retention_jobs SET status = 'failed', last_error = 'processing_timeout', updated_at = ? WHERE status = 'processing' AND updated_at < ?",
    )
      .bind(Date.now(), Date.now() - 10 * 60 * 1000)
      .run();
    const jobs = await env.DB.prepare(
      `SELECT image_id FROM retention_jobs
        WHERE status IN ('pending', 'failed') AND attempts < 5 ORDER BY updated_at LIMIT 100`,
    ).all<{ image_id: string }>();
    for (const job of jobs.results) await env.RETENTION_QUEUE.send({ imageId: job.image_id });
    await env.DB.prepare(
      `DELETE FROM server_image_favorites WHERE image_id IN (
        SELECT id FROM images WHERE deleted_at IS NOT NULL OR expires_at <= ? LIMIT 500
      )`,
    )
      .bind(Date.now())
      .run();
    await env.DB.prepare(
      `DELETE FROM server_favorite_attempts WHERE id IN (
        SELECT id FROM server_favorite_attempts WHERE created_at <= ? LIMIT 500
      )`,
    )
      .bind(Date.now() - 60 * 60 * 1000)
      .run();
    await reconcileCustomDomains(env);
  },
};

async function migrateImage(message: Message<RetentionMessage>, env: Env): Promise<void> {
  const job = await env.DB.prepare(
    `SELECT image_id, source_key, target_key, status, attempts
      FROM retention_jobs WHERE image_id = ?`,
  )
    .bind(message.body.imageId)
    .first<JobRow>();
  if (!job || job.status === "complete") {
    message.ack();
    return;
  }

  const now = Date.now();
  const claimed = await env.DB.prepare(
    `UPDATE retention_jobs SET status = 'processing', attempts = attempts + 1, updated_at = ?
      WHERE image_id = ? AND status IN ('pending', 'failed')`,
  )
    .bind(now, job.image_id)
    .run();
  if ((claimed.meta.changes ?? 0) !== 1) {
    message.ack();
    return;
  }
  try {
    const image = await env.DB.prepare(
      `SELECT r2_key, created_at, expires_at, deleted_at, storage_tier
        FROM images WHERE id = ?`,
    )
      .bind(job.image_id)
      .first<ImageRow>();
    // The job is created only for images that are active when Plus becomes effective.
    // Preserve that decision even if the free expiry passes while the queue is delayed.
    if (!image || image.deleted_at !== null) {
      await completeJob(env, job.image_id);
      message.ack();
      return;
    }
    if (image.storage_tier === "plus") {
      await completeJob(env, job.image_id);
      message.ack();
      return;
    }
    if (image.r2_key !== job.source_key) throw new Error("source_changed");
    const source = await env.IMAGES.get(job.source_key);
    if (!source) throw new Error("source_missing");
    await env.IMAGES.put(job.target_key, source.body, {
      httpMetadata: source.httpMetadata,
      customMetadata: source.customMetadata,
    });
    const expiresAt = Math.max(image.expires_at, image.created_at + ONE_YEAR_MS);
    const updated = await env.DB.prepare(
      `UPDATE images SET r2_key = ?, storage_tier = 'plus', expires_at = ?
        WHERE id = ? AND r2_key = ? AND storage_tier = 'free' AND deleted_at IS NULL`,
    )
      .bind(job.target_key, expiresAt, job.image_id, job.source_key)
      .run();
    if ((updated.meta.changes ?? 0) === 1) await env.IMAGES.delete(job.source_key);
    await completeJob(env, job.image_id);
    message.ack();
  } catch (error) {
    const attempts = job.attempts + 1;
    const code = error instanceof Error ? error.message.slice(0, 100) : "unknown";
    await env.DB.prepare(
      "UPDATE retention_jobs SET status = 'failed', last_error = ?, updated_at = ? WHERE image_id = ?",
    )
      .bind(code, Date.now(), job.image_id)
      .run();
    if (attempts >= 5) message.ack();
    else message.retry({ delaySeconds: Math.min(300, 2 ** attempts * 10) });
  }
}

interface DomainRow {
  id: string;
  cloudflare_hostname_id: string | null;
  status: "pending" | "active" | "grace" | "error" | "deprovisioned";
  hostname_status: string | null;
  ssl_status: string | null;
  updated_at: number;
  grace_ends_at: number | null;
  stripe_price_id: string | null;
  subscription_status: string | null;
  current_period_end: number | null;
  grace_until: number | null;
}

async function reconcileCustomDomains(env: Env): Promise<void> {
  const rows = await env.DB.prepare(
    `SELECT d.id, d.cloudflare_hostname_id, d.status, d.hostname_status, d.ssl_status,
      d.updated_at, d.grace_ends_at, sub.stripe_price_id,
      sub.status AS subscription_status, sub.current_period_end, sub.grace_until
    FROM server_custom_domains d
    JOIN servers s ON s.id = d.server_id
    LEFT JOIN subscriptions sub ON sub.user_id = s.owner_user_id
    WHERE d.status != 'deprovisioned'
    ORDER BY d.updated_at LIMIT 100`,
  ).all<DomainRow>();
  const now = Date.now();
  for (const row of rows.results) {
    const entitled =
      row.stripe_price_id === env.STRIPE_PLUS_PRICE_ID &&
      (((row.subscription_status === "active" || row.subscription_status === "trialing") &&
        (row.current_period_end ?? 0) > now) ||
        (row.subscription_status === "past_due" && (row.grace_until ?? 0) > now));
    if (!entitled && row.status !== "grace") {
      await env.DB.prepare(
        "UPDATE server_custom_domains SET status = 'grace', grace_ends_at = ?, updated_at = ? WHERE id = ?",
      )
        .bind(now + 30 * 24 * 60 * 60 * 1000, now, row.id)
        .run();
      continue;
    }
    if (entitled && row.status === "grace") {
      await env.DB.prepare(
        `UPDATE server_custom_domains SET status = CASE
          WHEN hostname_status = 'active' AND ssl_status = 'active' THEN 'active'
          ELSE 'pending' END, grace_ends_at = NULL, updated_at = ? WHERE id = ?`,
      )
        .bind(now, row.id)
        .run();
      continue;
    }
    if (row.status === "grace" && (row.grace_ends_at ?? 0) <= now && row.cloudflare_hostname_id) {
      const deleted = await cloudflareHostnameRequest(env, row.cloudflare_hostname_id, "DELETE");
      if (deleted)
        await env.DB.prepare(
          `UPDATE server_custom_domains SET status = 'deprovisioned',
            cloudflare_hostname_id = NULL, updated_at = ? WHERE id = ?`,
        )
          .bind(now, row.id)
          .run();
      continue;
    }
    if (
      entitled &&
      (row.status === "pending" || row.status === "error") &&
      row.updated_at < now - 10 * 60 * 1000 &&
      row.cloudflare_hostname_id
    ) {
      const hostname = await cloudflareHostname(env, row.cloudflare_hostname_id);
      if (!hostname) continue;
      const hostnameStatus = hostname.status ?? "pending";
      const sslStatus = hostname.ssl?.status ?? "pending";
      await env.DB.prepare(
        `UPDATE server_custom_domains SET status = ?, hostname_status = ?, ssl_status = ?,
          validation_records_json = ?, last_error = ?, updated_at = ? WHERE id = ?`,
      )
        .bind(
          hostnameStatus === "active" && sslStatus === "active" ? "active" : "pending",
          hostnameStatus,
          sslStatus,
          JSON.stringify(
            [hostname.ownership_verification, ...(hostname.ssl?.validation_records ?? [])].filter(
              Boolean,
            ),
          ),
          hostname.ssl?.validation_errors?.map((error) => error.message).join("; ") || null,
          now,
          row.id,
        )
        .run();
    }
  }
}

interface CloudflareHostname {
  status?: string;
  ownership_verification?: unknown;
  ssl?: {
    status?: string;
    validation_records?: unknown[];
    validation_errors?: Array<{ message?: string }>;
  };
}

async function cloudflareHostname(env: Env, id: string): Promise<CloudflareHostname | null> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_SAAS_ZONE_ID}/custom_hostnames/${id}`,
    { headers: { authorization: `Bearer ${env.CLOUDFLARE_SAAS_API_TOKEN}` } },
  );
  if (!response.ok) return null;
  const body = (await response.json()) as { success?: boolean; result?: CloudflareHostname };
  return body.success ? (body.result ?? null) : null;
}

async function cloudflareHostnameRequest(env: Env, id: string, method: "DELETE"): Promise<boolean> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_SAAS_ZONE_ID}/custom_hostnames/${id}`,
    {
      method,
      headers: { authorization: `Bearer ${env.CLOUDFLARE_SAAS_API_TOKEN}` },
    },
  );
  return response.ok;
}

async function completeJob(env: Env, imageId: string): Promise<void> {
  await env.DB.prepare(
    "UPDATE retention_jobs SET status = 'complete', last_error = NULL, updated_at = ? WHERE image_id = ?",
  )
    .bind(Date.now(), imageId)
    .run();
}
