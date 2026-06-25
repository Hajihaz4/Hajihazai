/**
 * Pure document chunking — no imports / side effects (unit-testable).
 *
 * Fixed-size character windows with overlap:
 *   - chunk size = 1000 characters
 *   - overlap    = 200 characters
 *   - order preserved (chunkIndex ascending)
 *
 * No embeddings / retrieval — text splitting only.
 */

export const CHUNK_SIZE = 1000;
export const CHUNK_OVERLAP = 200;

export interface Chunk {
  chunkIndex: number;
  content: string;
}

export function chunkDocument(
  content: string,
  size: number = CHUNK_SIZE,
  overlap: number = CHUNK_OVERLAP,
): Chunk[] {
  const text = content ?? "";
  if (!text.trim()) return [];

  // Guard against degenerate config (overlap must be < size to advance).
  const step = Math.max(1, size - overlap);

  const chunks: Chunk[] = [];
  let index = 0;
  for (let start = 0; start < text.length; start += step) {
    const slice = text.slice(start, start + size);
    chunks.push({ chunkIndex: index, content: slice });
    index++;
    if (start + size >= text.length) break; // last window reached the end
  }
  return chunks;
}
