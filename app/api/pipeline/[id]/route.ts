import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { PipelineStatusResponse } from '@/lib/pipeline/types';

/**
 * GET /api/pipeline/[id]
 * Get pipeline status and progress
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

    // Load pipeline job
    const { data: job, error: jobError } = await supabase
      .from('pipeline_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Pipeline job not found' },
        { status: 404 }
      );
    }

    // Load intermediate documents
    const { data: intermediateDocuments, error: docsError } = await supabase
      .from('pipeline_intermediate_documents')
      .select('*')
      .eq('pipeline_job_id', jobId)
      .order('operation_index', { ascending: true });

    if (docsError) {
      console.error('[PIPELINE] Error loading intermediate documents:', docsError);
    }

    // Build response
    const response: PipelineStatusResponse = {
      job,
      intermediateDocuments: intermediateDocuments || [],
      currentOperationProgress: undefined // TODO: Add real-time progress from sub-operations
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('[PIPELINE] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pipeline/[id]
 * Cancel a running pipeline
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

    // Update status to cancelled
    const { error } = await supabase
      .from('pipeline_jobs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .in('status', ['pending', 'running', 'paused']);

    if (error) {
      console.error('[PIPELINE] Error cancelling job:', error);
      return NextResponse.json(
        { error: 'Failed to cancel pipeline' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Pipeline cancelled successfully' });

  } catch (error: any) {
    console.error('[PIPELINE] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/pipeline/[id]
 * Update pipeline (pause/resume)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;
    const { action }: { action: 'pause' | 'resume' } = await req.json();

    if (!action || !['pause', 'resume'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "pause" or "resume"' },
        { status: 400 }
      );
    }

    const newStatus = action === 'pause' ? 'paused' : 'running';

    const { error } = await supabase
      .from('pipeline_jobs')
      .update({ status: newStatus })
      .eq('id', jobId);

    if (error) {
      console.error('[PIPELINE] Error updating job:', error);
      return NextResponse.json(
        { error: `Failed to ${action} pipeline` },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: `Pipeline ${action}d successfully` });

  } catch (error: any) {
    console.error('[PIPELINE] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
