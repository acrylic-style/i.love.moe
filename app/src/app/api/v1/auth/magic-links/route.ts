import { getEnv } from "@/cloudflare";
import { requestMagicLink, withApiErrors } from "@/service";

export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return withApiErrors(() => requestMagicLink(request, getEnv()));
}
