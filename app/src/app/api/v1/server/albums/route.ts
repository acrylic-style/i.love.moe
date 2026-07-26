import { getEnv } from "@/cloudflare";
import { serverApiAlbums } from "@/server-api";
import { withApiErrors } from "@/service";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return withApiErrors(() => serverApiAlbums(request, getEnv()));
}
