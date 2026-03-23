export const MIN_ARTWORK_TITLE_LENGTH = 3;
export const MAX_ARTWORK_TITLE_LENGTH = 200;
export const MIN_ARTIST_STATEMENT_LENGTH = 80;
export const MAX_ARTIST_STATEMENT_LENGTH = 2000;

export function normalizeArtworkTitle(value: string) {
  return value.trim();
}

export function normalizeArtistStatement(value: string) {
  return value.trim();
}

export function resolveArtistStatement(input: { description?: string; artistStatement?: string }) {
  return normalizeArtistStatement(input.artistStatement || input.description || '');
}

export function getArtworkSubmissionError(input: { title: string; artistStatement: string }) {
  const title = normalizeArtworkTitle(input.title);
  const artistStatement = normalizeArtistStatement(input.artistStatement);

  if (!title) {
    return 'Title is required before upload.';
  }
  if (title.length < MIN_ARTWORK_TITLE_LENGTH) {
    return `Title must be at least ${MIN_ARTWORK_TITLE_LENGTH} characters.`;
  }
  if (title.length > MAX_ARTWORK_TITLE_LENGTH) {
    return `Title must be ${MAX_ARTWORK_TITLE_LENGTH} characters or fewer.`;
  }

  if (!artistStatement) {
    return 'Artist statement is required before upload.';
  }
  if (artistStatement.length < MIN_ARTIST_STATEMENT_LENGTH) {
    return `Artist statement must be at least ${MIN_ARTIST_STATEMENT_LENGTH} characters.`;
  }
  if (artistStatement.length > MAX_ARTIST_STATEMENT_LENGTH) {
    return `Artist statement must be ${MAX_ARTIST_STATEMENT_LENGTH} characters or fewer.`;
  }

  return null;
}

export function normalizeArtworkSubmission(input: {
  title: string;
  description?: string;
  artistStatement?: string;
}) {
  const title = normalizeArtworkTitle(input.title);
  const artistStatement = resolveArtistStatement(input);

  return {
    title,
    artistStatement,
  };
}
