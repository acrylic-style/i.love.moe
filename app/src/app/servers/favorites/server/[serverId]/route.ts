import { getEnv } from "@/cloudflare";
import { updateServerFavorite } from "@/servers";
import { withApiErrors } from "@/service";

export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ serverId: string }> }) {
  return withApiErrors(async () =>
    updateServerFavorite(request, getEnv(), (await context.params).serverId),
  );
}
