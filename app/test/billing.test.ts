import { describe, expect, it } from "vitest";
import { plusCheckoutSessionParams } from "../src/billing";

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
    expect(params.mode).toBe("subscription");
    expect(params.subscription_data?.metadata?.user_id).toBe("user-test");
  });
});
