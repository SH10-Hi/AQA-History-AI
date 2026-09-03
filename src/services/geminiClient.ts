// WARNING: Client-side API key usage.
// The user enters their own free Google Gemini API key in the UI, which is stored in browser LocalStorage.
// Direct browser fetches target Google's official REST endpoint: https://generativelanguage.googleapis.com
// for static hosting compatibility (Vercel, Netlify, GitHub Pages) without any local/relative /api/ backend routes.
// Non-JSON responses (e.g. 404/502 HTML pages) are safely handled to prevent UI crashes.

import { MarkingResult, QuestionType } from '../types';

// Active, reliable Gemini model endpoints (prioritizing stable high-throughput flash models)
export const DEFAULT_MODEL = 'gemini-2.0-flash';

export const CANDIDATE_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

export interface CallGeminiParams {
  contents: any[];
  systemInstruction?: string;
  responseMimeType?: string;
  temperature?: number;
  onStatusUpdate?: (status: string) => void;
}

/**
 * Categorizes and formats errors into differentiated, user-facing notifications:
 * - 503 / 429: "The server is temporarily busy. Automatically retrying..."
 * - 404 / Invalid Model: "Model endpoint not found. Please verify API model configuration."
 * - Invalid Key / Quota: "API key invalid or quota exceeded."
 */
export function formatGeminiErrorMessage(error: any): string {
  if (!error) return 'The server is temporarily busy. Automatically retrying...';
  const rawMsg = typeof error === 'string' ? error : error?.message || String(error);
  const lower = rawMsg.toLowerCase();

  // 1. Invalid Key / Quota Exceeded
  if (
    lower.includes('api key invalid or quota exceeded') ||
    lower.includes('api_key_invalid') ||
    lower.includes('invalid api key') ||
    lower.includes('key not valid') ||
    lower.includes('key not found') ||
    lower.includes('quota exceeded') ||
    (lower.includes('quota') && lower.includes('exceeded')) ||
    (lower.includes('api key') && (lower.includes('enter') || lower.includes('invalid') || lower.includes('expired')))
  ) {
    return 'API key invalid or quota exceeded.';
  }

  // 2. 404 / Invalid Model Endpoint
  if (
    lower.includes('model endpoint not found') ||
    lower.includes('verify api model configuration') ||
    lower.includes('invalid model') ||
    lower.includes('models/') ||
    lower.includes('404') ||
    (lower.includes('model') && lower.includes('not found'))
  ) {
    return 'Model endpoint not found. Please verify API model configuration.';
  }

  // 3. 503 / 429 / Server Busy (Transient or Exhausted)
  if (
    lower.includes('503') ||
    lower.includes('429') ||
    lower.includes('temporarily busy') ||
    lower.includes('momentarily busy') ||
    lower.includes('resource_exhausted') ||
    lower.includes('service unavailable') ||
    lower.includes('rate limit') ||
    lower.includes('overloaded') ||
    lower.includes('high demand')
  ) {
    return 'The server is temporarily busy. Automatically retrying...';
  }

  return rawMsg;
}

/**
 * Internal classification helper for HTTP status and error text
 */
function classifyResponseError(status: number, message: string): {
  type: 'invalid_key' | 'invalid_model' | 'busy' | 'other';
  userMessage: string;
} {
  const lower = (message || '').toLowerCase();

  // Invalid Key or Quota
  if (
    status === 401 ||
    status === 403 ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('invalid api key') ||
    lower.includes('key not found') ||
    lower.includes('quota exceeded') ||
    (status === 400 && lower.includes('api key'))
  ) {
    return {
      type: 'invalid_key',
      userMessage: 'API key invalid or quota exceeded.',
    };
  }

  // 404 / Invalid Model
  if (
    status === 404 ||
    lower.includes('not found') ||
    lower.includes('models/') ||
    lower.includes('is not found') ||
    lower.includes('invalid model')
  ) {
    return {
      type: 'invalid_model',
      userMessage: 'Model endpoint not found. Please verify API model configuration.',
    };
  }

  // 503 / 429 / Server Busy
  if (
    status === 503 ||
    status === 429 ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('service unavailable') ||
    lower.includes('temporarily busy') ||
    lower.includes('momentarily busy')
  ) {
    return {
      type: 'busy',
      userMessage: 'The server is temporarily busy. Automatically retrying...',
    };
  }

  return {
    type: 'other',
    userMessage: message || `HTTP ${status}`,
  };
}

