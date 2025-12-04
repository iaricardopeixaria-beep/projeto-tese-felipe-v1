import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/theses/[id] - Get thesis with its chapters
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch the thesis
    const { data: thesis, error: thesisError } = await supabase
      .from('theses')
      .select('*')
      .eq('id', id)
      .single();

    if (thesisError || !thesis) {
      return NextResponse.json(
        { error: 'Thesis not found' },
        { status: 404 }
      );
    }

    // Fetch all chapters of the thesis with current version details
    const { data: chapters, error: chaptersError } = await supabase
      .from('chapter_details')
      .select('*')
      .eq('thesis_id', id)
      .order('chapter_order', { ascending: true });

    if (chaptersError) throw chaptersError;

    console.log(`[THESES] Fetched thesis: ${thesis.id} - "${thesis.title}" with ${chapters?.length || 0} chapters`);

    return NextResponse.json({
      thesis: {
        id: thesis.id,
        title: thesis.title,
        description: thesis.description,
        createdAt: thesis.created_at,
        updatedAt: thesis.updated_at,
        chapterCount: chapters?.length || 0
      },
      chapters: (chapters || []).map(ch => ({
        id: ch.chapter_id,
        thesisId: ch.thesis_id,
        title: ch.chapter_title,
        chapterOrder: ch.chapter_order,
        createdAt: ch.chapter_created_at,
        updatedAt: ch.chapter_updated_at,
        currentVersion: ch.current_version_id ? {
          id: ch.current_version_id,
          versionNumber: ch.version_number,
          filePath: ch.file_path,
          pages: ch.pages,
          chunksCount: ch.chunks_count,
          createdByOperation: ch.created_by_operation,
          metadata: ch.metadata,
          createdAt: ch.version_created_at
        } : null,
        totalVersions: ch.total_versions
      }))
    });
  } catch (error: any) {
    console.error('[THESES] Error getting thesis:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/theses/[id] - Update thesis metadata
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { title, description } = body;

    // Prepare fields to update
    const updates: any = {};
    if (title !== undefined && title.trim().length > 0) {
      updates.title = title.trim();
    }
    if (description !== undefined) {
      updates.description = description.trim() || null;
    }

    // Validate
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Update the thesis
    const { data: thesis, error } = await supabase
      .from('theses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !thesis) {
      return NextResponse.json(
        { error: error?.message || 'Thesis not found' },
        { status: error ? 500 : 404 }
      );
    }

    // Count chapters in the thesis
    const { count } = await supabase
      .from('chapters')
      .select('*', { count: 'exact', head: true })
      .eq('thesis_id', id);

    console.log(`[THESES] Updated thesis: ${thesis.id} - "${thesis.title}"`);

    return NextResponse.json({
      thesis: {
        id: thesis.id,
        title: thesis.title,
        description: thesis.description,
        createdAt: thesis.created_at,
        updatedAt: thesis.updated_at,
        chapterCount: count || 0
      }
    });
  } catch (error: any) {
    console.error('[THESES] Error updating thesis:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/theses/[id] - Delete thesis (CASCADE deletes chapters and versions)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify thesis exists
    const { data: thesis } = await supabase
      .from('theses')
      .select('id, title')
      .eq('id', id)
      .single();

    if (!thesis) {
      return NextResponse.json(
        { error: 'Thesis not found' },
        { status: 404 }
      );
    }

    // Delete the thesis (CASCADE will delete chapters, versions, and chunks)
    const { error } = await supabase
      .from('theses')
      .delete()
      .eq('id', id);

    if (error) throw error;

    console.log(`[THESES] Deleted thesis: ${thesis.id} - "${thesis.title}"`);

    // TODO: Delete files from Supabase Storage
    // This should be done in a cleanup job or trigger

    return NextResponse.json({
      message: 'Thesis deleted successfully',
      thesisId: id
    });
  } catch (error: any) {
    console.error('[THESES] Error deleting thesis:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
