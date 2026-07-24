import { notFound, redirect } from "next/navigation";
import { getEnv } from "@/cloudflare";
import { resolveCustomDomain } from "@/custom-domains";
import { publicServerDetail } from "@/servers";
import { ServerGallery } from "../../[identifier]/page";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ hostname: string }>;
}): Promise<Metadata> {
  const { hostname } = await params;
  const env = getEnv();
  const domain = await resolveCustomDomain(env, hostname);
  if (!domain || domain.status !== "active") return {};
  const detail = await publicServerDetail(env, domain.server_slug ?? domain.server_code);
  if (!detail) return {};
  const origin = `https://${hostname}`;
  const title = detail.server.display_name ?? detail.server.display_address ?? hostname;
  const imageUrl = detail.server.banner_key
    ? `${origin}/servers/assets/${detail.server.id}/banner`
    : detail.images[0]
      ? `${origin}/raw/${detail.images[0].code}`
      : undefined;
  return {
    title,
    description: detail.server.description ?? undefined,
    alternates: { canonical: origin },
    openGraph: {
      type: "website",
      title,
      description: detail.server.description ?? undefined,
      url: origin,
      images: imageUrl ? [imageUrl] : undefined,
    },
    robots: { index: true, follow: true },
  };
}

export default async function CustomDomainServerPage({
  params,
}: {
  params: Promise<{ hostname: string }>;
}) {
  const { hostname } = await params;
  const env = getEnv();
  const domain = await resolveCustomDomain(env, hostname);
  if (!domain) notFound();
  const identifier = domain.server_slug ?? domain.server_code;
  if (domain.status === "grace") redirect(`${env.PUBLIC_BASE_URL}/servers/${identifier}`);
  const detail = await publicServerDetail(env, identifier);
  if (!detail) notFound();
  return <ServerGallery detail={detail} customOrigin={`https://${hostname}`} />;
}
