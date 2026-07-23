import type { TagColor } from "@/types";
import { cn } from "@/lib/utils";

const colorClasses: Record<TagColor, string> = {
  gray: "border-zinc-400/30 bg-zinc-500/15 text-zinc-200",
  red: "border-red-400/30 bg-red-500/15 text-red-200",
  orange: "border-orange-400/30 bg-orange-500/15 text-orange-200",
  yellow: "border-yellow-400/30 bg-yellow-500/15 text-yellow-100",
  green: "border-green-400/30 bg-green-500/15 text-green-200",
  blue: "border-blue-400/30 bg-blue-500/15 text-blue-200",
  purple: "border-purple-400/30 bg-purple-500/15 text-purple-200",
  pink: "border-pink-400/30 bg-pink-500/15 text-pink-200",
};

export function TagBadge({
  name,
  color,
  className,
}: {
  name: string;
  color: TagColor;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        colorClasses[color],
        className,
      )}
    >
      <span className="truncate">{name}</span>
    </span>
  );
}
