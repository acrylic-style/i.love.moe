import { getEnv } from "@/cloudflare";
import { serveRawImage, withApiErrors } from "@/service";

export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return withApiErrors(() => serveRawImage(request, code, getEnv()));
}
