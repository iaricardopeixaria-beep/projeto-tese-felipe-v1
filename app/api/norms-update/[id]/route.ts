import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/norms-update/[id] - Busca status do job
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

    const { data: job, error } = await supabase
      .from('norm_update_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Job de capítulo: document_id é o versionId; detectamos consultando chapter_versions
    let source: 'document' | 'chapter' = 'document';
    let chapterId: string | null = null;
    let versionId: string | null = null;
    if (job.document_id) {
      const { data: cv } = await supabase
        .from('chapter_versions')
        .select('chapter_id, id')
        .eq('id', job.document_id)
        .single();
      if (cv) {
        source = 'chapter';
        chapterId = cv.chapter_id;
        versionId = cv.id;
      }
    }

    // Formata resposta
    return NextResponse.json({
      jobId: job.id,
      documentId: job.document_id,
      source,
      ...(source === 'chapter' && chapterId && versionId ? { chapterId, versionId } : {}),
      status: job.status,
      progress: {
        currentReference: job.current_reference,
        totalReferences: job.total_references,
        percentage: job.progress_percentage
      },
      references: job.norm_references || [],
      stats: {
        total: job.total_references,
        vigentes: job.vigentes,
        alteradas: job.alteradas,
        revogadas: job.revogadas,
        substituidas: job.substituidas,
        manualReview: job.manual_review
      },
      error: job.error_message,
      createdAt: job.created_at,
      startedAt: job.started_at,
      completedAt: job.completed_at
    });

  } catch (error: any) {
    console.error('[NORMS] Error fetching job:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
