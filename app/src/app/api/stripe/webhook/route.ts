import { handleStripeWebhook } from "@/billing";
import { getEnv } from "@/cloudflare";

export function POST(request: Request) {
  return handleStripeWebhook(request, getEnv());
}
