import type { Locale } from "./i18n/config";

export type PlanName = "free" | "plus";

export interface PlanLimits {
  name: PlanName;
  uploadsPerThirtyDays: number;
  retentionDays: number;
  albums: number;
  imagesPerAlbum: number;
  protectedSharing: boolean;
  libraryOrganization: boolean;
  serverBranding: boolean;
  serverEditors: boolean;
  customDomain: boolean;
  serverDiscordWebhooks: number;
}

export const FREE_PLAN: PlanLimits = {
  name: "free",
  uploadsPerThirtyDays: 50,
  retentionDays: 30,
  albums: 1,
  imagesPerAlbum: 20,
  protectedSharing: false,
  libraryOrganization: false,
  serverBranding: false,
  serverEditors: false,
  customDomain: false,
  serverDiscordWebhooks: 1,
};

export const PLUS_PLAN: PlanLimits = {
  name: "plus",
  uploadsPerThirtyDays: 500,
  retentionDays: 365,
  albums: 100,
  imagesPerAlbum: 200,
  protectedSharing: true,
  libraryOrganization: true,
  serverBranding: true,
  serverEditors: true,
  customDomain: true,
  serverDiscordWebhooks: 5,
};

export interface SubscriptionSummary {
  plan: PlanName;
  status: string | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  scheduledCancellationAt: number | null;
  priceUnitAmount: number | null;
  priceCurrency: string | null;
  priceInterval: string | null;
  priceIntervalCount: number | null;
  graceUntil: number | null;
}

interface SubscriptionRow {
  stripe_price_id: string;
  status: string;
  current_period_end: number;
  cancel_at_period_end: number;
  cancel_at: number | null;
  price_unit_amount: number | null;
  price_currency: string | null;
  price_interval: string | null;
  price_interval_count: number | null;
  grace_until: number | null;
}

export async function subscriptionSummary(
  env: CloudflareEnv,
  userId: string,
): Promise<SubscriptionSummary> {
  const row = await env.DB.prepare(
    `SELECT stripe_price_id, status, current_period_end, cancel_at_period_end, cancel_at,
        price_unit_amount, price_currency, price_interval, price_interval_count, grace_until
      FROM subscriptions WHERE user_id = ?`,
  )
    .bind(userId)
    .first<SubscriptionRow>();
  const now = Date.now();
  const entitled = Boolean(
    row &&
    row.stripe_price_id === env.STRIPE_PLUS_PRICE_ID &&
    (((row.status === "active" || row.status === "trialing") && row.current_period_end > now) ||
      (row.status === "past_due" && (row.grace_until ?? 0) > now)),
  );
  const cancellationAt =
    row?.cancel_at ?? (row?.cancel_at_period_end ? row.current_period_end : null);
  return {
    plan: entitled ? "plus" : "free",
    status: row?.status ?? null,
    currentPeriodEnd: row?.current_period_end ?? null,
    cancelAtPeriodEnd: Boolean(row?.cancel_at_period_end),
    scheduledCancellationAt:
      entitled && cancellationAt && cancellationAt > now ? cancellationAt : null,
    priceUnitAmount: row?.price_unit_amount ?? null,
    priceCurrency: row?.price_currency ?? null,
    priceInterval: row?.price_interval ?? null,
    priceIntervalCount: row?.price_interval_count ?? null,
    graceUntil: row?.grace_until ?? null,
  };
}

export function subscriptionPriceLabel(
  subscription: SubscriptionSummary,
  locale: Locale = "ja",
): string | null {
  if (subscription.plan === "free") return locale === "ja" ? "0円" : "¥0";
  if (subscription.priceUnitAmount === null || !subscription.priceCurrency) return null;
  const currency = subscription.priceCurrency.toUpperCase();
  const formatter = new Intl.NumberFormat(locale === "ja" ? "ja-JP" : "en-US", {
    style: "currency",
    currency,
  });
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 0;
  const price = formatter.format(subscription.priceUnitAmount / 10 ** fractionDigits);
  if (!subscription.priceInterval) return price;
  const interval = intervalLabel(subscription.priceInterval, locale);
  const intervalCount = subscription.priceIntervalCount ?? 1;
  const separator = locale === "ja" ? "／" : "/";
  return intervalCount === 1
    ? `${price}${separator}${interval}`
    : `${price}${separator}${intervalCount}${interval}`;
}

function intervalLabel(interval: string, locale: Locale): string {
  if (locale === "ja") {
    if (interval === "day") return "日";
    if (interval === "week") return "週";
    if (interval === "month") return "月";
    if (interval === "year") return "年";
  } else {
    if (interval === "day") return "day";
    if (interval === "week") return "week";
    if (interval === "month") return "month";
    if (interval === "year") return "year";
  }
  return interval;
}

export async function planLimits(env: CloudflareEnv, userId: string | null): Promise<PlanLimits> {
  if (!userId) return FREE_PLAN;
  return (await subscriptionSummary(env, userId)).plan === "plus" ? PLUS_PLAN : FREE_PLAN;
}

export async function uploadUsage(
  env: CloudflareEnv,
  userId: string,
  now = Date.now(),
): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM images WHERE owner_user_id = ? AND created_at >= ?",
  )
    .bind(userId, now - 30 * 24 * 60 * 60 * 1000)
    .first<{ count: number }>();
  return row?.count ?? 0;
}
