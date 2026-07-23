import { getEnv } from "@/cloudflare";
import { submitBrowserLogin, withApiErrors } from "@/service";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return withApiErrors(() => submitBrowserLogin(request, getEnv()));
}
