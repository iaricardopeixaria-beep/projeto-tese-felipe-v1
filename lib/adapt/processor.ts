/**
 * Adapt Operation Processor
 * Adapts documents to different styles and audiences
 */

import { AdaptationSuggestion } from './types';
import { extractDocumentStructure } from '@/lib/improvement/document-analyzer';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { randomUUID } from 'crypto';

/**
 * Analyze document and generate adaptations based on style and audience
 */
export async function analyzeDocumentForAdaptation(
  documentPath: string,
  style: 'academic' | 'professional' | 'simplified' | 'custom',
  targetAudience: string | undefined,
  provider: 'openai' | 'gemini' | 'grok',
  model: string,
  apiKey: string
): Promise<AdaptationSuggestion[]> {
  console.log('[ADAPT] Extracting document structure...');

  // Extract document structure
  const { structure, paragraphs } = await extractDocumentStructure(documentPath);

  console.log(`[ADAPT] Found ${paragraphs.length} paragraphs`);
  console.log(`[ADAPT] Style: ${style}, Target audience: ${targetAudience || 'general'}`);

  const allSuggestions: AdaptationSuggestion[] = [];

  // Process in batches
  const BATCH_SIZE = 15;

  for (let i = 0; i < structure.sections.length; i++) {
    const section = structure.sections[i];
    const sectionParagraphs = paragraphs
      .slice(section.startParagraphIndex, section.endParagraphIndex + 1)
      .filter(p => !p.isHeader)
      .map(p => ({ text: p.text, index: p.index }));

    console.log(`[ADAPT] Analyzing section ${i + 1}/${structure.sections.length}: "${section.title.substring(0, 50)}"`);

    // Process section in batches
    for (let batchStart = 0; batchStart < sectionParagraphs.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, sectionParagraphs.length);
      const batch = sectionParagraphs.slice(batchStart, batchEnd);

      const suggestions = await analyzeBatch(
        batch,
        section.title,
        style,
        targetAudience,
        provider,
        model,
        apiKey
      );

      allSuggestions.push(...suggestions);
    }
  }

  console.log(`[ADAPT] Generated ${allSuggestions.length} adaptation suggestions`);

  return allSuggestions;
}

/**
 * Analyze a batch of paragraphs for style adaptation
 */
async function analyzeBatch(
  paragraphs: Array<{ text: string; index: number }>,
  sectionTitle: string,
  style: 'academic' | 'professional' | 'simplified' | 'custom',
  targetAudience: string | undefined,
  provider: 'openai' | 'gemini' | 'grok',
  model: string,
  apiKey: string
): Promise<AdaptationSuggestion[]> {

  const prompt = buildPrompt(paragraphs, sectionTitle, style, targetAudience);

  let responseText: string;

  if (provider === 'openai' || provider === 'grok') {
    const client = new OpenAI({
      apiKey,
      baseURL: provider === 'grok' ? 'https://api.x.ai/v1' : undefined
    });

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3, // Lower temperature for style adaptation
      max_tokens: 12000, // Aumentado para permitir adaptações muito detalhadas
      response_format: { type: 'json_object' }
    });

    responseText = response.choices[0].message.content || '{}';

  } else {
    // Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model });

    const result = await geminiModel.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8192, // Aumentado para máximo do Gemini (permite adaptações muito detalhadas)
        responseMimeType: 'application/json'
      }
    });

    responseText = result.response.text();
  }

  // Parse response
  try {
    const data = JSON.parse(responseText);
    const suggestions: AdaptationSuggestion[] = (data.suggestions || []).map((s: any) => ({
      id: randomUUID(),
      originalText: s.originalText || '',
      adaptedText: s.adaptedText || '',
      reason: s.reason || '',
      sectionTitle,
      adaptationType: s.adaptationType || 'style'
    }));

    return suggestions;
  } catch (error) {
    console.error('[ADAPT] Failed to parse AI response:', error);
    return [];
  }
}

/**
 * Build prompt for style adaptation
 */
function buildPrompt(
  paragraphs: Array<{ text: string; index: number }>,
  sectionTitle: string,
  style: 'academic' | 'professional' | 'simplified' | 'custom',
  targetAudience: string | undefined
): string {
  const styleDescriptions = {
    academic: 'formal academic style with precise terminology, citations, and scholarly tone',
    professional: 'professional business style with clear, concise language suitable for corporate environments',
    simplified: 'simplified language accessible to general audiences, avoiding jargon and complex terms',
    custom: targetAudience || 'general audience'
  };

  const styleDescription = styleDescriptions[style];
  const audienceText = targetAudience ? ` for ${targetAudience}` : '';

  return `You are a document adaptation expert. Analyze the following text from section "${sectionTitle}" and suggest adaptations to ${styleDescription}${audienceText}.

For each paragraph that needs adaptation, provide:
- originalText: the exact original text (unchanged)
- adaptedText: the adapted version in the target style
- reason: brief explanation of the adaptation (why this change improves style/audience fit)
- adaptationType: one of: "style", "tone", "terminology", "structure"

Focus on paragraphs that would significantly benefit from adaptation. Skip paragraphs that are already appropriate for the target style.

Paragraphs to analyze:
${paragraphs.map((p, i) => `[${i + 1}] ${p.text}`).join('\n\n')}

Respond with ONLY a JSON object in this format:
{
  "suggestions": [
    {
      "originalText": "...",
      "adaptedText": "...",
      "reason": "...",
      "adaptationType": "..."
    }
  ]
}`;
}
