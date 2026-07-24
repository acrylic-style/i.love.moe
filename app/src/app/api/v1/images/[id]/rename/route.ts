import { getEnv } from "@/cloudflare";
import { renameImage, withApiErrors } from "@/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => renameImage(request, getEnv(), (await params).id));
}
