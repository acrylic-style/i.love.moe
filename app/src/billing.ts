import Stripe from "stripe";
import { authenticateSession } from "./service";
import { subscriptionSummary } from "./plans";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
// Bump this whenever the Checkout Session parameters change. Stripe requires
// every request sharing an idempotency key to have exactly the same parameters.
const PLUS_CHECKOUT_IDEMPOTENCY_VERSION = "v3";

function stripeClient(env: CloudflareEnv): Stripe {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
  });
}

export async function createCheckout(request: Request, env: CloudflareEnv): Promise<Response> {
  const session = await authenticateSession(request, env);
  if (!session) return new Response(null, { status: 404 });
  const existingSubscription = await subscriptionSummary(env, session.user_id);
  if (existingSubscription.plan === "plus") return new Response(null, { status: 303, headers: { location: "/manage" } });
  if (existingSubscription.status && existingSubscription.status !== "canceled" && existingSubscription.status !== "incomplete_expired") {
    return createPortal(request, env);
  }
  const stripe = stripeClient(env);
  const customerId = await ensureCustomer(stripe, env, session.user_id);
  const baseUrl = env.PUBLIC_BASE_URL.replace(/\/$/, "");
  const checkout = await stripe.checkout.sessions.create(plusCheckoutSessionParams({
    customerId,
    userId: session.user_id,
    priceId: env.STRIPE_PLUS_PRICE_ID,
    baseUrl,
  }), { idempotencyKey: plusCheckoutIdempotencyKey(session.user_id) });
  if (!checkout.url) throw new Error("stripe_checkout_url_missing");
  return new Response(null, { status: 303, headers: { location: checkout.url, "cache-control": "no-store" } });
}

export function plusCheckoutIdempotencyKey(userId: string, now = Date.now()): string {
  return `plus-checkout-${PLUS_CHECKOUT_IDEMPOTENCY_VERSION}-${userId}-${Math.floor(now / 3_600_000)}`;
}

export function plusCheckoutSessionParams({ customerId, userId, priceId, baseUrl }: {
  customerId: string;
  userId: string;
  priceId: string;
  baseUrl: string;
}): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "subscription",
    customer: customerId,
    client_reference_id: userId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/manage?checkout=success`,
    cancel_url: `${baseUrl}/plus?checkout=canceled`,
    allow_promotion_codes: true,
    payment_method_collection: "if_required",
    subscription_data: { metadata: { user_id: userId } },
    payment_method_options: {
      card: { request_three_d_secure: "any" },
    },
  };
}

export async function createPortal(request: Request, env: CloudflareEnv): Promise<Response> {
  const session = await authenticateSession(request, env);
  if (!session) return new Response(null, { status: 404 });
  const user = await env.DB.prepare("SELECT stripe_customer_id FROM users WHERE id = ?")
    .bind(session.user_id).first<{ stripe_customer_id: string | null }>();
  if (!user?.stripe_customer_id) return new Response(null, { status: 303, headers: { location: "/plus" } });
  const portal = await stripeClient(env).billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/manage`,
  });
  return new Response(null, { status: 303, headers: { location: portal.url, "cache-control": "no-store" } });
}

export async function handleStripeWebhook(request: Request, env: CloudflareEnv): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "missing_signature" }, { status: 400 });
  const body = await request.text();
  let event: Stripe.Event;
  try {
    const stripe = stripeClient(env);
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch {
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  }

  const existing = await env.DB.prepare("SELECT event_id FROM stripe_events WHERE event_id = ?")
    .bind(event.id).first<{ event_id: string }>();
  if (existing) {
    await enqueuePendingRetentionJobs(env);
    return Response.json({ received: true }, { headers: { "cache-control": "no-store" } });
  }

  const stripe = stripeClient(env);
  if (event.type === "checkout.session.completed") {
    const checkout = event.data.object;
    if (typeof checkout.customer === "string" && checkout.client_reference_id) {
      await env.DB.prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ?")
        .bind(checkout.customer, checkout.client_reference_id).run();
    }
    if (typeof checkout.subscription === "string") {
      await syncSubscription(await stripe.subscriptions.retrieve(checkout.subscription), event.created, env);
    }
  } else if (event.type.startsWith("customer.subscription.")) {
    await syncSubscription(event.data.object as Stripe.Subscription, event.created, env);
  } else if (event.type === "invoice.payment_failed" || event.type === "invoice.paid") {
    const subscriptionId = invoiceSubscriptionId(event.data.object as Stripe.Invoice);
    if (subscriptionId) {
      const graceUntil = event.type === "invoice.payment_failed" ? Date.now() + SEVEN_DAYS_MS : null;
      await env.DB.prepare(`UPDATE subscriptions SET grace_until = ?, last_payment_event_created = ?, updated_at = ?
          WHERE stripe_subscription_id = ? AND last_payment_event_created <= ?`)
        .bind(graceUntil, event.created * 1000, Date.now(), subscriptionId, event.created * 1000).run();
    }
  }

  await enqueuePendingRetentionJobs(env);
  await env.DB.prepare("INSERT INTO stripe_events (event_id, event_type, event_created, processed_at) VALUES (?, ?, ?, ?)")
    .bind(event.id, event.type, event.created * 1000, Date.now()).run();
  return Response.json({ received: true }, { headers: { "cache-control": "no-store" } });
}

