import { getEnv } from "@/cloudflare";
import { logout, withApiErrors } from "@/service";

export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return withApiErrors(() => logout(request, getEnv()));
}