/**
 * Safely parse an HTTP response, gracefully handling non-JSON responses (HTML error pages, plain text)
 * to avoid syntax errors like "Unexpected token 'T', 'The page c'... is not valid JSON".
 */
export async function safeParseResponse(
  response: Response
): Promise<{ ok: boolean; data: any; errorText?: string; status: number }> {
  let rawText = '';
  try {
    rawText = await response.text();
  } catch (err: any) {
    return {
      ok: false,
      data: null,
      status: response.status,
      errorText: `Failed to read network response: ${err?.message || 'Connection interrupted'}`,
    };
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    // Gracefully handle HTML or plain-text response
    const cleanSnippet = rawText
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160);

    const friendlySnippet = cleanSnippet || response.statusText || 'Unknown server response';
    return {
      ok: false,
      data: null,
      status: response.status,
      errorText: `Server returned non-JSON response (HTTP ${response.status}): ${friendlySnippet}`,
    };
  }

  if (!response.ok) {
    const errorMsg =
      parsed?.error?.message || parsed?.error || parsed?.message || `HTTP ${response.status}`;
    return {
      ok: false,
      data: parsed,
      status: response.status,
      errorText: errorMsg,
    };
  }

  return {
    ok: true,
    data: parsed,
    status: response.status,
  };
}

/**
 * Clean potential markdown formatting fences (```json ... ```) from model output.
 */
function extractJsonString(rawText: string): string {
  let text = rawText.trim();
  if (text.startsWith('```json')) {
    text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return text.trim();
}

/**
 * Executes a direct browser fetch to Google Gemini API with:
 * 1. Exponential Backoff & Retry Logic:
 *    - Catches 503 (Service Unavailable) and 429 (Too Many Requests / Resource Exhausted)
 *    - Automatically retries up to 3 times with increasing delays (2s, 4s, 8s)
 * 2. Active Model Fallback:
 *    - Uses active, reliable endpoints ("gemini-2.0-flash", "gemini-1.5-flash")
 * 3. Graceful Differentiated Error Handling:
 *    - 503 / 429: "The server is temporarily busy. Automatically retrying..."
 *    - 404 / Invalid Model: "Model endpoint not found. Please verify API model configuration."
 *    - Invalid Key: "API key invalid or quota exceeded."
 */
export async function callGeminiRest(
  apiKey?: string,
  params: CallGeminiParams = { contents: [] },
  preferredModel: string = DEFAULT_MODEL
): Promise<string> {
  // Retrieve custom API key passed in or directly from browser LocalStorage
  let cleanKey = (apiKey || '').trim();
  if (!cleanKey && typeof window !== 'undefined' && window.localStorage) {
    cleanKey = (window.localStorage.getItem('gemini_api_key') || '').trim();
  }

  if (!cleanKey) {
    throw new Error('API key invalid or quota exceeded.');
  }

  const modelsToTry = [
    preferredModel,
    ...CANDIDATE_MODELS.filter((m) => m !== preferredModel),
  ];

  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [2000, 4000, 8000]; // 2s, 4s, 8s exponential backoff

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const requestBody: Record<string, any> = {
          contents: params.contents,
        };

        if (params.systemInstruction) {
          requestBody.systemInstruction = {
            parts: [{ text: params.systemInstruction }],
          };
        }

        const generationConfig: Record<string, any> = {
          temperature: params.temperature ?? 0.2,
        };

        if (params.responseMimeType) {
          generationConfig.responseMimeType = params.responseMimeType;
        }

        requestBody.generationConfig = generationConfig;

        // Direct browser fetch targeting Google Generative AI REST endpoint
        // Pass the API key ONLY via query parameter; omit custom headers like 'x-goog-api-key'
        // to prevent browser CORS preflight (OPTIONS) check failures.
        const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;

        let response: Response;
        try {
          response = await fetch(endpointUrl, {
            method: 'POST',
            mode: 'cors',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });
        } catch (fetchErr: any) {
          throw fetchErr;
        }

        const parsedResult = await safeParseResponse(response);

        if (!parsedResult.ok) {
          const rawErrMsg = parsedResult.errorText || `HTTP ${response.status}`;
          const classification = classifyResponseError(response.status, rawErrMsg);

          // 1. Invalid API Key: immediately fail without retrying
          if (classification.type === 'invalid_key') {
            throw new Error(classification.userMessage);
          }

          // 2. 404 / Invalid Model: skip retries on this model and try next model fallback
          if (classification.type === 'invalid_model') {
            lastError = new Error(classification.userMessage);
            break; // breaks inner attempt loop, moves to next model in modelsToTry
          }

          // 3. 503 / 429 / Server Busy: Exponential backoff & retry up to 3 times
          if (classification.type === 'busy') {
            if (attempt < MAX_RETRIES) {
              const delay = RETRY_DELAYS[attempt] || 2000 * Math.pow(2, attempt);
              if (params.onStatusUpdate) {
                params.onStatusUpdate('The server is temporarily busy. Automatically retrying...');
              }
              await new Promise((resolve) => setTimeout(resolve, delay));
              continue; // retry attempt
            }

            // Exhausted all 3 retries on this model
            lastError = new Error(classification.userMessage);
            break;
          }

          throw new Error(rawErrMsg);
        }

        const candidates = parsedResult.data?.candidates;
        if (!candidates || candidates.length === 0) {
          const blockReason = parsedResult.data?.promptFeedback?.blockReason;
          if (blockReason) {
            throw new Error(`Content generation blocked by Gemini safety filters (${blockReason}).`);
          }
          throw new Error('Gemini API returned an empty candidate list.');
        }

        const parts = candidates[0]?.content?.parts || [];
        const text = parts.map((p: any) => p.text || '').join('');
        if (!text) {
          throw new Error('Gemini API returned an empty text response.');
        }

        return text;
      } catch (err: any) {
        lastError = err;
        const msg = (err?.message || '').toLowerCase();
        // If it is explicitly an invalid key error, do not retry further models
        if (msg.includes('api key invalid') || msg.includes('user settings panel')) {
          throw err;
        }
      }
    }
  }

  throw lastError || new Error('The server is temporarily busy. Automatically retrying...');
}

