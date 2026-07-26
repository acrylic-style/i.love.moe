import { getEnv } from "@/cloudflare";
import { serverApiImageContent } from "@/server-api";
import { withApiErrors } from "@/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withApiErrors(() => serverApiImageContent(request, getEnv(), id));
}
