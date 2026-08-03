import { getEnv } from "@/cloudflare";
import { updateImageFavorite } from "@/servers";

export const runtime = "nodejs";

export function POST(request: Request, context: { params: Promise<{ imageId: string }> }) {
  return context.params.then(({ imageId }) => updateImageFavorite(request, getEnv(), imageId));
}
