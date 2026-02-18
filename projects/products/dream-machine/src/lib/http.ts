export function errorMessage(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  return fallback;
}

export function errorStatus(err: unknown, fallback: number) {
  if (typeof err === "object" && err !== null && "status" in err) {
    const s = (err as { status?: unknown }).status;
    if (typeof s === "number" && Number.isFinite(s)) return s;
  }
  return fallback;
}