/**
 * Transcribe student handwriting directly from client-side browser fetch
 */
export async function transcribeHandwritingDirect(
  apiKey?: string,
  params?: { imageBase64: string; mimeType: string; onStatusUpdate?: (status: string) => void }
): Promise<string> {
  const p = params || { imageBase64: '', mimeType: 'image/png' };
  const prompt = `You are an expert AQA A-Level History examiner and transcription specialist.
Transcribe the handwritten or typed essay from this student notebook page image with high fidelity.
- Preserve the exact student wording, paragraph breaks, and headings.
- Maintain any annotations or corrections the student wrote.
- If teacher red pen marks or grades are visible, note them in a bracketed annotation like [Teacher Note: ...].
- Output ONLY the transcribed essay text clearly and cleanly formatted.`;

  const cleanBase64 = p.imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

  const contents = [
    {
      parts: [
        {
          inlineData: {
            mimeType: p.mimeType || 'image/png',
            data: cleanBase64,
          },
        },
        {
          text: prompt,
        },
      ],
    },
  ];

  return await callGeminiRest(apiKey, {
    contents,
    temperature: 0.1,
    onStatusUpdate: p.onStatusUpdate,
  });
}

/**
 * Direct client-side essay marking via Google Gemini API
 */
export async function markEssayDirect(
  apiKey?: string,
  params?: {
    essayText: string;
    questionType: QuestionType;
    questionTitle?: string;
    extractsText?: string;
    imageBase64List?: Array<{ data: string; mimeType: string }>;
    onStatusUpdate?: (status: string) => void;
  }
): Promise<MarkingResult> {
  const p = params || { essayText: '', questionType: 'essay_25' };
  const isSourceQuestion = p.questionType === 'source_30';
  const maxMarks = isSourceQuestion ? 30 : 25;

  const systemInstruction = `You are a Senior Principal Examiner for AQA A-Level History (7042).
Your role is to mark student essays with rigorous accuracy according to official AQA mark schemes and real teacher grading standards.

### OFFICIAL AQA MARK SCHEMES:

#### 1. FOR 25-MARK ESSAY QUESTIONS (Section B):
- Level 5 (21–25 marks) [Grade A/A*]:
  Answers will display a very good understanding of the full demands of the question. Well-organised and effectively delivered. Supporting information will be well-selected, specific and precise. Shows very good understanding of key features, issues and concepts. Fully analytical with a balanced argument and well-substantiated judgement.
  *Benchmark standard (24/25, Grade A*):* Stalin's economic policies essay. Weighed human sacrifice (Holodomor, 1.8M Kulaks, Belomor Canal 20k casualties) vs structural modernization (Moscow Metro 1935, Western engineers, urban education). Sustained judgement throughout.
- Level 4 (16–20 marks) [Grade B]:
  Answers will display a good understanding of the demands of the question. Well-organised and effectively communicated. Range of clear and specific supporting information showing good understanding of key features/issues with some conceptual awareness. Analytical in style with direct comment. Well-balanced with some judgement, which may, however, be only partially substantiated.
  *Benchmark standard (18/25, Grade B):* Henry VII financial measures essay. Strong financial knowledge (attainders, bonds 36/62 families, £5000 French pension), but recycled identical diplomacy examples (Treaty of Etaples/Ayton) across factors instead of a fresh distinct factor, leaving judgement partially substantiated.
- Level 3 (11–15 marks) [Grade C]:
  Answers will show an understanding of the question and supply a range of largely accurate information, but may lack precision of detail or be unspecific. Effectively organised, adequate communication skills. Good deal of comment with some balance, but statements may be inadequately supported and generalist.
  *Benchmark standard (15/25, Grade C):* February 1917 army essay. High factual recall (66,000 soldiers, 40,000 rifles, 750,000 strikers, Order No. 1, 4000 to 2000 kcal bread rations, 1.5M desertions), but drifted into narrative storytelling without explicit, consistent links back to the Question and Judgement (Q/J). Needs rigorous PEEL discipline.
- Level 2 (6–10 marks) [Grade D/E]:
  Descriptive or partial, failure to grasp full demands. Attempt to convey material in organised way, limited communication skills. Very limited in scope or generalist/unsupported statements.
- Level 1 (1–5 marks) [Grade U]:
  Question not properly understood, limited organizational skills, irrelevant or extremely vague.

#### 2. FOR 30-MARK SOURCE EXTRACT QUESTIONS:
- Level 5 (25–30 marks) [Grade A/A*]:
  Shows very good understanding of the interpretations put forward in ALL THREE EXTRACTS and combines this with strong awareness of historical context to analyse and evaluate interpretations. Well-supported, convincing evaluation.
  *Benchmark standard (25/30, Grade A*):* Henry VIII 3 extracts. Comprehensive analysis of arguments, provenance, tone, and deep own knowledge (Collectanea Satis Copiosa, Act of Supremacy 1534, Thomas More 1535, Pilgrimage of Grace 30,000, Christopher St German, Act of Annates 1532, Cranmer 1532, 6 Articles 1539). Candidates DO NOT need an overall conclusion if extracts are thoroughly evaluated individually.
- Level 4 (19–24 marks) [Grade A/B]:
  Good understanding of interpretations in all 3 extracts, combines with historical context to analyse and evaluate. Mostly well-supported and convincing, minor limitations of depth/breadth.
- Level 3 (13–18 marks) [Grade B/C - e.g. 18/30 = Grade B]:
  Supported comment on interpretations in all 3 extracts, comments on strength in relation to context. Some analysis and evaluation, but imbalance in depth.
  *Benchmark standard (18/30, Grade B):* Lenin NEP 3 sources. Rich own knowledge (War Communism, 25k NEPmen, scissor crisis, Kronstadt, Tambov, Victor Serge), but lost focus on the specific question (the *impact* of NEP) or confused reliability with historical value.
- Level 2 (7–12 marks) [Grade D/E]:
  Accurate comment on at least two extracts, little if any evaluation, generalisation or inaccuracy.
- Level 1 (1–6 marks) [Grade U]:
  Accurate understanding of one extract only or addresses extracts in a generalist way, limited context.

### YOUR TASK:
Grade the student submission strictly using these exact standards.
Return a valid JSON object matching the requested schema.`;

  const userPrompt = `Student Question Title: "${p.questionTitle || (isSourceQuestion ? 'AQA 30-Mark Source Extract Question' : 'AQA 25-Mark Essay Question')}"
Question Type: ${isSourceQuestion ? '30-Mark Source Extract Question' : '25-Mark Section B Essay'}
${p.extractsText ? `Extracts Provided for Analysis:\n${p.extractsText}\n\n` : ''}
Student Essay Text:
"""
${p.essayText || '(Images provided)'}
"""

Please return your evaluation in the following strict JSON schema:
{
  "questionType": "${p.questionType}",
  "questionTitle": "${(p.questionTitle || '').replace(/"/g, "'")}",
  "mark": 18,
  "maxMarks": ${maxMarks},
  "level": "L4",
  "grade": "B",
  "levelDescriptor": "Full level descriptor matching official AQA criteria",
  "executiveSummary": "A concise executive paragraph highlighting strengths and key gaps",
  "wordCount": 850,
  "rubricBreakdown": [
    {
      "name": "Historical Knowledge & Evidence",
      "scoreOut10": 8.0,
      "verdict": "Precise and detailed",
      "feedback": "...",
      "strengths": ["..."],
      "improvements": ["..."]
    }
  ],
  "paragraphAnalysis": [
    {
      "paragraphNumber": 1,
      "focusTitle": "...",
      "levelBand": "L4",
      "snippet": "...",
      "whatWentWell": ["..."],
      "evenBetterIf": ["..."],
      "historicalContextNotes": "...",
      "linkToQuestionQuality": "Strong"
    }
  ],
  "upgradeAdvice": {
    "currentLevel": "L4",
    "nextLevel": "L5",
    "targetMarks": "21-25 marks",
    "goldenRules": ["..."],
    "recommendedEvidence": ["..."],
    "sentenceMakeover": {
      "original": "...",
      "upgraded": "...",
      "rationale": "..."
    }
  },
  "aqaScaleComparison": {
    "scaleType": "${p.questionType}",
    "currentLevel": "L4",
    "currentMark": 18,
    "maxMarks": ${maxMarks},
    "grade": "B",
    "nextLevel": "L5",
    "nextGrade": "A",
    "marksNeededForHigherGrade": 3,
    "specificCriteriaToAchieveHigherGrade": ["..."],
    "whatEssayCurrentlyDemonstrates": ["..."],
    "missingElementsKeepingInCurrentBand": ["..."]
  },
  "examinerTips": ["..."]
}`;

  const parts: any[] = [];

  if (p.imageBase64List && p.imageBase64List.length > 0) {
    for (const img of p.imageBase64List) {
      parts.push({
        inlineData: {
          mimeType: img.mimeType || 'image/png',
          data: img.data.replace(/^data:image\/[a-zA-Z+]+;base64,/, ''),
        },
      });
    }
  }

  parts.push({ text: userPrompt });

  const rawOutput = await callGeminiRest(apiKey, {
    contents: [{ parts }],
    systemInstruction,
    responseMimeType: 'application/json',
    temperature: 0.2,
    onStatusUpdate: p.onStatusUpdate,
  });

  const jsonStr = extractJsonString(rawOutput);
  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (parseErr: any) {
    throw new Error(`Failed to parse examiner feedback as JSON: ${parseErr.message}`);
  }

  // Sanitize and guarantee all required fields for UI safety
  const sanitizedResult: MarkingResult = {
    questionType: p.questionType,
    questionTitle: parsed.questionTitle || p.questionTitle || 'AQA History Essay',
    mark: typeof parsed.mark === 'number' ? parsed.mark : 15,
    maxMarks: maxMarks as 25 | 30,
    level: (['L1', 'L2', 'L3', 'L4', 'L5'].includes(parsed.level) ? parsed.level : 'L3') as any,
    grade: (['A*', 'A', 'B', 'C', 'D', 'E', 'U'].includes(parsed.grade) ? parsed.grade : 'C') as any,
    levelDescriptor: parsed.levelDescriptor || 'Demonstrates understanding with appropriate historical evidence.',
    executiveSummary: parsed.executiveSummary || 'The essay demonstrates historical knowledge with room for more sustained analytical judgement.',
    wordCount: typeof parsed.wordCount === 'number' ? parsed.wordCount : (p.essayText.trim().split(/\s+/).filter(Boolean).length || 500),
    rubricBreakdown: Array.isArray(parsed.rubricBreakdown) ? parsed.rubricBreakdown : [],
    paragraphAnalysis: Array.isArray(parsed.paragraphAnalysis) ? parsed.paragraphAnalysis : [],
    upgradeAdvice: parsed.upgradeAdvice || {
      currentLevel: parsed.level || 'L3',
      nextLevel: 'L4',
      targetMarks: `${(parsed.mark || 15) + 3}-${maxMarks} marks`,
      goldenRules: ['Ensure every paragraph explicitly answers the central question.'],
      recommendedEvidence: ['Integrate more specific statistics, dates, and named acts.'],
      sentenceMakeover: {
        original: 'This was an important reason for the outcome.',
        upgraded: 'Consequently, this structural dynamic served as the decisive catalyst.',
        rationale: 'Elevates causal precision and analytical vocabulary.',
      },
    },
    aqaScaleComparison: parsed.aqaScaleComparison || {
      scaleType: p.questionType,
      currentLevel: parsed.level || 'L3',
      currentMark: typeof parsed.mark === 'number' ? parsed.mark : 15,
      maxMarks,
      grade: parsed.grade || 'C',
      nextLevel: 'L4',
      nextGrade: 'B',
      marksNeededForHigherGrade: 3,
      specificCriteriaToAchieveHigherGrade: ['Provide explicit judgement linking back to the question.'],
      whatEssayCurrentlyDemonstrates: ['Accurate historical knowledge and factual recall.'],
      missingElementsKeepingInCurrentBand: ['Sustained comparison of alternative causal factors.'],
    },
    examinerTips: Array.isArray(parsed.examinerTips) ? parsed.examinerTips : [
      'Maintain continuous judgement at the end of every paragraph, not just in the conclusion.',
      'Check that your evidence directly evaluates the question rather than recounting narrative events.',
    ],
  };

  return sanitizedResult;
}

