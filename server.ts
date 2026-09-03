import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Client instantiation using user's custom Gemini API key
function extractUserApiKey(req: express.Request): string {
  const headerKey = req.headers['x-gemini-api-key'];
  if (typeof headerKey === 'string' && headerKey.trim()) {
    return headerKey.trim();
  }
  if (req.body && typeof req.body.apiKey === 'string' && req.body.apiKey.trim()) {
    return req.body.apiKey.trim();
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return '';
}

function getGeminiClient(userApiKey?: string): GoogleGenAI {
  const trimmedKey = (userApiKey || '').trim();
  if (!trimmedKey) {
    throw new Error('Please enter your free Gemini API Key in the User Settings panel above to start.');
  }
  return new GoogleGenAI({
    apiKey: trimmedKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Resilient Gemini Execution with Automatic Retry and Fleet Fallback
const PRIMARY_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-3.1-flash-lite'];

async function callGeminiWithRetryAndFallback(
  ai: GoogleGenAI,
  params: { contents: any; config?: any },
  preferredModel: string = PRIMARY_MODEL
) {
  const modelsToTry = [preferredModel, ...FALLBACK_MODELS.filter((m) => m !== preferredModel)];
  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          ...params,
          model,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const msg = (err?.message || '').toLowerCase();
        const status = err?.status || err?.code || (err?.error && err.error.code);
        const isTransient =
          status === 503 ||
          status === 429 ||
          msg.includes('high demand') ||
          msg.includes('unavailable') ||
          msg.includes('resource_exhausted') ||
          msg.includes('overloaded');

        console.warn(`[Gemini API] Error on model ${model} (attempt ${attempt}/2): ${err?.message}`);

        if (isTransient) {
          if (attempt === 1) {
            // Exponential delay before retry on same model
            await new Promise((resolve) => setTimeout(resolve, 1500));
            continue;
          }
          // Move to next fallback model in the list
          break;
        } else {
          // If non-transient schema/argument error, do not spin
          throw err;
        }
      }
    }
    console.warn(`[Gemini API] Primary model ${model} temporarily unavailable. Trying fallback...`);
  }

  throw lastError;
}

function formatGeminiErrorMessage(error: any): string {
  if (!error) return 'An unexpected error occurred while communicating with the AI service.';
  let msg = typeof error === 'string' ? error : error.message || JSON.stringify(error);

  try {
    const parsed = typeof msg === 'string' && msg.trim().startsWith('{') ? JSON.parse(msg) : null;
    if (parsed?.error?.message) {
      msg = parsed.error.message;
    }
  } catch {
    // Keep raw msg
  }

  const lower = msg.toLowerCase();
  if (lower.includes('api_key_invalid') || lower.includes('api key not valid') || lower.includes('invalid api key') || lower.includes('key not found')) {
    return 'The provided Gemini API Key is invalid or expired. Please check and re-enter your key in the User Settings panel above.';
  }
  if (lower.includes('high demand') || lower.includes('503') || lower.includes('unavailable')) {
    return 'Google Gemini AI servers are momentarily experiencing high global demand. Automatic retries were attempted. Please click "Retry Marking" to submit again.';
  }
  return msg;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Handwriting OCR / File transcription endpoint
app.post('/api/transcribe-handwriting', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    const userApiKey = extractUserApiKey(req);
    if (!userApiKey) {
      return res.status(400).json({
        error: 'Please enter your free Gemini API Key in the User Settings panel above to start.',
      });
    }

    const ai = getGeminiClient(userApiKey);
    const prompt = `You are an expert AQA A-Level History examiner and transcription specialist.
Transcribe the handwritten or typed essay from this student notebook page image with high fidelity.
- Preserve the exact student wording, paragraph breaks, and headings.
- Maintain any annotations or corrections the student wrote.
- If teacher red pen marks or grades are visible, note them in a bracketed annotation like [Teacher Note: ...].
- Output ONLY the transcribed essay text clearly and cleanly formatted.`;

    const response = await callGeminiWithRetryAndFallback(ai, {
      contents: [
        {
          inlineData: {
            mimeType: mimeType || 'image/png',
            data: imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, ''),
          },
        },
        { text: prompt },
      ],
    });

    res.json({ transcribedText: response.text || '' });
  } catch (error: any) {
    console.error('Error transcribing handwriting:', error);
    const friendlyError = formatGeminiErrorMessage(error);
    res.status(500).json({ error: friendlyError });
  }
});

