import { createCheckout } from "@/billing";
import { getEnv } from "@/cloudflare";
import { withApiErrors } from "@/service";

export function POST(request: Request) {
  return withApiErrors(() => createCheckout(request, getEnv()));
}
