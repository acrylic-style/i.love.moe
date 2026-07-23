import { findActiveAlbumByCode } from "@/albums";
import { unlockTarget } from "@/access";
import { getEnv } from "@/cloudflare";
import { findActiveImageByCode, SHORT_CODE_PATTERN, withApiErrors } from "@/service";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!SHORT_CODE_PATTERN.test(code)) return new Response(null, { status: 404 });
  return withApiErrors(async () => {
    const env = getEnv();
    const image = await findActiveImageByCode(env, code);
    if (image) return unlockTarget(request, env, "image", image);
    const album = await findActiveAlbumByCode(env, code);
    return album
      ? unlockTarget(request, env, "album", album.album)
      : new Response(null, { status: 404 });
  });
}
