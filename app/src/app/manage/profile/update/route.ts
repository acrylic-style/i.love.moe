import { getEnv } from "@/cloudflare";
import { updateUserProfile } from "@/users";

export const runtime = "nodejs";

export function POST(request: Request) {
  return updateUserProfile(request, getEnv());
}