// Essay Marking endpoint
app.post('/api/mark-essay', async (req, res) => {
  try {
    const { essayText, questionType, questionTitle, extractsText, imageBase64List } = req.body;

    if (!essayText && (!imageBase64List || imageBase64List.length === 0)) {
      return res.status(400).json({ error: 'Please provide essay text or essay images to mark.' });
    }

    const userApiKey = extractUserApiKey(req);
    if (!userApiKey) {
      return res.status(400).json({
        error: 'Please enter your free Gemini API Key in the User Settings panel above to start.',
      });
    }

    const ai = getGeminiClient(userApiKey);

    const isSourceQuestion = questionType === 'source_30';
    const maxMarks = isSourceQuestion ? 30 : 25;

    const systemPrompt = `You are a Senior Principal Examiner for AQA A-Level History (7042).
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
  *Benchmark standard (25/30, Grade A*):* Henry VIII 3 extracts. Comprehensive analysis of arguments, provenance, tone, and deep own knowledge (Collectanea Satis Copiosa, Act of Supremacy 1534, Thomas More 1535, Pilgrimage of Grace 30,000, Christopher St German, Act of Annates 1532, Cranmer 1532, 6 Articles 1539). Crucial note: Candidates DO NOT need an overall conclusion if extracts are thoroughly evaluated individually.
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
Be constructive, rigorous, and supportive, mimicking an experienced UK AQA History department teacher (giving specific Praise [WWW] and Next Steps [EBI]).`;

    const userPrompt = `Student Question Title: "${questionTitle || (isSourceQuestion ? 'AQA 30-Mark Source Extract Question' : 'AQA 25-Mark Essay Question')}"
Question Type: ${isSourceQuestion ? '30-Mark Source Extract Question' : '25-Mark Section B Essay'}
${extractsText ? `Extracts Provided for Analysis:\n${extractsText}\n\n` : ''}
Student Essay Text:
"""
${essayText || '(Images provided)'}
"""

Please return your evaluation in the following strict JSON schema:`;

    const contentParts: any[] = [];

    if (imageBase64List && imageBase64List.length > 0) {
      for (const img of imageBase64List) {
        contentParts.push({
          inlineData: {
            mimeType: img.mimeType || 'image/png',
            data: img.data.replace(/^data:image\/[a-zA-Z+]+;base64,/, ''),
          },
        });
      }
    }

    contentParts.push({ text: userPrompt });

    const response = await callGeminiWithRetryAndFallback(ai, {
      contents: contentParts,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questionType: { type: Type.STRING },
            questionTitle: { type: Type.STRING },
            mark: { type: Type.INTEGER },
            maxMarks: { type: Type.INTEGER },
            level: { type: Type.STRING },
            grade: { type: Type.STRING },
            levelDescriptor: { type: Type.STRING },
            executiveSummary: { type: Type.STRING },
            wordCount: { type: Type.INTEGER },
            rubricBreakdown: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  scoreOut10: { type: Type.NUMBER },
                  verdict: { type: Type.STRING },
                  feedback: { type: Type.STRING },
                  strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                  improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['name', 'scoreOut10', 'verdict', 'feedback', 'strengths', 'improvements'],
              },
            },
            paragraphAnalysis: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  paragraphNumber: { type: Type.INTEGER },
                  focusTitle: { type: Type.STRING },
                  levelBand: { type: Type.STRING },
                  snippet: { type: Type.STRING },
                  whatWentWell: { type: Type.ARRAY, items: { type: Type.STRING } },
                  evenBetterIf: { type: Type.ARRAY, items: { type: Type.STRING } },
                  historicalContextNotes: { type: Type.STRING },
                  linkToQuestionQuality: { type: Type.STRING },
                },
                required: [
                  'paragraphNumber',
                  'focusTitle',
                  'levelBand',
                  'snippet',
                  'whatWentWell',
                  'evenBetterIf',
                  'historicalContextNotes',
                  'linkToQuestionQuality',
                ],
              },
            },
            upgradeAdvice: {
              type: Type.OBJECT,
              properties: {
                currentLevel: { type: Type.STRING },
                nextLevel: { type: Type.STRING },
                targetMarks: { type: Type.STRING },
                goldenRules: { type: Type.ARRAY, items: { type: Type.STRING } },
                recommendedEvidence: { type: Type.ARRAY, items: { type: Type.STRING } },
                sentenceMakeover: {
                  type: Type.OBJECT,
                  properties: {
                    original: { type: Type.STRING },
                    upgraded: { type: Type.STRING },
                    rationale: { type: Type.STRING },
                  },
                  required: ['original', 'upgraded', 'rationale'],
                },
              },
              required: ['currentLevel', 'nextLevel', 'targetMarks', 'goldenRules', 'recommendedEvidence', 'sentenceMakeover'],
            },
            aqaScaleComparison: {
              type: Type.OBJECT,
              properties: {
                scaleType: { type: Type.STRING },
                currentLevel: { type: Type.STRING },
                currentMark: { type: Type.INTEGER },
                maxMarks: { type: Type.INTEGER },
                grade: { type: Type.STRING },
                nextLevel: { type: Type.STRING },
                nextGrade: { type: Type.STRING },
                marksNeededForHigherGrade: { type: Type.INTEGER },
                specificCriteriaToAchieveHigherGrade: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                whatEssayCurrentlyDemonstrates: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                missingElementsKeepingInCurrentBand: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: [
                'scaleType',
                'currentLevel',
                'currentMark',
                'maxMarks',
                'grade',
                'nextLevel',
                'nextGrade',
                'marksNeededForHigherGrade',
                'specificCriteriaToAchieveHigherGrade',
                'whatEssayCurrentlyDemonstrates',
                'missingElementsKeepingInCurrentBand',
              ],
            },
            examinerTips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            'questionType',
            'questionTitle',
            'mark',
            'maxMarks',
            'level',
            'grade',
            'levelDescriptor',
            'executiveSummary',
            'rubricBreakdown',
            'paragraphAnalysis',
            'upgradeAdvice',
            'examinerTips',
            'wordCount',
          ],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error('Empty response from marking engine');
    }

    const parsedResult = JSON.parse(resultText);
    res.json(parsedResult);
  } catch (error: any) {
    console.error('Error in /api/mark-essay:', error);
    const friendlyError = formatGeminiErrorMessage(error);
    res.status(500).json({ error: friendlyError });
  }
});

