/**
 * Adjust Operation Processor
 * Applies custom user instructions to documents
 */

import { AdjustSuggestion } from './types';
import { extractDocumentStructure } from '@/lib/improvement/document-analyzer';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Analyze document and generate adjustments based on instructions
 */
export async function analyzeDocumentForAdjustments(
  documentPath: string,
  instructions: string,
  creativity: number,
  provider: 'openai' | 'gemini' | 'grok',
  model: string,
  apiKey: string,
  useGrounding: boolean = false
): Promise<AdjustSuggestion[]> {
  console.log('[ADJUST] Extracting document structure...');

  // Extract document structure
  const { structure, paragraphs } = await extractDocumentStructure(documentPath);

  console.log(`[ADJUST] Found ${paragraphs.length} paragraphs`);
  console.log(`[ADJUST] Instructions: ${instructions.substring(0, 100)}...`);

  const allSuggestions: AdjustSuggestion[] = [];

  // Process in batches
  const BATCH_SIZE = 20;

  for (let i = 0; i < structure.sections.length; i++) {
    const section = structure.sections[i];
    const sectionParagraphs = paragraphs
      .slice(section.startParagraphIndex, section.endParagraphIndex + 1)
      .filter(p => !p.isHeader)
      .map(p => ({ text: p.text, index: p.index }));

    console.log(`[ADJUST] Analyzing section ${i + 1}/${structure.sections.length}: "${section.title.substring(0, 50)}"`);

    // Process section in batches
    for (let batchStart = 0; batchStart < sectionParagraphs.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, sectionParagraphs.length);
      const batch = sectionParagraphs.slice(batchStart, batchEnd);

      const suggestions = await analyzeBatch(
        batch,
        section.title,
        instructions,
        creativity,
        provider,
        model,
        apiKey,
        useGrounding
      );

      allSuggestions.push(...suggestions);
    }
  }

  console.log(`[ADJUST] Generated ${allSuggestions.length} adjustment suggestions`);

  return allSuggestions;
}

/**
 * Analyze a batch of paragraphs
 */
async function analyzeBatch(
  paragraphs: Array<{ text: string; index: number }>,
  sectionTitle: string,
  instructions: string,
  creativity: number,
  provider: 'openai' | 'gemini' | 'grok',
  model: string,
  apiKey: string,
  useGrounding: boolean = false
): Promise<AdjustSuggestion[]> {

  const prompt = buildPrompt(paragraphs, sectionTitle, instructions, creativity);

  let responseText: string;

  if (provider === 'openai' || provider === 'grok') {
    const client = new OpenAI({
      apiKey,
      baseURL: provider === 'grok' ? 'https://api.x.ai/v1' : undefined
    });

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: creativity / 10, // Convert 0-10 to 0-1
      response_format: { type: 'json_object' }
    });

    responseText = response.choices[0].message.content || '{}';

  } else {
    // Gemini
    const genAI = new GoogleGenerativeAI(apiKey);

    // Configure grounding if enabled
    const modelConfig: any = {
      model,
      generationConfig: {
        temperature: creativity / 10
      }
    };

    // Add Google Search Grounding if enabled
    if (useGrounding) {
      console.log('[ADJUST] Using Google Search Grounding');
      modelConfig.tools = [{
        googleSearch: {}
      }];
    } else {
      // Only set responseMimeType when NOT using tools
      // Tool use with responseMimeType is unsupported
      modelConfig.generationConfig.responseMimeType = 'application/json';
    }

    const geminiModel = genAI.getGenerativeModel(modelConfig);

    const result = await geminiModel.generateContent(prompt);
    responseText = result.response.text();
  }

  // Parse response
  try {
    // Strip markdown code blocks if present (happens with grounding)
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(jsonText);
    const suggestions: AdjustSuggestion[] = (parsed.adjustments || []).map((adj: any) => ({
      id: `adj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      paragraphIndex: adj.paragraphIndex || 0,
      sectionTitle,
      originalText: adj.originalText || '',
      adjustedText: adj.adjustedText || '',
      reason: adj.reason || '',
      instructionReference: adj.instructionReference || ''
    }));

    return suggestions;

  } catch (error) {
    console.error('[ADJUST] Failed to parse response:', error);
    console.error('[ADJUST] Response text:', responseText.substring(0, 500));
    return [];
  }
}

/**
 * Build prompt for AI
 */
function buildPrompt(
  paragraphs: Array<{ text: string; index: number }>,
  sectionTitle: string,
  instructions: string,
  creativity: number
): string {
  const paragraphsText = paragraphs
    .map((p, idx) => `[${idx}] ${p.text}`)
    .join('\n\n');

  return `You are an expert document editor. You have been given the following instructions by the user:

INSTRUCTIONS:
${instructions}

SECTION: "${sectionTitle}"

PARAGRAPHS:
${paragraphsText}

TASK:
Analyze the paragraphs and suggest adjustments that follow the user's instructions EXACTLY AND ONLY. Do NOT suggest improvements, clarifications, or changes that are not explicitly requested in the instructions above.

Creativity level: ${creativity}/10
${creativity < 3
  ? '(Conservative - apply instructions with minimal changes, stay as close as possible to the original text)'
  : creativity < 7
  ? '(Moderate - apply instructions with some flexibility in rephrasing, but ONLY make changes related to the instructions)'
  : '(Creative - apply instructions with freedom to rephrase significantly, but ONLY make changes that fulfill the instructions)'}

Return your response as JSON in this exact format:
{
  "adjustments": [
    {
      "paragraphIndex": 0,
      "originalText": "exact original text",
      "adjustedText": "your adjusted version that addresses the instructions",
      "reason": "why this change was made to fulfill the instructions",
      "instructionReference": "which part of the instructions this addresses"
    }
  ]
}

CRITICAL RULES:
- ONLY make changes that directly address the user's instructions
- Do NOT improve clarity, grammar, style, or anything else unless explicitly instructed to do so
- Only include paragraphs that need adjustment to fulfill the instructions
- Match the originalText EXACTLY as it appears
- The creativity level controls HOW you apply the instructions, NOT whether to make additional improvements
- If creativity is 0, make minimal changes (only those absolutely required by instructions)
`;
}
