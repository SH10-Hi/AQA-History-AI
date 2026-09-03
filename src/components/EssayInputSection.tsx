import React, { useState, useRef } from 'react';
import { 
  FileText, 
  Upload, 
  Camera, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  ArrowRight,
  BookOpen
} from 'lucide-react';
import { QuestionType } from '../types';
import { BENCHMARK_EXEMPLARS } from '../data/benchmarks';
import { getStoredApiKey } from '../utils/apiKey';
import { transcribeHandwritingDirect } from '../services/geminiClient';

interface EssayInputSectionProps {
  questionType: QuestionType;
  setQuestionType: (t: QuestionType) => void;
  questionTitle: string;
  setQuestionTitle: (q: string) => void;
  extractsText: string;
  setExtractsText: (e: string) => void;
  essayText: string;
  setEssayText: (t: string) => void;
  onSubmit: () => void;
  isMarking: boolean;
  onLoadBenchmark: (id: string) => void;
  apiKey?: string;
}

export const EssayInputSection: React.FC<EssayInputSectionProps> = ({
  questionType,
  setQuestionType,
  questionTitle,
  setQuestionTitle,
  extractsText,
  setExtractsText,
  essayText,
  setEssayText,
  onSubmit,
  isMarking,
  onLoadBenchmark,
  apiKey,
}) => {
  const [activeInputMode, setActiveInputMode] = useState<'text' | 'file' | 'camera'>('text');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrSuccessMessage, setOcrSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const wordCount = essayText.trim() ? essayText.trim().split(/\s+/).length : 0;

  // Handle standard text file upload (.txt, .md)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setEssayText(content);
        setOcrSuccessMessage(`Loaded "${file.name}" successfully (${content.split(/\s+/).length} words)`);
      };
      reader.readAsText(file);
    } else if (file.type.startsWith('image/')) {
      handleImageOCR(file);
    } else {
      // Fallback read as text
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setEssayText(content);
        setOcrSuccessMessage(`Loaded "${file.name}"`);
      };
      reader.readAsText(file);
    }
  };

  // Handle handwritten photo OCR upload
  const handleImageOCR = async (file: File) => {
    setOcrLoading(true);
    setErrorMessage(null);
    setOcrSuccessMessage(null);

    const key = apiKey || getStoredApiKey();
    if (!key) {
      setErrorMessage('Please enter your free Gemini API Key in the User Settings panel above to transcribe handwriting.');
      setOcrLoading(false);
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          
          // Direct client-side browser fetch to Google Gemini API
          const transcribed = await transcribeHandwritingDirect(key, {
            imageBase64: base64Data,
            mimeType: file.type || 'image/png',
          });

          // Append or replace
          if (essayText.trim()) {
            setEssayText(essayText + '\n\n' + transcribed);
            setOcrSuccessMessage(`Transcribed and appended page from "${file.name}"!`);
          } else {
            setEssayText(transcribed);
            setOcrSuccessMessage(`Transcribed handwriting from "${file.name}"!`);
          }
        } catch (innerErr: any) {
          console.error('OCR transcription error:', innerErr);
          setErrorMessage(innerErr?.message || 'Error transcribing handwriting from image.');
        } finally {
          setOcrLoading(false);
        }
      };

      reader.onerror = () => {
        setErrorMessage('Failed to read image file.');
        setOcrLoading(false);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'Error processing image file.');
      setOcrLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
      {/* Top Banner / Type Toggle */}
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              AQA Assessment Component & Rubric
            </span>
          </div>

          <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
            <button
              id="type-btn-essay25"
              type="button"
              onClick={() => setQuestionType('essay_25')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
                questionType === 'essay_25'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>25-Mark Section B Essay</span>
              <span className="text-[10px] bg-black/20 px-1.5 py-0.2 rounded font-mono">L1–L5</span>
            </button>

            <button
              id="type-btn-source30"
              type="button"
              onClick={() => setQuestionType('source_30')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
                questionType === 'source_30'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>30-Mark Source Question</span>
              <span className="text-[10px] bg-black/20 px-1.5 py-0.2 rounded font-mono">3 Extracts</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Form Body */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* Benchmark Presets Bar */}
        <div className="bg-slate-50 border border-slate-200 rounded p-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                Load Benchmark Work:
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {BENCHMARK_EXEMPLARS.map((bm) => (
                <button
                  key={bm.id}
                  type="button"
                  onClick={() => onLoadBenchmark(bm.id)}
                  className="text-xs px-2.5 py-1 rounded bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-800 font-medium transition-colors shadow-2xs flex items-center gap-1"
                  title={`${bm.title} - ${bm.achievedMark}/${bm.maxMark} (${bm.achievedGrade})`}
                >
                  <span className="font-bold text-indigo-700">{bm.achievedGrade}</span>
                  <span className="text-slate-600 truncate max-w-[130px]">{bm.title}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({bm.achievedMark}m)</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Question Title Input */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="question-input" className="block text-[10px] uppercase tracking-wider font-bold text-slate-500">
              Essay Prompt / Question Title ({questionType === 'source_30' ? '30' : '25'} Marks)
            </label>
            <span className="text-[10px] text-slate-400">AQA 7042</span>
          </div>
          <input
            id="question-input"
            type="text"
            value={questionTitle}
            onChange={(e) => setQuestionTitle(e.target.value)}
            placeholder={
              questionType === 'essay_25'
                ? "e.g. 'Stalin's economic policies did not have a predominantly negative impact on Soviet Society. Assess the validity of this view. (25 marks)'"
                : "e.g. 'With reference to these 3 extracts and your understanding of historical context, assess the value of these three extracts to an historian studying... (30 marks)'"
            }
            className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-medium text-slate-900"
          />
        </div>

        {/* If Source Question: Extracts Input Section */}
        {questionType === 'source_30' && (
          <div className="bg-slate-50 p-3.5 rounded border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="extracts-input" className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                Source Extracts (Extracts A, B, and C)
              </label>
              <span className="text-[10px] text-slate-500">
                Optional: Paste extract texts for cross-referencing
              </span>
            </div>
            <textarea
              id="extracts-input"
              rows={3}
              value={extractsText}
              onChange={(e) => setExtractsText(e.target.value)}
              placeholder="Paste Extracts A, B, and C here (or their main arguments/provenance details)..."
              className="w-full px-3 py-2 text-xs font-serif-essay bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 text-slate-800"
            />
          </div>
        )}

        {/* Input Mode Selector: Text vs File vs Handwritten OCR */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveInputMode('text')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeInputMode === 'text'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Type / Paste</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveInputMode('file');
                fileInputRef.current?.click();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeInputMode === 'file'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Document</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveInputMode('camera');
                imageInputRef.current?.click();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeInputMode === 'camera'
                  ? 'bg-indigo-600 text-white'
                  : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-indigo-500" />
              <span>Handwritten OCR</span>
              <span className="text-[10px] bg-indigo-200 text-indigo-900 px-1.5 py-0.2 rounded font-bold">
                Photo
              </span>
            </button>
          </div>

          <div className="text-xs text-slate-500 font-mono">
            <span className="font-bold text-slate-800">{wordCount}</span> words
          </div>
        </div>

        {/* Hidden File Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.doc,.docx"
          onChange={handleFileUpload}
          className="hidden"
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageOCR(file);
          }}
          className="hidden"
        />

        {/* OCR Status Messages */}
        {ocrLoading && (
          <div className="flex items-center space-x-2 p-3 bg-indigo-50 border border-indigo-200 rounded text-xs text-indigo-900 animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-700" />
            <span>Transcribing handwritten notebook image using Gemini OCR...</span>
          </div>
        )}

        {ocrSuccessMessage && (
          <div className="flex items-center space-x-2 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{ocrSuccessMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center space-x-2 p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-900">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Essay Content Textarea */}
        <div className="relative">
          <textarea
            id="essay-content-textarea"
            rows={14}
            value={essayText}
            onChange={(e) => setEssayText(e.target.value)}
            placeholder="Type, paste, or upload your essay here. The system evaluates it against the official AQA mark scheme (L1-L5), verifying historical accuracy, question/judgement links (Q/J), and providing actionable upgrade advice..."
            className="w-full p-4 font-serif-essay text-sm leading-relaxed text-slate-900 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-colors shadow-2xs resize-y"
          />

          {essayText.length === 0 && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 text-center text-slate-400">
              <FileText className="w-8 h-8 mb-2 text-slate-300" />
              <p className="text-xs font-semibold text-slate-600">
                Paste student essay text or upload a photo of handwritten notebook work
              </p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-md">
                Click any exemplar above to test calibration (e.g. Stalin 24/25 A*, Henry VII 18/25 B, 1917 15/25 C)
              </p>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>Calibrated with official AQA 7042 criteria & student notebook benchmarks</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {essayText && (
              <button
                type="button"
                onClick={() => {
                  setEssayText('');
                  setOcrSuccessMessage(null);
                  setErrorMessage(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
              >
                Clear
              </button>
            )}

            <button
              id="submit-mark-essay-btn"
              type="button"
              disabled={isMarking || (!essayText.trim() && !ocrLoading)}
              onClick={onSubmit}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded font-medium text-xs sm:text-sm shadow-xs transition-all ${
                isMarking || (!essayText.trim() && !ocrLoading)
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {isMarking ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Evaluating with AQA Rubric...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                  <span>Evaluate Essay & Generate Marks</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
