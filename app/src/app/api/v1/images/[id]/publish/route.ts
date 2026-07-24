import { getEnv } from "@/cloudflare";
import { publishImage, withApiErrors } from "@/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => publishImage(request, getEnv(), (await params).id));
}
