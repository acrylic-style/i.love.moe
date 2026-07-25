import { getEnv } from "@/cloudflare";
import { verifyWebMagicLink } from "@/web-auth";

export async function GET(request: Request): Promise<Response> {
  return verifyWebMagicLink(new URL(request.url), getEnv());
}
