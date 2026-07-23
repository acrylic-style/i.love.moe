import { getEnv } from "@/cloudflare";
import { bulkOrganizeImages } from "@/library";
import { withApiErrors } from "@/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withApiErrors(() => bulkOrganizeImages(request, getEnv()));
}
