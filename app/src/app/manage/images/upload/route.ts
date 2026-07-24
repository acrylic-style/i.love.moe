import { getEnv } from "@/cloudflare";
import { uploadManagedImage, withApiErrors } from "@/service";

export async function POST(request: Request): Promise<Response> {
  return withApiErrors(() => uploadManagedImage(request, getEnv()));
}