// Interactive AI Tutor Chatbot endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, essayContext, markingResult } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const userApiKey = extractUserApiKey(req);
    if (!userApiKey) {
      return res.status(400).json({
        error: 'Please enter your free Gemini API Key in the User Settings panel above to start.',
      });
    }

    const ai = getGeminiClient(userApiKey);

    const systemInstruction = `You are "Master Historian AI", an elite, supportive, and incisive AQA A-Level History tutor and Senior Examiner.
You are helping a student understand their feedback, improve their historical arguments, and upgrade their essay writing.

### THE STUDENT'S ESSAY & MARKING CONTEXT:
Question Title: ${markingResult?.questionTitle || 'A-Level History Question'}
Question Type: ${markingResult?.questionType === 'source_30' ? '30-Mark Source Extract Question' : '25-Mark Essay Question'}
Assigned Mark: ${markingResult?.mark ?? 'N/A'} / ${markingResult?.maxMarks ?? 25} (Level: ${markingResult?.level ?? 'N/A'}, Grade: ${markingResult?.grade ?? 'N/A'})
Executive Summary: ${markingResult?.executiveSummary || 'Essay reviewed'}

Original Essay Excerpt:
${(essayContext || '').slice(0, 3000)}

### OFFICIAL AQA CALIBRATION RULES YOU MUST UPHOLD:
1. 24/25 A* standard (e.g. Stalin essay): Flawless balance, sustained analytical judgement throughout, rich specific evidence (statistics, dates, names).
2. 18/25 B standard (e.g. Henry VII essay): Solid PEEL paragraphs and accurate facts, but loses marks if repeating/reusing identical examples across factors (e.g. Etaples/Ayton) or if judgement is only partially substantiated.
3. 15/25 C standard (e.g. Feb 1917 army essay): Lots of good facts, but drifts into narrative storytelling without explicit, consistent links back to the Question and Judgement (Q/J).
4. 25/30 A* Source Extract standard (e.g. Henry VIII): Rigorous breakdown of all 3 extracts (provenance, tone, own knowledge, argument evaluation). No conclusion is needed in source questions!
5. 18/30 B Source Extract standard (e.g. Lenin NEP): Good facts, but wanders off focus or debates pure "unreliability" instead of assessing historical utility/value.

### YOUR TONE & BEHAVIOR:
- Professional, encouraging, clear, and direct.
- Provide concrete historical facts, acts, dates, and precise wording when asked for suggestions.
- When helping a student rewrite a sentence or paragraph, demonstrate high-level academic historical prose (e.g. "Consequently, this demonstrates...", "Whilst it is persuasive that...", "However, this must be nuanced against...").
- Format your response with crisp markdown headers, bullet points, and bold text for easy reading.`;

    const chatMessages: any[] = [];

    if (history && Array.isArray(history)) {
      for (const msg of history) {
        chatMessages.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    chatMessages.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const response = await callGeminiWithRetryAndFallback(ai, {
      contents: chatMessages,
      config: {
        systemInstruction,
      },
    });

    res.json({ reply: response.text || '' });
  } catch (error: any) {
    console.error('Error in /api/chat:', error);
    const friendlyError = formatGeminiErrorMessage(error);
    res.status(500).json({ error: friendlyError });
  }
});

// Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AQA History Essay Marker server running on port ${PORT}`);
  });
}

startServer();
