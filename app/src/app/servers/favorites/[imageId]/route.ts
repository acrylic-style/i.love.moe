import { getEnv } from "@/cloudflare";
import { updateServerImageFavorite } from "@/servers";
import { withApiErrors } from "@/service";

export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ imageId: string }> }) {
  return withApiErrors(async () =>
    updateServerImageFavorite(request, getEnv(), (await context.params).imageId),
  );
}