async function ensureCustomer(stripe: Stripe, env: CloudflareEnv, userId: string): Promise<string> {
  const user = await env.DB.prepare("SELECT email, stripe_customer_id FROM users WHERE id = ?")
    .bind(userId).first<{ email: string; stripe_customer_id: string | null }>();
  if (!user) throw new Error("billing_user_not_found");
  if (user.stripe_customer_id) return user.stripe_customer_id;
  const customer = await stripe.customers.create({ email: user.email, metadata: { user_id: userId } }, {
    idempotencyKey: `customer-${userId}`,
  });
  await env.DB.prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ? AND stripe_customer_id IS NULL")
    .bind(customer.id, userId).run();
  return customer.id;
}

async function syncSubscription(subscription: Stripe.Subscription, eventCreated: number, env: CloudflareEnv): Promise<void> {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  let userId = subscription.metadata.user_id;
  if (!userId) {
    const user = await env.DB.prepare("SELECT id FROM users WHERE stripe_customer_id = ?")
      .bind(customerId).first<{ id: string }>();
    userId = user?.id ?? "";
  }
  if (!userId) throw new Error("subscription_user_not_found");
  const item = subscription.items.data[0];
  if (!item) throw new Error("subscription_item_missing");
  const now = Date.now();
  const eventCreatedMs = eventCreated * 1000;
  const recurring = item.price.recurring;
  const synced = await env.DB.prepare(`INSERT INTO subscriptions
      (user_id, stripe_subscription_id, stripe_price_id, status, current_period_end,
       cancel_at_period_end, cancel_at, price_unit_amount, price_currency, price_interval,
       price_interval_count, grace_until, last_event_created, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        stripe_subscription_id = excluded.stripe_subscription_id,
        stripe_price_id = excluded.stripe_price_id,
        status = excluded.status,
        current_period_end = excluded.current_period_end,
        cancel_at_period_end = excluded.cancel_at_period_end,
        cancel_at = excluded.cancel_at,
        price_unit_amount = excluded.price_unit_amount,
        price_currency = excluded.price_currency,
        price_interval = excluded.price_interval,
        price_interval_count = excluded.price_interval_count,
        grace_until = CASE WHEN excluded.status = 'active' THEN NULL ELSE subscriptions.grace_until END,
        last_event_created = excluded.last_event_created,
        updated_at = excluded.updated_at
      WHERE excluded.last_event_created >= subscriptions.last_event_created`)
    .bind(userId, subscription.id, item.price.id, subscription.status, item.current_period_end * 1000,
      subscription.cancel_at_period_end ? 1 : 0, subscription.cancel_at ? subscription.cancel_at * 1000 : null,
      item.price.unit_amount, item.price.currency, recurring?.interval ?? null, recurring?.interval_count ?? null,
      eventCreatedMs, now).run();

  if ((synced.meta.changes ?? 0) === 1 && (subscription.status === "active" || subscription.status === "trialing")) {
    await env.DB.prepare(`INSERT OR IGNORE INTO retention_jobs
        (image_id, user_id, source_key, target_key, status, attempts, created_at, updated_at)
      SELECT id, owner_user_id, r2_key, 'plus/' || id || '.png', 'pending', 0, ?, ?
      FROM images WHERE owner_user_id = ? AND storage_tier = 'free' AND deleted_at IS NULL AND expires_at > ?`)
      .bind(now, now, userId, now).run();
  }
}

async function enqueuePendingRetentionJobs(env: CloudflareEnv): Promise<void> {
  const jobs = await env.DB.prepare("SELECT image_id FROM retention_jobs WHERE status IN ('pending', 'failed') AND attempts < 5 ORDER BY updated_at LIMIT 50")
    .all<{ image_id: string }>();
  for (const job of jobs.results) await env.RETENTION_QUEUE.send({ imageId: job.image_id });
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const subscription = invoice.parent?.subscription_details?.subscription;
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
}
