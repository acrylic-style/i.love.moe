import { getEnv } from "@/cloudflare";
import { serverApiImages } from "@/server-api";
import { withApiErrors } from "@/service";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return withApiErrors(() => serverApiImages(request, getEnv()));
}
