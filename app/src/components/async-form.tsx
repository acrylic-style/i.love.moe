"use client";

import { type ComponentProps, type FormEvent, type ReactNode, useState } from "react";
import { Check, LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

export type AsyncStatus = "idle" | "pending" | "saved" | "failed";

type ButtonProps = ComponentProps<typeof Button>;

export function StatusButton({
  status,
  idle,
  pending,
  saved,
  failed,
  ...props
}: ButtonProps & {
  status: AsyncStatus;
  idle: string;
  pending: string;
  saved: string;
  failed: string;
}) {
  const labels = { idle, pending, saved, failed };
  return (
    <Button
      {...props}
      className={cn("relative", props.className)}
      disabled={props.disabled || status === "pending"}
    >
      {status !== "idle" && (
        <span className="absolute left-2 inline-flex size-4 items-center justify-center">
          {status === "pending" && <LoaderCircle className="size-4 animate-spin" />}
          {status === "saved" && <Check className="size-4" />}
          {status === "failed" && <X className="size-4" />}
        </span>
      )}
      <span className="grid place-items-center">
        {Object.entries(labels).map(([key, label]) => (
          <span
            className={`col-start-1 row-start-1 ${key === status ? "" : "invisible"}`}
            aria-hidden={key === status ? undefined : true}
            key={key}
          >
            {label}
          </span>
        ))}
      </span>
    </Button>
  );
}

export function AsyncForm({
  action,
  method = "POST",
  children,
  idle,
  pending,
  saved,
  failed,
  resetOnSuccess = false,
  buttonProps,
  className,
}: {
  action: string;
  method?: "POST" | "DELETE";
  children?: ReactNode;
  idle: string;
  pending: string;
  saved: string;
  failed: string;
  resetOnSuccess?: boolean;
  buttonProps?: Omit<ButtonProps, "children" | "type">;
  className?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<AsyncStatus>("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "pending") return;
    setStatus("pending");
    const form = event.currentTarget;
    try {
      const response = await fetch(action, { method, body: new FormData(form) });
      if (!response.ok) throw new Error("request_failed");
      if (resetOnSuccess) form.reset();
      setStatus("saved");
      window.setTimeout(() => router.refresh(), 600);
      window.setTimeout(() => setStatus("idle"), 2400);
    } catch {
      setStatus("failed");
    }
  }

  return (
    <form className={className} onSubmit={submit}>
      {children}
      <StatusButton
        {...buttonProps}
        type="submit"
        status={status}
        idle={idle}
        pending={pending}
        saved={saved}
        failed={failed}
      />
    </form>
  );
}
