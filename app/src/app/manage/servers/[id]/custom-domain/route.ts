import { getEnv } from "@/cloudflare";
import { createCustomDomain, deleteCustomDomain, refreshCustomDomain } from "@/custom-domains";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = (await context.params).id;
  return new URL(request.url).searchParams.get("action") === "refresh"
    ? refreshCustomDomain(request, getEnv(), id)
    : createCustomDomain(request, getEnv(), id);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return deleteCustomDomain(request, getEnv(), (await context.params).id);
}
