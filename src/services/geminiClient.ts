// WARNING: Client-side API key usage.
// The user enters their own free Google Gemini API key in the UI, which is stored in browser LocalStorage.
// Direct browser fetches target Google's official REST endpoint: https://googleapis.com
// for static hosting compatibility (Vercel, Netlify, GitHub Pages) without any local/relative /api/ backend routes.
// Non-JSON responses (e.g. 404/502 HTML pages) are safely handled to prevent UI crashes.

import { MarkingResult, QuestionType } from '../types';

// Candidate models for direct REST calls in order of preference (excluding unavailable models)
const CANDIDATE_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-flash-latest',
];

interface CallGeminiParams {
  contents: any[];
  systemInstruction?: string;
  responseMimeType?: string;
  temperature?: number;
}

/**
 * Safely parse an HTTP response, gracefully handling non-JSON responses (HTML error pages, plain text)
 * to avoid syntax errors like "Unexpected token 'T', 'The page c'... is not valid JSON".
 */
export async function safeParseResponse(response: Response): Promise<{ ok: boolean; data: any; errorText?: string }> {
  let rawText = '';
  try {
    rawText = await response.text();
  } catch (err: any) {
    return {
      ok: false,
      data: null,
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
      errorText: `Server returned non-JSON response (HTTP ${response.status}): ${friendlySnippet}`,
    };
  }

  if (!response.ok) {
    const errorMsg = parsed?.error?.message || parsed?.error || parsed?.message || `HTTP ${response.status}`;
    return {
      ok: false,
      data: parsed,
      errorText: errorMsg,
    };
  }

  return {
    ok: true,
    data: parsed,
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
 * Executes a direct browser fetch to the Google Gemini API with automatic model fallback
 * and resilient error handling for transient errors and non-JSON server responses.
 */
async function callGeminiRest(
  apiKey?: string,
  params: CallGeminiParams = { contents: [] },
  preferredModel: string = CANDIDATE_MODELS[0]
): Promise<string> {
  // Retrieve custom API key passed in or directly from browser LocalStorage
  let cleanKey = (apiKey || '').trim();
  if (!cleanKey && typeof window !== 'undefined' && window.localStorage) {
    cleanKey = (window.localStorage.getItem('gemini_api_key') || '').trim();
  }

  if (!cleanKey) {
    throw new Error('Please enter your free Gemini API Key in the User Settings panel above to start.');
  }

  const modelsToTry = [
    preferredModel,
    ...CANDIDATE_MODELS.filter((m) => m !== preferredModel),
  ];

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
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

        // Direct browser fetch targeting the new model endpoint: https://googleapis.com
        const candidateEndpoints = [
          `https://googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`,
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`,
        ];

        let response: Response | null = null;
        let parsedResult: { ok: boolean; data: any; errorText?: string } | null = null;

        for (const url of candidateEndpoints) {
          response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': cleanKey,
            },
            body: JSON.stringify(requestBody),
          });

          parsedResult = await safeParseResponse(response);
          // If the apex endpoint returns 404, fall back to the generativelanguage subdomain
          if (!parsedResult.ok && response.status === 404 && url.startsWith('https://googleapis.com')) {
            continue;
          }
          break;
        }

        if (!parsedResult || !response) {
          throw new Error('No response received from Google model endpoint.');
        }

        if (!parsedResult.ok) {
          const rawErrMsg = parsedResult.errorText || `HTTP ${response.status}`;
          const lower = rawErrMsg.toLowerCase();

          // Check for invalid or expired API key immediately
          if (
            lower.includes('api_key_invalid') ||
            lower.includes('api key not valid') ||
            lower.includes('invalid api key') ||
            lower.includes('key not found') ||
            (response.status === 400 && lower.includes('api key'))
          ) {
            throw new Error(
              'The provided Gemini API Key is invalid or expired. Please check and re-enter your key in the User Settings panel above.'
            );
          }

          // Check if model not found on v1beta or rate-limited
          const isModelNotFound = response.status === 404 || lower.includes('not found');
          const isTransient =
            response.status === 503 ||
            response.status === 429 ||
            lower.includes('high demand') ||
            lower.includes('unavailable') ||
            lower.includes('resource_exhausted') ||
            lower.includes('overloaded');

          if (isModelNotFound) {
            // Immediately skip to next model in the candidate chain
            lastError = new Error(rawErrMsg);
            break;
          }

          if (isTransient) {
            lastError = new Error(
              'Google Gemini AI servers are momentarily busy. Please try submitting again in a few seconds.'
            );
            if (attempt === 1) {
              await new Promise((resolve) => setTimeout(resolve, 1200));
              continue;
            }
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
        if (msg.includes('invalid or expired') || msg.includes('user settings panel')) {
          throw err;
        }
      }
    }
  }

  throw lastError || new Error('Failed to communicate with Google Gemini API across all model fallbacks.');
}

/**
 * Transcribe student handwriting directly from client-side browser fetch
 */
export async function transcribeHandwritingDirect(
  apiKey?: string,
  params?: { imageBase64: string; mimeType: string }
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
  });
}
