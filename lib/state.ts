import elasticlunr from 'elasticlunr';
import { TranslationProgress } from './translation/types';
import type { Thesis, Chapter, ChapterVersion, ChapterChunk } from './thesis/types';

export type Chunk = {
  ix: number;
  pageFrom: number;
  pageTo: number;
  text: string;
};

export type InMemoryDoc = {
  id: string;
  title: string;
  pages: number;
  pathTmp: string;
  chunks: Chunk[];
  index: elasticlunr.Index<any>;
  projectId?: string; // Documento pode pertencer a um projeto
};

export type TranslationJob = {
  id: string;
  documentId: string;
  progress: TranslationProgress;
  outputPath?: string;
  createdAt: Date;
  logs: string[];
};

export type Project = {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
};

// ============================================================================
// THESIS SYSTEM TYPES (In-Memory)
// ============================================================================

/**
 * In-memory thesis with cached chapters
 */
export type ThesisInMemory = Thesis & {
  chapters?: Chapter[]; // Cached chapters (loaded on-demand)
};

/**
 * In-memory chapter version with loaded chunks and index
 */
export type ChapterVersionInMemory = {
  id: string;
  chapter_id: string;
  version_number: number;
  file_path: string;
  pages: number | null;
  chunks: ChapterChunk[]; // Loaded chunks
  index: elasticlunr.Index<any>; // BM25 index for search
  metadata: Record<string, any>;
  created_at: string;
};

export type Settings = {
  openaiKey: string;
  googleKey: string;
  xaiKey: string;
  models: {
    openai: string[];
    gemini: string[];
    grok: string[];
  };
  pricesUSD: {
    [modelName: string]: {
      in: number;
      out: number;
    };
  };
};

// Use globalThis para garantir singleton mesmo com hot reload
const globalForState = globalThis as unknown as {
  __appState?: {
    docs: Map<string, InMemoryDoc>;
    translations: Map<string, TranslationJob>;
    projects: Map<string, Project>;
    theses: Map<string, ThesisInMemory>;
    chapterVersions: Map<string, ChapterVersionInMemory>;
    settings: Settings;
  };
};

// Estado em memória (singleton global)
export const state: {
  docs: Map<string, InMemoryDoc>;
  translations: Map<string, TranslationJob>;
  projects: Map<string, Project>;
  theses: Map<string, ThesisInMemory>;
  chapterVersions: Map<string, ChapterVersionInMemory>;
  settings: Settings;
} = globalForState.__appState ?? {
  docs: new Map(),
  translations: new Map(),
  projects: new Map(),
  theses: new Map(),
  chapterVersions: new Map(),
  settings: {
    openaiKey: process.env.OPENAI_API_KEY ?? "",
    googleKey: process.env.GOOGLE_API_KEY ?? "",
    xaiKey: process.env.XAI_API_KEY ?? "",
    models: {
      openai: ["gpt-4o-mini", "gpt-4o"],
      gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
      grok: ["grok-2-1212", "grok-2-vision-1212"]
    },
    pricesUSD: {
      // Preços aproximados por 1K tokens
      "gpt-4o-mini": { in: 0.00015, out: 0.0006 },
      "gpt-4o": { in: 0.005, out: 0.015 },
      "gemini-2.5-flash": { in: 0.000075, out: 0.0003 },
      "gemini-2.5-pro": { in: 0.00125, out: 0.005 },
      "gemini-2.0-flash": { in: 0.000075, out: 0.0003 },
      "gemini-flash-latest": { in: 0.000075, out: 0.0003 },
      "gemini-pro-latest": { in: 0.00125, out: 0.005 },
      "grok-2-1212": { in: 0.002, out: 0.01 },
      "grok-2-vision-1212": { in: 0.002, out: 0.01 }
    }
  }
};

// Guarda no globalThis para persistir entre hot reloads
if (process.env.NODE_ENV === 'development') {
  globalForState.__appState = state;
}

// Constrói índice BM25 para busca semântica
export function buildIndex(chunks: Chunk[]): elasticlunr.Index<any> {
  const index = elasticlunr<any>(function (this: any) {
    this.addField('text');
    this.setRef('ix');
  });

  chunks.forEach((chunk) => {
    index.addDoc({
      ix: chunk.ix,
      text: chunk.text,
      pageFrom: chunk.pageFrom,
      pageTo: chunk.pageTo
    });
  });

  return index;
}

// Busca top K chunks relevantes
export function searchIndex(
  index: elasticlunr.Index<any>,
  chunks: Chunk[],
  query: string,
  topK: number = 8
): Chunk[] {
  const results = index.search(query, {
    fields: {
      text: { boost: 1 }
    }
  });

  const topResults = results.slice(0, topK);
  const topChunks = topResults
    .map((r) => chunks.find((c) => c.ix === parseInt(r.ref)))
    .filter((c): c is Chunk => c !== undefined);

  return topChunks;
}
