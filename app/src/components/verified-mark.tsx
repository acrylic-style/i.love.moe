import { CircleCheck } from "lucide-react";

export function VerifiedMark({ label, iconOnly = false }: { label: string; iconOnly?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
      <CircleCheck className="size-4" aria-hidden="true" />
      <span className={iconOnly ? "sr-only" : undefined}>{label}</span>
    </span>
  );
}
