import { describe, expect, it } from "vitest";
import { FREE_PLAN, PLUS_PLAN, subscriptionPriceLabel, subscriptionSummary } from "../src/plans";

describe("plan limits", () => {
  it("keeps the free experience within the agreed limits", () => {
    expect(FREE_PLAN).toMatchObject({
      uploadsPerThirtyDays: 50,
      retentionDays: 30,
      albums: 1,
      imagesPerAlbum: 20,
      protectedSharing: false,
      libraryOrganization: false,
      serverDiscordWebhooks: 1,
    });
  });

  it("applies the Plus limits", () => {
    expect(PLUS_PLAN).toMatchObject({
      uploadsPerThirtyDays: 500,
      retentionDays: 365,
      albums: 100,
      imagesPerAlbum: 200,
      protectedSharing: true,
      libraryOrganization: true,
      serverDiscordWebhooks: 5,
    });
  });

  it("requires the configured Price and an active period", async () => {
    const now = Date.now();
    expect(
      (
        await subscriptionSummary(
          mockEnv({
            stripe_price_id: "price_plus",
            status: "active",
            current_period_end: now + 60_000,
            cancel_at_period_end: 0,
            grace_until: null,
          }),
          "user-1",
        )
      ).plan,
    ).toBe("plus");
    expect(
      (
        await subscriptionSummary(
          mockEnv({
            stripe_price_id: "price_other",
            status: "active",
            current_period_end: now + 60_000,
            cancel_at_period_end: 0,
            grace_until: null,
          }),
          "user-1",
        )
      ).plan,
    ).toBe("free");
  });

  it("keeps Plus during the payment grace period", async () => {
    const summary = await subscriptionSummary(
      mockEnv({
        stripe_price_id: "price_plus",
        status: "past_due",
        current_period_end: Date.now() - 1,
        cancel_at_period_end: 0,
        grace_until: Date.now() + 60_000,
      }),
      "user-1",
    );
    expect(summary.plan).toBe("plus");
  });

  it("uses cancel_at for a scheduled cancellation and falls back to the period end", async () => {
    const now = Date.now();
    const customCancelAt = now + 30_000;
    const custom = await subscriptionSummary(
      mockEnv({
        stripe_price_id: "price_plus",
        status: "active",
        current_period_end: now + 60_000,
        cancel_at_period_end: 0,
        cancel_at: customCancelAt,
        grace_until: null,
      }),
      "user-1",
    );
    expect(custom.scheduledCancellationAt).toBe(customCancelAt);

    const periodEnd = now + 120_000;
    const period = await subscriptionSummary(
      mockEnv({
        stripe_price_id: "price_plus",
        status: "active",
        current_period_end: periodEnd,
        cancel_at_period_end: 1,
        cancel_at: null,
        grace_until: null,
      }),
      "user-1",
    );
    expect(period.scheduledCancellationAt).toBe(periodEnd);
  });

  it("formats the stored Stripe price next to the plan", () => {
    expect(
      subscriptionPriceLabel({
        plan: "plus",
        status: "active",
        currentPeriodEnd: Date.now() + 60_000,
        cancelAtPeriodEnd: false,
        scheduledCancellationAt: null,
        graceUntil: null,
        priceUnitAmount: 480,
        priceCurrency: "jpy",
        priceInterval: "month",
        priceIntervalCount: 1,
      }),
    ).toBe("￥480／月");
    expect(
      subscriptionPriceLabel(
        {
          plan: "plus",
          status: "active",
          currentPeriodEnd: Date.now() + 60_000,
          cancelAtPeriodEnd: false,
          scheduledCancellationAt: null,
          graceUntil: null,
          priceUnitAmount: 480,
          priceCurrency: "jpy",
          priceInterval: "month",
          priceIntervalCount: 1,
        },
        "en",
      ),
    ).toBe("¥480/month");
  });
});

function mockEnv(row: Record<string, unknown>): CloudflareEnv {
  return {
    STRIPE_PLUS_PRICE_ID: "price_plus",
    DB: {
      prepare: () => ({ bind: () => ({ first: async () => row }) }),
    },
  } as unknown as CloudflareEnv;
}
