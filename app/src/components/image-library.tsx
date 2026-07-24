"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { HeartIcon, LoaderCircleIcon, TagsIcon } from "lucide-react";
import type { AlbumRow, LibraryImageRow, TagColor, TagRow, Visibility } from "@/types";
import type { LibraryFilters, ServerFacet } from "@/library";
import { TAG_COLORS } from "@/types";
import { useI18n } from "@/i18n/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocalDateTime } from "@/components/local-date-time";
import { TagBadge } from "@/components/tag-badge";
import { cn } from "@/lib/utils";

const SELECTION_KEY = "i-love-moe-library-selection";

interface SelectionRecord {
  signature: string;
  ids: string[];
}

interface Props {
  images: LibraryImageRow[];
  tags: TagRow[];
  albums: AlbumRow[];
  servers: ServerFacet[];
  filters: LibraryFilters;
  nextCursor: string | null;
  isPlus: boolean;
}

type BulkAction = "favorite" | "unfavorite" | "add_tags" | "remove_tags" | "add_album" | "delete";

export function ImageLibrary({
  images,
  tags: initialTags,
  albums,
  servers,
  filters,
  nextCursor,
  isPlus,
}: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const signature = filterSignature(filters);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tags, setTags] = useState(initialTags);
  const [action, setAction] = useState<BulkAction>("favorite");
  const [actionTarget, setActionTarget] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [showTags, setShowTags] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(
        sessionStorage.getItem(SELECTION_KEY) ?? "null",
      ) as SelectionRecord | null;
      if (stored?.signature === signature && Array.isArray(stored.ids))
        setSelected(new Set(stored.ids.slice(0, 100)));
      else sessionStorage.removeItem(SELECTION_KEY);
    } catch {
      sessionStorage.removeItem(SELECTION_KEY);
    }
  }, [signature]);

  useEffect(() => {
    sessionStorage.setItem(
      SELECTION_KEY,
      JSON.stringify({ signature, ids: [...selected] } satisfies SelectionRecord),
    );
  }, [selected, signature]);

  const allCurrentSelected = images.length > 0 && images.every((image) => selected.has(image.id));
  const selectedCount = selected.size;
  const canRun =
    isPlus &&
    selectedCount > 0 &&
    (action === "favorite" ||
      action === "unfavorite" ||
      action === "delete" ||
      actionTarget.length > 0);

  function toggle(id: string, checked: boolean) {
    setStatus("");
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        if (next.size >= 100) {
          setStatus(t("library.selectionLimit"));
          return current;
        }
        next.add(id);
      } else next.delete(id);
      return next;
    });
  }

  function toggleCurrent(checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const image of images) {
        if (!checked) next.delete(image.id);
        else if (next.size < 100) next.add(image.id);
      }
      return next;
    });
  }

  async function runBulkAction() {
    if (!canRun) return;
    if (
      action === "delete" &&
      !window.confirm(t("library.deleteConfirm", { count: selectedCount }))
    )
      return;
    setPending(true);
    setStatus(t("library.applying"));
    try {
      const response = await fetch("/manage/images/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageIds: [...selected],
          action,
          tagIds: action === "add_tags" || action === "remove_tags" ? [actionTarget] : undefined,
          albumId: action === "add_album" ? actionTarget : undefined,
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        failedIds?: string[];
        succeededIds?: string[];
      };
      if (!response.ok && response.status !== 207) throw new Error(body.error ?? "request_failed");
      const failed = body.failedIds?.length ?? 0;
      setStatus(
        failed > 0 ? t("library.partialDelete", { count: failed }) : t("library.actionComplete"),
      );
      if (failed > 0) setSelected(new Set(body.failedIds));
      else setSelected(new Set());
      router.refresh();
    } catch (error) {
      setStatus(t(`library.error.${error instanceof Error ? error.message : "request_failed"}`));
    } finally {
      setPending(false);
    }
  }

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const key of ["q", "tag", "server", "visibility", "favorite", "expiring", "sort"]) {
      const value = form.get(key);
      if (typeof value === "string" && value) params.set(key, value);
    }
    const from = form.get("from");
    const to = form.get("to");
    if (typeof from === "string" && from)
      params.set("from", String(new Date(`${from}T00:00:00`).getTime()));
    if (typeof to === "string" && to)
      params.set("to", String(new Date(`${to}T00:00:00`).getTime() + 24 * 60 * 60 * 1000));
    setSelected(new Set());
    router.push(`/manage/images${params.size ? `?${params}` : ""}`);
  }

  const nextUrl = useMemo(() => {
    if (!nextCursor) return "";
    const params = filtersToParams(filters);
    params.set("cursor", nextCursor);
    return `/manage/images?${params}`;
  }, [filters, nextCursor]);

  return (
    <div className="space-y-8">
      <form className="space-y-4 rounded-xl border bg-card p-5" onSubmit={submitFilters}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="library-q">{t("library.search")}</Label>
            <Input
              id="library-q"
              name="q"
              defaultValue={filters.q}
              maxLength={100}
              placeholder={t("library.searchPlaceholder")}
            />
          </div>
          <FilterSelect
            id="library-tag"
            name="tag"
            label={t("library.filterTag")}
            value={filters.tag}
            emptyLabel={t("library.allTags")}
            options={tags.map((tag) => ({ value: tag.id, label: tag.name }))}
          />
          <FilterSelect
            id="library-server"
            name="server"
            label={t("library.filterServer")}
            value={filters.server}
            emptyLabel={t("library.allServers")}
            options={servers}
          />
          <FilterSelect
            id="library-visibility"
            name="visibility"
            label={t("library.filterVisibility")}
            value={filters.visibility}
            emptyLabel={t("library.allVisibility")}
            options={[
              { value: "public", label: t("visibility.public") },
              { value: "unlisted", label: t("visibility.unlisted") },
              { value: "private", label: t("visibility.private") },
              { value: "passphrase", label: t("visibility.passphrase") },
            ]}
          />
          <div className="space-y-2">
            <Label htmlFor="library-from">{t("library.from")}</Label>
            <Input
              id="library-from"
              name="from"
              type="date"
              defaultValue={localDate(filters.from)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="library-to">{t("library.to")}</Label>
            <Input
              id="library-to"
              name="to"
              type="date"
              defaultValue={localDate(filters.to === null ? null : filters.to - 1)}
            />
          </div>
          <FilterSelect
            id="library-sort"
            name="sort"
            label={t("library.sort")}
            value={filters.sort}
            options={[
              { value: "newest", label: t("library.sortNewest") },
              { value: "oldest", label: t("library.sortOldest") },
              { value: "expiring", label: t("library.sortExpiring") },
              { value: "title", label: t("library.sortTitle") },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <CheckFilter
            name="favorite"
            value="1"
            label={t("library.onlyFavorites")}
            checked={filters.favorite}
          />
          <CheckFilter
            name="expiring"
            value="1"
            label={t("library.expiringSoon")}
            checked={filters.expiring}
          />
          <Button type="submit">{t("library.applyFilters")}</Button>
          <a className={buttonVariants({ variant: "ghost" })} href="/manage/images">
            {t("library.clearFilters")}
          </a>
        </div>
      </form>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Checkbox
            id="select-current-page"
            checked={allCurrentSelected}
            onCheckedChange={(checked) => toggleCurrent(checked === true)}
            disabled={!isPlus}
          />
          <Label htmlFor="select-current-page">
            {t("library.selectPage", { count: images.length })}
          </Label>
        </div>
        <Button type="button" variant="outline" onClick={() => setShowTags((value) => !value)}>
          <TagsIcon />
          {t("library.manageTags")}
        </Button>
      </div>

      {!isPlus && (
        <p className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm">
          {t("library.plusReadOnly")}{" "}
          <a className="text-primary underline" href="/plus">
            {t("home.viewPlus")}
          </a>
        </p>
      )}

      {showTags && (
        <TagManager
          tags={tags}
          disabled={!isPlus}
          onTagsChange={setTags}
          onStatus={setStatus}
          onRefresh={() => router.refresh()}
        />
      )}

      {images.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          {t("library.noResults")}
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image) => (
            <Card
              key={image.id}
              className={cn(
                "gap-4 overflow-hidden pt-0",
                selected.has(image.id) && "ring-2 ring-primary",
              )}
            >
              <div className="relative">
                <a href={`/manage/images/${image.id}`} className="block overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="h-44 w-full object-cover transition-transform hover:scale-[1.02]"
                    src={`/raw/${image.code}`}
                    alt={image.title ?? ""}
                  />
                </a>
                <div className="absolute top-3 left-3 rounded-md bg-background/90 p-2 shadow">
                  <Checkbox
                    aria-label={t("library.selectImage")}
                    checked={selected.has(image.id)}
                    onCheckedChange={(checked) => toggle(image.id, checked === true)}
                    disabled={!isPlus}
                  />
                </div>
                {image.favorited_at && (
                  <HeartIcon
                    className="absolute top-3 right-3 size-7 fill-primary text-primary drop-shadow"
                    aria-label={t("library.favorite")}
                  />
                )}
              </div>
              <CardContent className="space-y-3">
                <div>
                  <h2 className="truncate font-semibold">{image.title ?? t("common.untitled")}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {visibilityLabel(image.visibility, image.discoverability, t)} ·{" "}
                    <LocalDateTime value={new Date(image.created_at).toISOString()} />
                  </p>
                </div>
                {(image.server_name || image.server_address) && (
                  <p className="truncate text-sm text-muted-foreground">
                    {image.server_name ?? image.server_address}
                  </p>
                )}
                {image.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {image.tags.map((tag) => (
                      <TagBadge key={tag.id} name={tag.name} color={tag.color} />
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {t("library.expires")}{" "}
                  <LocalDateTime value={new Date(image.expires_at).toISOString()} />
                </p>
              </CardContent>
              <CardFooter className="justify-between">
                <a className="text-sm text-primary hover:underline" href={`/${image.code}`}>
                  {image.code}
                </a>
                <a
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                  href={`/manage/images/${image.id}`}
                >
                  {t("common.edit")}
                </a>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        {filters.cursor ? (
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t("library.previous")}
          </Button>
        ) : (
          <span />
        )}
        {nextUrl && (
          <a className={buttonVariants({ variant: "outline" })} href={nextUrl}>
            {t("library.next")}
          </a>
        )}
      </div>

      {selectedCount > 0 && (
        <div className="sticky bottom-4 z-20 rounded-xl border bg-card/95 p-4 shadow-xl backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <strong className="whitespace-nowrap">
              {t("library.selected", { count: selectedCount })}
            </strong>
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={action}
              onChange={(event) => {
                setAction(event.target.value as BulkAction);
                setActionTarget("");
              }}
            >
              <option value="favorite">{t("library.action.favorite")}</option>
              <option value="unfavorite">{t("library.action.unfavorite")}</option>
              <option value="add_tags">{t("library.action.addTag")}</option>
              <option value="remove_tags">{t("library.action.removeTag")}</option>
              <option value="add_album">{t("library.action.addAlbum")}</option>
              <option value="delete">{t("library.action.delete")}</option>
            </select>
            {(action === "add_tags" || action === "remove_tags") && (
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={actionTarget}
                onChange={(event) => setActionTarget(event.target.value)}
              >
                <option value="">{t("library.chooseTag")}</option>
                {tags.map((tag) => (
                  <option value={tag.id} key={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            )}
            {action === "add_album" && (
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={actionTarget}
                onChange={(event) => setActionTarget(event.target.value)}
              >
                <option value="">{t("library.chooseAlbum")}</option>
                {albums.map((album) => (
                  <option value={album.id} key={album.id}>
                    {album.title}
                  </option>
                ))}
              </select>
            )}
            <Button type="button" onClick={runBulkAction} disabled={!canRun || pending}>
              {pending && <LoaderCircleIcon className="animate-spin" />}
              {t("library.runAction")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setSelected(new Set())}>
              {t("library.clearSelection")}
            </Button>
          </div>
        </div>
      )}
      <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
        {status}
      </p>
    </div>
  );
}

function TagManager({
  tags,
  disabled,
  onTagsChange,
  onStatus,
  onRefresh,
}: {
  tags: TagRow[];
  disabled: boolean;
  onTagsChange: (tags: TagRow[]) => void;
  onStatus: (status: string) => void;
  onRefresh: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [color, setColor] = useState<TagColor>("pink");
  const [pendingId, setPendingId] = useState("");

  async function create(event: FormEvent) {
    event.preventDefault();
    setPendingId("new");
    try {
      const response = await fetch("/manage/tags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, color }),
      });
      const body = (await response.json()) as { tag?: TagRow; error?: string };
      if (!response.ok || !body.tag) throw new Error(body.error ?? "request_failed");
      onTagsChange([...tags, body.tag].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      onStatus(t("library.tagCreated"));
    } catch (error) {
      onStatus(t(`library.error.${error instanceof Error ? error.message : "request_failed"}`));
    } finally {
      setPendingId("");
    }
  }

  async function save(tag: TagRow, form: HTMLFormElement) {
    setPendingId(tag.id);
    const data = new FormData(form);
    try {
      const response = await fetch(`/manage/tags/${tag.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: data.get("name"), color: data.get("color") }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "request_failed");
      onTagsChange(
        tags.map((item) =>
          item.id === tag.id
            ? {
                ...item,
                name: String(data.get("name")),
                color: String(data.get("color")) as TagColor,
              }
            : item,
        ),
      );
      onStatus(t("library.tagSaved"));
      onRefresh();
    } catch (error) {
      onStatus(t(`library.error.${error instanceof Error ? error.message : "request_failed"}`));
    } finally {
      setPendingId("");
    }
  }

  async function remove(tag: TagRow) {
    if (!window.confirm(t("library.deleteTagConfirm", { count: tag.image_count ?? 0 }))) return;
    setPendingId(tag.id);
    try {
      const response = await fetch(`/manage/tags/${tag.id}`, { method: "DELETE" });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "request_failed");
      onTagsChange(tags.filter((item) => item.id !== tag.id));
      onStatus(t("library.tagDeleted"));
      onRefresh();
    } catch (error) {
      onStatus(t(`library.error.${error instanceof Error ? error.message : "request_failed"}`));
    } finally {
      setPendingId("");
    }
  }

  return (
    <section className="space-y-5 rounded-xl border bg-card p-5">
      <div>
        <h2 className="text-xl font-semibold">{t("library.manageTags")}</h2>
        <p className="text-sm text-muted-foreground">{t("library.tagLimits")}</p>
      </div>
      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={create}>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("library.tagName")}
          maxLength={30}
          required
          disabled={disabled}
        />
        <ColorSelect value={color} onChange={setColor} disabled={disabled} />
        <Button disabled={disabled || pendingId === "new"} type="submit">
          {pendingId === "new" && <LoaderCircleIcon className="animate-spin" />}
          {t("library.createTag")}
        </Button>
      </form>
      <div className="space-y-3">
        {tags.map((tag) => (
          <form
            key={tag.id}
            className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_10rem_auto_auto] sm:items-center"
            onSubmit={(event) => {
              event.preventDefault();
              void save(tag, event.currentTarget);
            }}
          >
            <Input
              name="name"
              defaultValue={tag.name}
              maxLength={30}
              required
              disabled={disabled}
            />
            <select
              name="color"
              defaultValue={tag.color}
              className="h-9 rounded-md border bg-background px-3 text-sm"
              disabled={disabled}
            >
              {TAG_COLORS.map((value) => (
                <option value={value} key={value}>
                  {t(`library.color.${value}`)}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline" disabled={disabled || pendingId === tag.id}>
              {pendingId === tag.id && <LoaderCircleIcon className="animate-spin" />}
              {t("common.save")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={disabled || pendingId === tag.id}
              onClick={() => void remove(tag)}
            >
              {t("library.deleteTag")}
            </Button>
          </form>
        ))}
      </div>
    </section>
  );
}

function FilterSelect({
  id,
  name,
  label,
  value,
  emptyLabel,
  options,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  emptyLabel?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        defaultValue={value}
        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
      >
        {emptyLabel && <option value="">{emptyLabel}</option>}
        {options.map((option) => (
          <option value={option.value} key={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function CheckFilter({
  name,
  value,
  label,
  checked,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox name={name} value={value} defaultChecked={checked} />
      {label}
    </label>
  );
}

function ColorSelect({
  value,
  onChange,
  disabled,
}: {
  value: TagColor;
  onChange: (color: TagColor) => void;
  disabled: boolean;
}) {
  const { t } = useI18n();
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as TagColor)}
      className="h-9 rounded-md border bg-background px-3 text-sm"
      disabled={disabled}
    >
      {TAG_COLORS.map((color) => (
        <option value={color} key={color}>
          {t(`library.color.${color}`)}
        </option>
      ))}
    </select>
  );
}

function visibilityLabel(
  visibility: Visibility,
  discoverability: "hidden" | "public",
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  if (visibility === "unlisted" && discoverability === "public") return t("visibility.public");
  return t(`visibility.${visibility}`);
}

function localDate(timestamp: number | null): string {
  if (timestamp === null) return "";
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function filterSignature(filters: LibraryFilters): string {
  return JSON.stringify({ ...filters, cursor: "" });
}

function filtersToParams(filters: LibraryFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.server) params.set("server", filters.server);
  if (filters.visibility) params.set("visibility", filters.visibility);
  if (filters.favorite) params.set("favorite", "1");
  if (filters.from !== null) params.set("from", String(filters.from));
  if (filters.to !== null) params.set("to", String(filters.to));
  if (filters.expiring) params.set("expiring", "1");
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  return params;
}
