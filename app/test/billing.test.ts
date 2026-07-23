import { describe, expect, it } from "vitest";
import { plusCheckoutIdempotencyKey, plusCheckoutSessionParams } from "../src/billing";

describe("Plus Checkout", () => {
  it("requests 3D Secure for supported card payments", () => {
    const params = plusCheckoutSessionParams({
      customerId: "cus_test",
      userId: "user-test",
      priceId: "price_plus",
      baseUrl: "https://i.らぶ.moe",
    });

    expect(params.payment_method_options?.card?.request_three_d_secure).toBe("any");
    expect(params.allow_promotion_codes).toBe(true);
    expect(params.payment_method_collection).toBe("if_required");
    expect(params.mode).toBe("subscription");
    expect(params.subscription_data?.metadata?.user_id).toBe("user-test");
  });

  it("versions idempotency keys so changed Checkout parameters do not reuse old keys", () => {
    const now = 495_771 * 3_600_000;
    expect(plusCheckoutIdempotencyKey("user-test", now)).toBe("plus-checkout-v3-user-test-495771");
  });
});
