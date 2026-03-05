import { type ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

export function Button({ variant = "primary", className = "", ...rest }: Props) {
  const base =
    "ui-focus inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition";
  const v =
    variant === "primary"
      ? "bg-[var(--primary)] text-black hover:brightness-110"
      : "border border-[color-mix(in_srgb,var(--border)_65%,transparent)] text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/5";
  return <button className={`${base} ${v} ${className}`} {...rest} />;
}

