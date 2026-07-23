import { createAlbum } from "@/albums";
import { getEnv } from "@/cloudflare";
import { withApiErrors } from "@/service";

export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return withApiErrors(() => createAlbum(request, getEnv()));
}
