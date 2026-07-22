import { getEnv } from "@/cloudflare";
import { verifyMagicLink, withApiErrors } from "@/service";

export const dynamic = "force-dynamic";
export function GET(request: Request) { return withApiErrors(() => verifyMagicLink(new URL(request.url), getEnv())); }
