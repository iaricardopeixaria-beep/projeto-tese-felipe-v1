/**
 * document_id sintético para jobs de normas iniciados a partir de capítulo.
 * Formato: "chapter:chapterId:versionId"
 */
export const CHAPTER_NORMS_JOB_PREFIX = 'chapter:';

export function isChapterNormsJob(documentId: string | null): boolean {
  return !!documentId?.startsWith(CHAPTER_NORMS_JOB_PREFIX);
}

export function parseChapterNormsJobId(documentId: string): { chapterId: string; versionId: string } | null {
  if (!documentId.startsWith(CHAPTER_NORMS_JOB_PREFIX)) return null;
  const rest = documentId.slice(CHAPTER_NORMS_JOB_PREFIX.length);
  const [chapterId, versionId] = rest.split(':');
  return chapterId && versionId ? { chapterId, versionId } : null;
}
