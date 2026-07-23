import { getEnv } from "@/cloudflare";
import { createBrowserLogin, withApiErrors } from "@/service";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return withApiErrors(() => createBrowserLogin(request, getEnv()));
}
