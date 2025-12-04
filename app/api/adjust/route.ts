import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { analyzeDocumentForAdjustments } from '@/lib/adjust/processor';

/**
 * POST /api/adjust
 * Start adjust operation (can be standalone or part of pipeline)
 */
export async function POST(req: NextRequest) {
  try {
    const {
      documentId,
      sourceDocumentPath, // Optional: for pipeline usage
      instructions,
      creativity = 5,
      provider = 'openai',
      model = 'gpt-4o-mini'
    }: {
      documentId?: string;
      sourceDocumentPath?: string;
      instructions: string;
      creativity?: number;
      provider?: 'openai' | 'gemini' | 'grok';
      model?: string;
    } = await req.json();

    if (!instructions) {
      return NextResponse.json(
        { error: 'Instructions are required' },
        { status: 400 }
      );
    }

    if (!documentId && !sourceDocumentPath) {
      return NextResponse.json(
        { error: 'Either documentId or sourceDocumentPath is required' },
        { status: 400 }
      );
    }

    // Get document path
    let docPath: string;
    let docId: string;

    if (sourceDocumentPath) {
      // Pipeline mode - use provided path
      docPath = sourceDocumentPath;
      docId = documentId || 'pipeline';
    } else {
      // Standalone mode - download from Storage
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (docError || !doc) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        );
      }

      // Download document
      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from('documents')
        .download(doc.file_path);

      if (downloadError || !fileBlob) {
        throw new Error(`Failed to download: ${downloadError?.message}`);
      }

      const tempDir = os.tmpdir();
      docPath = path.join(tempDir, `adjust_${documentId}.docx`);
      const buffer = Buffer.from(await fileBlob.arrayBuffer());
      await fs.writeFile(docPath, buffer);
      docId = documentId!;
    }

    // Create job ID
    const jobId = randomUUID();

    console.log(`[ADJUST] Starting job ${jobId} for document ${docId}`);

    // Execute in background
    executeAdjust(
      jobId,
      docId,
      docPath,
      instructions,
      creativity,
      provider,
      model
    ).catch(err => {
      console.error('[ADJUST] Background error:', err);
    });

    return NextResponse.json({
      jobId,
      message: 'Adjust operation started'
    });

  } catch (error: any) {
    console.error('[ADJUST] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Execute adjust operation in background
 */
async function executeAdjust(
  jobId: string,
  documentId: string,
  documentPath: string,
  instructions: string,
  creativity: number,
  provider: 'openai' | 'gemini' | 'grok',
  model: string
) {
  try {
    console.log(`[ADJUST ${jobId}] Analyzing document with instructions...`);

    const apiKey = provider === 'openai'
      ? process.env.OPENAI_API_KEY!
      : provider === 'gemini'
      ? (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)!
      : process.env.GROK_API_KEY!;

    const suggestions = await analyzeDocumentForAdjustments(
      documentPath,
      instructions,
      creativity,
      provider,
      model,
      apiKey
    );

    console.log(`[ADJUST ${jobId}] Found ${suggestions.length} adjustments`);

    // TODO: Save results to database (create adjust_jobs table if needed)
    // For now, just log success

    // Clean up temp file if not from pipeline
    if (!documentPath.includes('pipeline_')) {
      try {
        await fs.unlink(documentPath);
      } catch {}
    }

    console.log(`[ADJUST ${jobId}] Completed successfully`);

  } catch (error: any) {
    console.error(`[ADJUST ${jobId}] Error:`, error);
  }
}
