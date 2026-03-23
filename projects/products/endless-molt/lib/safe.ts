export type JsonRecord = Record<string, unknown>;

export function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

export async function readJsonRecord(response: Response): Promise<JsonRecord | null> {
  const data = await response.json().catch(() => null);
  return isJsonRecord(data) ? data : null;
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function getStringValue(record: JsonRecord | null, key: string): string | undefined {
  if (!record) return undefined;
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}
