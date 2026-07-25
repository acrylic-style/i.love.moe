import { getEnv } from "@/cloudflare";
import { linkMinecraftProfile } from "@/web-auth";

export async function POST(request: Request): Promise<Response> {
  return linkMinecraftProfile(request, getEnv());
}