/**
 * Direct client-side AI Tutor chat via Google Gemini API
 */
export async function chatWithHistorianDirect(
  apiKey?: string,
  params?: {
    message: string;
    history: Array<{ role: string; content: string }>;
    essayContext?: string;
    markingResult?: MarkingResult | null;
    onStatusUpdate?: (status: string) => void;
  }
): Promise<string> {
  const p = params || { message: '', history: [] };
  const systemInstruction = `You are "Master Historian AI", an elite, supportive, and incisive AQA A-Level History tutor and Senior Examiner.
You are helping a student understand their feedback, improve their historical arguments, and upgrade their essay writing.

### THE STUDENT'S ESSAY & MARKING CONTEXT:
Question Title: ${p.markingResult?.questionTitle || 'A-Level History Question'}
Question Type: ${p.markingResult?.questionType === 'source_30' ? '30-Mark Source Extract Question' : '25-Mark Essay Question'}
Assigned Mark: ${p.markingResult?.mark ?? 'N/A'} / ${p.markingResult?.maxMarks ?? 25} (Level: ${p.markingResult?.level ?? 'N/A'}, Grade: ${p.markingResult?.grade ?? 'N/A'})
Executive Summary: ${p.markingResult?.executiveSummary || 'Essay reviewed'}

Original Essay Excerpt:
${(p.essayContext || '').slice(0, 3000)}

### OFFICIAL AQA CALIBRATION RULES YOU MUST UPHOLD:
1. 24/25 A* standard (e.g. Stalin essay): Flawless balance, sustained analytical judgement throughout, rich specific evidence (statistics, dates, names).
2. 18/25 B standard (e.g. Henry VII essay): Solid PEEL paragraphs and accurate facts, but loses marks if repeating/reusing identical examples across factors or if judgement is only partially substantiated.
3. 15/25 C standard (e.g. Feb 1917 army essay): Lots of good facts, but drifts into narrative storytelling without explicit, consistent links back to the Question and Judgement (Q/J).
4. 25/30 A* Source Extract standard (e.g. Henry VIII): Rigorous breakdown of all 3 extracts (provenance, tone, own knowledge, argument evaluation). No conclusion is needed in source questions!
5. 18/30 B Source Extract standard (e.g. Lenin NEP): Good facts, but wanders off focus or debates pure "unreliability" instead of assessing historical utility/value.

### YOUR TONE & BEHAVIOR:
- Professional, encouraging, clear, and direct.
- Provide concrete historical facts, acts, dates, and precise wording when asked for suggestions.
- When helping a student rewrite a sentence or paragraph, demonstrate high-level academic historical prose.
- Format your response with crisp markdown headers, bullet points, and bold text for easy reading.`;

  const contents: any[] = [];

  if (p.history && Array.isArray(p.history)) {
    for (const msg of p.history) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
  }

  contents.push({
    role: 'user',
    parts: [{ text: p.message }],
  });

  return await callGeminiRest(apiKey, {
    contents,
    systemInstruction,
    temperature: 0.4,
    onStatusUpdate: p.onStatusUpdate,
  });
}
