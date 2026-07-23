import { getEnv } from "@/cloudflare";
import { devicePlan, withApiErrors } from "@/service";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return withApiErrors(() => devicePlan(request, getEnv()));
}
