import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/theses - List all theses with chapter counts
 */
export async function GET() {
  try {
    // Fetch all theses
    const { data: theses, error } = await supabase
      .from('theses')
      .select('id, title, description, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // For each thesis, count how many chapters it has
    const thesesWithCounts = await Promise.all(
      (theses || []).map(async (thesis) => {
        const { count } = await supabase
          .from('chapters')
          .select('*', { count: 'exact', head: true })
          .eq('thesis_id', thesis.id);

        return {
          id: thesis.id,
          title: thesis.title,
          description: thesis.description,
          createdAt: thesis.created_at,
          updatedAt: thesis.updated_at,
          chapterCount: count || 0
        };
      })
    );

    return NextResponse.json({ theses: thesesWithCounts });
  } catch (error: any) {
    console.error('[THESES] Error listing theses:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/theses - Create new thesis
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description } = body;

    // Validation
    if (!title || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Thesis title is required' },
        { status: 400 }
      );
    }

    // Create thesis
    const { data: thesis, error } = await supabase
      .from('theses')
      .insert({
        title: title.trim(),
        description: description?.trim() || null
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`[THESES] Created thesis: ${thesis.id} - "${thesis.title}"`);

    return NextResponse.json({
      thesis: {
        id: thesis.id,
        title: thesis.title,
        description: thesis.description,
        createdAt: thesis.created_at,
        updatedAt: thesis.updated_at,
        chapterCount: 0
      }
    });
  } catch (error: any) {
    console.error('[THESES] Error creating thesis:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
