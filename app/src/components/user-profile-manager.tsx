"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { type AsyncStatus, StatusButton } from "@/components/async-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ProfileValue {
  displayName: string;
  bio: string;
  slug: string;
  primaryMinecraftUuid: string;
  published: boolean;
}

interface MinecraftProfileOption {
  uuid: string;
  name: string;
}

interface UserProfileCopy {
  displayName: string;
  bio: string;
  slug: string;
  slugHelp: string;
  minecraftProfile: string;
  minecraftProfileHelp: string;
  published: string;
  publishedHelp: string;
  save: string;
  saving: string;
  saved: string;
  failed: string;
  invalidProfile: string;
  invalidPrimaryProfile: string;
  slugUnavailable: string;
}

export function UserProfileManager({
  profile,
  minecraftProfiles,
  copy,
}: {
  profile: ProfileValue | null;
  minecraftProfiles: MinecraftProfileOption[];
  copy: UserProfileCopy;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "pending") return;
    setStatus("pending");
    setError(null);
    const form = new FormData(event.currentTarget);
    if (form.get("published") === "on") form.set("published", "1");
    try {
      const response = await fetch("/manage/profile/update", { method: "POST", body: form });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "request_failed");
      setStatus("saved");
      window.setTimeout(() => router.refresh(), 600);
      window.setTimeout(() => setStatus("idle"), 2400);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "request_failed";
      setError(
        code === "slug_unavailable"
          ? copy.slugUnavailable
          : code === "invalid_primary_profile"
            ? copy.invalidPrimaryProfile
            : code === "invalid_profile"
              ? copy.invalidProfile
              : copy.failed,
      );
      setStatus("failed");
    }
  }

  return (
    <form className="space-y-6" onSubmit={save}>
      <div className="space-y-2">
        <Label htmlFor="user-profile-display-name">{copy.displayName}</Label>
        <Input
          id="user-profile-display-name"
          name="displayName"
          required
          maxLength={100}
          defaultValue={profile?.displayName ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="user-profile-bio">{copy.bio}</Label>
        <Textarea
          id="user-profile-bio"
          name="bio"
          maxLength={2000}
          rows={6}
          defaultValue={profile?.bio ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="user-profile-slug">{copy.slug}</Label>
        <Input
          id="user-profile-slug"
          name="slug"
          required
          minLength={3}
          maxLength={32}
          pattern="[a-z0-9][a-z0-9-]{1,30}[a-z0-9]"
          defaultValue={profile?.slug ?? ""}
          autoCapitalize="none"
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">{copy.slugHelp}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="user-profile-minecraft">{copy.minecraftProfile}</Label>
        <select
          id="user-profile-minecraft"
          name="primaryMinecraftUuid"
          required
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          defaultValue={profile?.primaryMinecraftUuid ?? minecraftProfiles[0]?.uuid ?? ""}
        >
          {minecraftProfiles.map((minecraftProfile) => (
            <option value={minecraftProfile.uuid} key={minecraftProfile.uuid}>
              {minecraftProfile.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">{copy.minecraftProfileHelp}</p>
      </div>
      <label className="flex items-start gap-3 rounded-lg border p-4">
        <input
          className="mt-1 size-4"
          type="checkbox"
          name="published"
          defaultChecked={profile?.published ?? false}
        />
        <span>
          <span className="block font-medium">{copy.published}</span>
          <span className="block text-sm text-muted-foreground">{copy.publishedHelp}</span>
        </span>
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <StatusButton
        type="submit"
        status={status}
        idle={copy.save}
        pending={copy.saving}
        saved={copy.saved}
        failed={copy.failed}
        disabled={minecraftProfiles.length === 0}
      />
    </form>
  );
}
