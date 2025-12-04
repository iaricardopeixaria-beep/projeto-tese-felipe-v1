import { NextRequest, NextResponse } from 'next/server';
import { getOperationJob } from '@/lib/thesis/chapter-operations';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> }
) {
  try {
    const { jobId } = await params;

    const job = await getOperationJob(jobId);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      job: {
        id: job.id,
        chapterId: job.chapterId,
        versionId: job.versionId,
        operation: job.operation,
        status: job.status,
        progress: job.progress,
        error: job.error,
        newVersionId: job.newVersionId,
        createdAt: job.createdAt,
        completedAt: job.completedAt
      }
    });

  } catch (error: any) {
    console.error('[CHAPTER-OPERATIONS-API] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
