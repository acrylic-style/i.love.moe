interface RetentionMessage {
  imageId: string;
}

interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  RETENTION_QUEUE: Queue<RetentionMessage>;
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
    await env.DB.prepare("UPDATE retention_jobs SET status = 'failed', last_error = 'processing_timeout', updated_at = ? WHERE status = 'processing' AND updated_at < ?")
      .bind(Date.now(), Date.now() - 10 * 60 * 1000).run();
    const jobs = await env.DB.prepare(`SELECT image_id FROM retention_jobs
        WHERE status IN ('pending', 'failed') AND attempts < 5 ORDER BY updated_at LIMIT 100`)
      .all<{ image_id: string }>();
    for (const job of jobs.results) await env.RETENTION_QUEUE.send({ imageId: job.image_id });
  },
};

async function migrateImage(message: Message<RetentionMessage>, env: Env): Promise<void> {
  const job = await env.DB.prepare(`SELECT image_id, source_key, target_key, status, attempts
      FROM retention_jobs WHERE image_id = ?`).bind(message.body.imageId).first<JobRow>();
  if (!job || job.status === "complete") {
    message.ack();
    return;
  }

  const now = Date.now();
  const claimed = await env.DB.prepare(`UPDATE retention_jobs SET status = 'processing', attempts = attempts + 1, updated_at = ?
      WHERE image_id = ? AND status IN ('pending', 'failed')`)
    .bind(now, job.image_id).run();
  if ((claimed.meta.changes ?? 0) !== 1) {
    message.ack();
    return;
  }
  try {
    const image = await env.DB.prepare(`SELECT r2_key, created_at, expires_at, deleted_at, storage_tier
        FROM images WHERE id = ?`).bind(job.image_id).first<ImageRow>();
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
    const updated = await env.DB.prepare(`UPDATE images SET r2_key = ?, storage_tier = 'plus', expires_at = ?
        WHERE id = ? AND r2_key = ? AND storage_tier = 'free' AND deleted_at IS NULL`)
      .bind(job.target_key, expiresAt, job.image_id, job.source_key).run();
    if ((updated.meta.changes ?? 0) === 1) await env.IMAGES.delete(job.source_key);
    await completeJob(env, job.image_id);
    message.ack();
  } catch (error) {
    const attempts = job.attempts + 1;
    const code = error instanceof Error ? error.message.slice(0, 100) : "unknown";
    await env.DB.prepare("UPDATE retention_jobs SET status = 'failed', last_error = ?, updated_at = ? WHERE image_id = ?")
      .bind(code, Date.now(), job.image_id).run();
    if (attempts >= 5) message.ack();
    else message.retry({ delaySeconds: Math.min(300, 2 ** attempts * 10) });
  }
}

async function completeJob(env: Env, imageId: string): Promise<void> {
  await env.DB.prepare("UPDATE retention_jobs SET status = 'complete', last_error = NULL, updated_at = ? WHERE image_id = ?")
    .bind(Date.now(), imageId).run();
}
