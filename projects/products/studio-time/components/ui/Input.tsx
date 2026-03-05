import { type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...rest }: Props) {
  return (
    <input
      className={`ui-focus w-full rounded-full border border-[color-mix(in_srgb,var(--border)_60%,transparent)] bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[color-mix(in_srgb,var(--muted)_80%,transparent)] ${className}`}
      {...rest}
    />
  );
}

