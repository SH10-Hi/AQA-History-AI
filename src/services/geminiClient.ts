// WARNING: Client-side API key usage.
// The user enters their own free Google Gemini API key in the UI, which is stored in browser LocalStorage.
// Direct browser fetches target Google's official REST endpoint: https://generativelanguage.googleapis.com
// for static hosting compatibility (Vercel, Netlify, GitHub Pages) without any local/relative /api/ backend routes.
// Non-JSON responses (e.g. 404/502 HTML pages) are safely handled to prevent UI crashes.

import { MarkingResult, QuestionType } from '../types';
import { BENCHMARK_EXEMPLARS } from '../data/benchmarks';

// Active, reliable Gemini model endpoints (prioritizing stable high-throughput flash models)
export const DEFAULT_MODEL = 'gemini-3.6-flash';

export const CANDIDATE_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash',
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
    lower.includes('invalid model') ||
    lower.includes('no longer available') ||
    lower.includes('not supported for generatecontent')
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
 *    - Uses active, reliable endpoints ("gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite")
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
  // Retrieve custom API key passed in, from browser LocalStorage, or from environment
  let cleanKey = (apiKey || '').trim();
  if (!cleanKey && typeof window !== 'undefined' && window.localStorage) {
    cleanKey = (window.localStorage.getItem('gemini_api_key') || '').trim();
  }
  if (!cleanKey && typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) {
    cleanKey = (process.env.GEMINI_API_KEY || '').trim();
  }
  if (!cleanKey && (import.meta as any).env?.VITE_GEMINI_API_KEY) {
    cleanKey = ((import.meta as any).env.VITE_GEMINI_API_KEY || '').trim();
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

  const relevantBenchmarks = BENCHMARK_EXEMPLARS.filter(b => b.questionType === p.questionType);

  const benchmarkGuideText = relevantBenchmarks.map(b => `
--- BENCHMARK EXEMPLAR: "${b.title}" ---
Topic: ${b.topic}
Question: "${b.questionPrompt}"
Achieved Mark: ${b.achievedMark}/${b.maxMark} (Level: ${b.achievedLevel}, Grade: ${b.achievedGrade})
Official Teacher Summary: "${b.teacherSummary}"
Key Distinguishing Criteria: ${b.keyTakeaway}
Teacher Annotations & Diagnostic Rules:
${b.teacherAnnotations.map(a => `  • ${a}`).join('\n')}
Benchmark Text Sample:
"""
${b.essayText.slice(0, 1500)}...
"""
`).join('\n\n');

  const systemInstruction = `You are a Senior Principal Examiner for AQA A-Level History (Specification 7042).
Your mandate is to mark student essays with realistic, calibrated precision by directly comparing submissions against accredited student benchmark resources and official AQA mark schemes.

================================================================================
CRITICAL EXAMINER CALIBRATION PRINCIPLES (PREVENTING UNDER-MARKING / GRADE DEFLATION)
================================================================================
1. AQA POSITIVE MARKING IN TIMED CONDITIONS:
   AQA examiners are officially instructed to reward what students know, understand, and can substantiate under 45-minute timed exam conditions.
   - Real students write by hand under intense time pressure.
   - You MUST NOT act as a hyper-pedantic English prose or grammar critic.
   - Minor syntactic slips, colloquial phrasing, or handwriting transcription artifacts DO NOT prevent an essay from achieving Level 5 (21–25 marks for essays, 25–30 for sources).
   - If an essay exhibits sustained analytical balance, specific factual/statistical evidence, and a clear substantiated judgement, IT IS LEVEL 5 (Grade A / A*).
   - CRITICAL: Never artificially dock an A* level essay by 5–6 marks down into Level 4 (Grade B).

2. REAL-WORLD BENCHMARK DISTINCTIONS FROM ACCREDITED STUDENT WORK:
${isSourceQuestion ? `
--- FOR 30-MARK SOURCE EXTRACT QUESTIONS (Section A) ---
- LEVEL 5 [25–30 marks] (Grade A*: 25-30):
  *Real Benchmark: Henry VIII Religious Changes (Achieved: 25/30, Grade A*).*
  Key distinguishing traits: Systematically evaluates interpretations across all 3 extracts with deep context/own knowledge (Collectanea Satis Copiosa, Act of Supremacy 1534, Thomas More, Christopher St German, Act of Annates 1532, 6 Articles 1539).
  CRUCIAL AQA RULE: Candidates DO NOT need an overall conclusion in Section A source extract questions. Do NOT penalize the absence of a general conclusion!
- LEVEL 4 [19–24 marks] (Grade A / B):
  Good understanding of interpretations in all 3 extracts, mostly well-supported with context, minor limitations of depth.
- LEVEL 3 [13–18 marks] (Grade B/C - e.g. 18/30 = Grade B):
  *Real Benchmark: Lenin NEP 3 sources (Achieved: 18/30, Grade B).*
  Key distinguishing traits: Rich own knowledge (War Communism, 25k NEPmen, scissor crisis), but loses focus on the specific question or confuses reliability with historical value.
- LEVEL 2 [7–12 marks] (Grade D/E):
  Accurate comment on only 2 extracts; descriptive summary with little or no evaluation.
- LEVEL 1 [1–6 marks] (Grade U):
  Weak, generalist, or addresses only 1 extract.
` : `
--- FOR 25-MARK ESSAY QUESTIONS (Section B) ---
- LEVEL 5 [21–25 marks] (Grade A: 21–23, Grade A*: 24–25):
  *Real Benchmark: Stalin's Economic Policies (Achieved: 24/25, Grade A*).*
  Teacher verdict: "Really nicely balanced – Judgement well substantiated throughout. Shows a higher level of thinking."
  Why it is Level 5 / A*: Deploys rich specific evidence (Holodomor 6m, Belomor Canal 20k deaths, 1.8M Kulaks deported, 1935 Moscow Metro, Western engineers, urban education) while sustaining a nuanced counter-balance between human catastrophe and structural modernization/survival.
  CALIBRATION RULE: Even with natural student phrasing under timed conditions, sustained thematic balance and factual depth firmly warrant 24/25 (A*).
- LEVEL 4 [16–20 marks] (Grade B: 16–18, Grade A: 19–20):
  *Real Benchmark: Henry VII Financial Measures (Achieved: 18/25, Grade B).*
  Teacher verdict: "Paragraph on finances is strong (attainders, Lovell, 36/62 families). However, examples in paragraphs 2 and 3 are similar (Treaty of Etaples/Ayton). Needs a truly distinct third factor."
  Why it is Level 4 / B: Strong facts and attempted balance, BUT was capped at 18 marks specifically because it recycled the same evidence across two factors instead of having a distinct third factor, leaving judgement partially substantiated.
  DIAGNOSTIC TEST: If an essay DOES provide distinct factors and sustains its judgement without repetitive examples, it belongs in LEVEL 5 (21–25), NOT Level 4.
- LEVEL 3 [11–15 marks] (Grade C: 11–15):
  *Real Benchmark: February Revolution 1917 (Achieved: 15/25, Grade C).*
  Teacher verdict: "High factual recall (66k soldiers, 40k rifles, 750k strikers, Order No. 1, bread rations), but drifted into narrative storytelling without explicit links to Question/Judgement (Q/J)."
  Why it is Level 3 / C: It tells the story rather than weighing causes comparatively. Needs PEEL structure and explicit Question/Judgement links in each paragraph.
- LEVEL 2 [6–10 marks] (Grade D/E):
  Descriptive, partial, fails to grasp full analytical demands.
- LEVEL 1 [1–5 marks] (Grade U):
  Extremely limited, irrelevant, or lacks historical substance.
`}

================================================================================
ACCREDITED BENCHMARK RESOURCES FOR COMPARISON:
================================================================================
${benchmarkGuideText}

================================================================================
REQUIRED EVALUATION PROTOCOL:
================================================================================
1. Benchmark Comparison Step:
   Directly compare the submission against the benchmark exemplars:
   - Does this essay demonstrate sustained balance, specific quantitative/historical evidence, and substantiated judgement on par with the Level 5 A* benchmark? If YES, award Level 5 (21–25 marks for essays, 25–30 for source questions, Grade A/A*).
   - Does it have good knowledge but repeat examples across factors or leave judgement partially substantiated like the Level 4 B benchmark? Award Level 4 (16–20 marks, Grade B).
   - Does it have good facts but drift into narrative history without explicit Question/Judgement links like the Level 3 C benchmark? Award Level 3 (11–15 marks, Grade C).
2. Realistic Scoring:
   Never default to 18 marks. Output the exact mark warranted by the historical evidence, balance, and judgement.
3. Constructive Feedback:
   Provide clear strengths and actionable, high-yield improvements referencing specific historical evidence.`;

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
  "mark": <calibrated integer from 1 to ${maxMarks}>,
  "maxMarks": ${maxMarks},
  "level": "<L1 | L2 | L3 | L4 | L5>",
  "grade": "<A* | A | B | C | D | E | U>",
  "levelDescriptor": "<Official AQA level descriptor matching the awarded level>",
  "executiveSummary": "<Calibrated executive summary highlighting strengths, benchmark alignment, and exact mark justification>",
  "wordCount": <estimated word count as number>,
  "benchmarkComparison": {
    "closestBenchmarkTitle": "<Title of the closest benchmark exemplar from accredited resources>",
    "closestBenchmarkMark": <number>,
    "closestBenchmarkGrade": "<A* | A | B | C>",
    "comparativeRationale": "<2-3 sentences explaining exactly why this essay earned its mark compared to this benchmark exemplar in terms of balance, factual depth, and substantiated judgement>",
    "alignmentCriteriaMet": ["<criterion 1 met>", "<criterion 2 met>"]
  },
  "rubricBreakdown": [
    {
      "name": "Historical Knowledge & Evidence",
      "scoreOut10": <number out of 10>,
      "verdict": "<Precise and detailed | Sound | Limited>",
      "feedback": "...",
      "strengths": ["..."],
      "improvements": ["..."]
    },
    {
      "name": "Analytical Balance & Counter-Arguments",
      "scoreOut10": <number out of 10>,
      "verdict": "<Fully analytical and balanced | Analytical in style with some balance | Descriptive>",
      "feedback": "...",
      "strengths": ["..."],
      "improvements": ["..."]
    },
    {
      "name": "Substantiated Judgement",
      "scoreOut10": <number out of 10>,
      "verdict": "<Well-substantiated throughout | Partially substantiated | Asserted or missing>",
      "feedback": "...",
      "strengths": ["..."],
      "improvements": ["..."]
    },
    {
      "name": "Organisation & Focus on Question",
      "scoreOut10": <number out of 10>,
      "verdict": "<Effectively delivered throughout | Well-organised | Adequate>",
      "feedback": "...",
      "strengths": ["..."],
      "improvements": ["..."]
    }
  ],
  "paragraphAnalysis": [
    {
      "paragraphNumber": 1,
      "focusTitle": "...",
      "levelBand": "<L1 | L2 | L3 | L4 | L5>",
      "snippet": "...",
      "whatWentWell": ["..."],
      "evenBetterIf": ["..."],
      "historicalContextNotes": "...",
      "linkToQuestionQuality": "<Strong | Adequate | Weak/Missing>"
    }
  ],
  "upgradeAdvice": {
    "currentLevel": "<current level>",
    "nextLevel": "<next level or 'Maximum Level' if L5>",
    "targetMarks": "<target marks range>",
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
    "currentLevel": "<awarded level>",
    "currentMark": <awarded mark>,
    "maxMarks": ${maxMarks},
    "grade": "<awarded grade>",
    "nextLevel": "<next level>",
    "nextGrade": "<next grade>",
    "marksNeededForHigherGrade": <number, or 0 if top grade>,
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
    temperature: 0.1,
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
  const rawMark = typeof parsed.mark === 'number' ? Math.round(parsed.mark) : 15;
  const safeMark = Math.min(Math.max(rawMark, 1), maxMarks);

  // Compute realistic grade from mark if needed
  let safeGrade = parsed.grade;
  if (!['A*', 'A', 'B', 'C', 'D', 'E', 'U'].includes(safeGrade)) {
    if (!isSourceQuestion) {
      if (safeMark >= 24) safeGrade = 'A*';
      else if (safeMark >= 21) safeGrade = 'A';
      else if (safeMark >= 16) safeGrade = 'B';
      else if (safeMark >= 11) safeGrade = 'C';
      else if (safeMark >= 6) safeGrade = 'D';
      else safeGrade = 'U';
    } else {
      if (safeMark >= 25) safeGrade = 'A*';
      else if (safeMark >= 21) safeGrade = 'A';
      else if (safeMark >= 16) safeGrade = 'B';
      else if (safeMark >= 12) safeGrade = 'C';
      else if (safeMark >= 7) safeGrade = 'D';
      else safeGrade = 'U';
    }
  }

  // Determine Level from Mark
  let safeLevel = parsed.level;
  if (!['L1', 'L2', 'L3', 'L4', 'L5'].includes(safeLevel)) {
    if (!isSourceQuestion) {
      if (safeMark >= 21) safeLevel = 'L5';
      else if (safeMark >= 16) safeLevel = 'L4';
      else if (safeMark >= 11) safeLevel = 'L3';
      else if (safeMark >= 6) safeLevel = 'L2';
      else safeLevel = 'L1';
    } else {
      if (safeMark >= 25) safeLevel = 'L5';
      else if (safeMark >= 19) safeLevel = 'L4';
      else if (safeMark >= 13) safeLevel = 'L3';
      else if (safeMark >= 7) safeLevel = 'L2';
      else safeLevel = 'L1';
    }
  }

  // Provide fallback benchmarkComparison if missing
  const defaultBenchmark = isSourceQuestion
    ? (safeMark >= 22 ? BENCHMARK_EXEMPLARS[3] : BENCHMARK_EXEMPLARS[4])
    : (safeMark >= 21 ? BENCHMARK_EXEMPLARS[0] : (safeMark >= 16 ? BENCHMARK_EXEMPLARS[1] : BENCHMARK_EXEMPLARS[2]));

  const sanitizedBenchmarkComparison = parsed.benchmarkComparison ? {
    closestBenchmarkTitle: String(parsed.benchmarkComparison.closestBenchmarkTitle || defaultBenchmark?.title || 'AQA Benchmark Exemplar'),
    closestBenchmarkMark: typeof parsed.benchmarkComparison.closestBenchmarkMark === 'number' ? parsed.benchmarkComparison.closestBenchmarkMark : (defaultBenchmark?.achievedMark || 24),
    closestBenchmarkGrade: String(parsed.benchmarkComparison.closestBenchmarkGrade || defaultBenchmark?.achievedGrade || 'A*'),
    comparativeRationale: String(parsed.benchmarkComparison.comparativeRationale || 'Calibrated directly against accredited teacher benchmark standards.'),
    alignmentCriteriaMet: Array.isArray(parsed.benchmarkComparison.alignmentCriteriaMet) ? parsed.benchmarkComparison.alignmentCriteriaMet : (defaultBenchmark?.teacherAnnotations || [])
  } : {
    closestBenchmarkTitle: defaultBenchmark?.title || 'Stalin\'s Economic Policies',
    closestBenchmarkMark: defaultBenchmark?.achievedMark || 24,
    closestBenchmarkGrade: defaultBenchmark?.achievedGrade || 'A*',
    comparativeRationale: `Evaluated against accredited teacher benchmark standards: ${defaultBenchmark?.keyTakeaway || 'Balanced analytical evaluation with specific factual evidence.'}`,
    alignmentCriteriaMet: defaultBenchmark?.teacherAnnotations || ['Balanced analytical judgement', 'Specific historical evidence']
  };

  const sanitizedResult: MarkingResult = {
    questionType: p.questionType,
    questionTitle: parsed.questionTitle || p.questionTitle || 'AQA History Essay',
    mark: safeMark,
    maxMarks: maxMarks as 25 | 30,
    level: safeLevel as any,
    grade: safeGrade as any,
    levelDescriptor: parsed.levelDescriptor || 'Demonstrates understanding with appropriate historical evidence.',
    executiveSummary: parsed.executiveSummary || 'The essay demonstrates historical knowledge with room for more sustained analytical judgement.',
    wordCount: typeof parsed.wordCount === 'number' ? parsed.wordCount : (p.essayText.trim().split(/\s+/).filter(Boolean).length || 500),
    rubricBreakdown: Array.isArray(parsed.rubricBreakdown) ? parsed.rubricBreakdown : [],
    paragraphAnalysis: Array.isArray(parsed.paragraphAnalysis) ? parsed.paragraphAnalysis : [],
    benchmarkComparison: sanitizedBenchmarkComparison,
    upgradeAdvice: parsed.upgradeAdvice || {
      currentLevel: safeLevel,
      nextLevel: safeLevel === 'L5' ? 'L5 (Top Mark)' : `L${parseInt(safeLevel.replace('L', ''), 10) + 1}`,
      targetMarks: safeLevel === 'L5' ? `${maxMarks}/${maxMarks} marks` : `${safeMark + 3}-${maxMarks} marks`,
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
      currentLevel: safeLevel,
      currentMark: safeMark,
      maxMarks,
      grade: safeGrade,
      nextLevel: safeLevel === 'L5' ? 'L5 (Top Mark)' : `L${parseInt(safeLevel.replace('L', ''), 10) + 1}`,
      nextGrade: safeGrade === 'A*' ? 'A*' : (safeGrade === 'A' ? 'A*' : 'A'),
      marksNeededForHigherGrade: safeGrade === 'A*' ? 0 : 3,
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
