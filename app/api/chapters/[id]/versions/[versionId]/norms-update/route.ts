import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { extractDocumentStructure } from '@/lib/improvement/document-analyzer';
import { detectNormsInDocument } from '@/lib/norms-update/norm-detector';
import { verifyMultipleNorms } from '@/lib/norms-update/norm-verifier';
import { NormReference } from '@/lib/norms-update/types';

/**
 * POST /api/chapters/[chapterId]/versions/[versionId]/norms-update
 * Inicia análise de normas para um capítulo. document_id no job usa o versionId (UUID)
 * para compatibilidade com a coluna UUID; o apply detecta capítulo via chapter_versions.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id: chapterId, versionId } = await params;
    const body = await req.json().catch(() => ({}));
    const provider = body.provider ?? 'gemini';
    const model = body.model ?? 'gemini-2.5-flash';

    const { data: version, error: versionError } = await supabase
      .from('chapter_versions')
      .select('id, file_path, chapter_id')
      .eq('id', versionId)
      .eq('chapter_id', chapterId)
      .single();

    if (versionError || !version) {
      return NextResponse.json(
        { error: 'Versão do capítulo não encontrada' },
        { status: 404 }
      );
    }

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('documents')
      .download(version.file_path);

    if (downloadError || !fileBlob) {
      return NextResponse.json(
        { error: 'Falha ao baixar arquivo do capítulo' },
        { status: 500 }
      );
    }

    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `chapter_${chapterId}_${versionId}_norms.docx`);
    await fs.writeFile(tempFilePath, Buffer.from(await fileBlob.arrayBuffer()));

    const jobId = randomUUID();
    // document_id é UUID: usamos versionId; o apply detecta capítulo consultando chapter_versions
    const { error: insertError } = await supabase
      .from('norm_update_jobs')
      .insert({
        id: jobId,
        document_id: versionId,
        status: 'pending',
        norm_references: [],
        total_references: 0,
        vigentes: 0,
        alteradas: 0,
        revogadas: 0,
        substituidas: 0,
        manual_review: 0,
        current_reference: 0,
        progress_percentage: 0,
        created_at: new Date().toISOString()
      });

    if (insertError) {
      await fs.unlink(tempFilePath).catch(() => {});
      console.error('[NORMS] Error creating chapter norms job:', insertError);
      return NextResponse.json(
        { error: 'Falha ao criar job de normas' },
        { status: 500 }
      );
    }

    processNormsUpdate(jobId, tempFilePath, provider, model).catch(err => {
      console.error('[NORMS] Chapter norms background error:', err);
    });

    return NextResponse.json({ jobId });
  } catch (error: any) {
    console.error('[NORMS] Chapter norms-update error:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao iniciar análise de normas' },
      { status: 500 }
    );
  }
}

async function getCurrentChapter(paragraphs: any[], paragraphIndex: number, structure: any): Promise<string | undefined> {
  const section = structure?.sections?.find(
    (s: any) =>
      paragraphIndex >= s.startParagraphIndex &&
      paragraphIndex <= s.endParagraphIndex &&
      s.level === 1
  );
  return section?.title;
}

async function processNormsUpdate(
  jobId: string,
  tempFilePath: string,
  provider: 'openai' | 'gemini',
  model: string
) {
  const apiKey =
    provider === 'openai'
      ? process.env.OPENAI_API_KEY!
      : (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)!;

  try {
    await supabase
      .from('norm_update_jobs')
      .update({ status: 'analyzing', started_at: new Date().toISOString() })
      .eq('id', jobId);

    const { structure, paragraphs } = await extractDocumentStructure(tempFilePath);
    const paragraphsWithContext = paragraphs
      .filter((p: any) => !p.isHeader)
      .map((p: any, idx: number) => ({
        text: p.text,
        index: p.index,
        chapterTitle: getCurrentChapter(paragraphs, p.index, structure)
      }));

    const references = await detectNormsInDocument(
      paragraphsWithContext,
      provider,
      model,
      apiKey
    );

    await supabase
      .from('norm_update_jobs')
      .update({ total_references: references.length, progress_percentage: 10 })
      .eq('id', jobId);

    if (references.length === 0) {
      await supabase
        .from('norm_update_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          progress_percentage: 100
        })
        .eq('id', jobId);
      await fs.unlink(tempFilePath).catch(() => {});
      return;
    }

    const verifiedReferences = await verifyMultipleNorms(
      references,
      provider,
      model,
      apiKey,
      undefined,
      async (current: number, total: number) => {
        const percentage = 10 + Math.floor((current / total) * 90);
        await supabase
          .from('norm_update_jobs')
          .update({ current_reference: current, progress_percentage: percentage })
          .eq('id', jobId);
      }
    );

    const stats = {
      vigentes: verifiedReferences.filter((r: NormReference) => r.status === 'vigente').length,
      alteradas: verifiedReferences.filter((r: NormReference) => r.status === 'alterada').length,
      revogadas: verifiedReferences.filter((r: NormReference) => r.status === 'revogada').length,
      substituidas: verifiedReferences.filter((r: NormReference) => r.status === 'substituida').length,
      manual_review: verifiedReferences.filter((r: NormReference) => r.updateType === 'manual').length
    };

    await supabase
      .from('norm_update_jobs')
      .update({
        status: 'completed',
        norm_references: verifiedReferences,
        vigentes: stats.vigentes,
        alteradas: stats.alteradas,
        revogadas: stats.revogadas,
        substituidas: stats.substituidas,
        manual_review: stats.manual_review,
        progress_percentage: 100,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    await fs.unlink(tempFilePath).catch(() => {});
  } catch (error: any) {
    console.error('[NORMS] Chapter norms processing error:', error);
    await supabase
      .from('norm_update_jobs')
      .update({
        status: 'error',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
}

