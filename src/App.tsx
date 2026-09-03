import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { Header } from './components/Header';
import { EssayInputSection } from './components/EssayInputSection';
import { MarkingDashboard } from './components/MarkingDashboard';
import { ExemplarVault } from './components/ExemplarVault';
import { RubricsGuide } from './components/RubricsGuide';
import { AIChatDrawer } from './components/AIChatDrawer';
import { UserSettingsPanel } from './components/UserSettingsPanel';
import { QuestionType, MarkingResult, BenchmarkExemplar } from './types';
import { BENCHMARK_EXEMPLARS } from './data/benchmarks';
import { Sparkles, AlertCircle } from 'lucide-react';
import { getStoredApiKey, setStoredApiKey, getApiHeaders } from './utils/apiKey';

export default function App() {
  const [activeTab, setActiveTab] = useState<'marker' | 'benchmarks' | 'rubrics' | 'chat'>('marker');
  const [questionType, setQuestionType] = useState<QuestionType>('essay_25');
  const [questionTitle, setQuestionTitle] = useState("Stalin's economic policies did not have a predominantly negative impact on Soviet Society. Assess the validity of this view. (25 marks)");
  const [extractsText, setExtractsText] = useState('');
  const [essayText, setEssayText] = useState(BENCHMARK_EXEMPLARS[0].essayText);
  const [isMarking, setIsMarking] = useState(false);
  const [markingResult, setMarkingResult] = useState<MarkingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>(() => getStoredApiKey());

  const handleApiKeyChange = (newKey: string) => {
    setApiKey(newKey);
    setStoredApiKey(newKey);
    if (newKey.trim() && error?.includes('Gemini API Key')) {
      setError(null);
    }
  };

  // Chat Drawer state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInitialPrompt, setChatInitialPrompt] = useState<string | null>(null);

  // Mark essay submission
  const handleMarkEssay = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your free Gemini API Key in the User Settings panel above to start.');
      const panel = document.getElementById('user-settings-panel');
      if (panel) {
        panel.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    if (!essayText.trim()) {
      setError('Please provide or upload an essay before marking.');
      return;
    }

    try {
      setIsMarking(true);
      setError(null);

      const response = await fetch('/api/mark-essay', {
        method: 'POST',
        headers: getApiHeaders(apiKey),
        body: JSON.stringify({
          essayText,
          questionType,
          questionTitle,
          extractsText,
          apiKey,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to mark essay.');
      }

      const result: MarkingResult = await response.json();
      setMarkingResult(result);

      // Trigger confetti on high grades
      if (result.grade === 'A*' || result.grade === 'A') {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#4f46e5', '#10b981', '#0f172a'],
        });
      }

      // Scroll smoothly to dashboard
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while marking the essay.');
    } finally {
      setIsMarking(false);
    }
  };

  // Load preset exemplar
  const handleLoadBenchmark = (id: string) => {
    const exemplar = BENCHMARK_EXEMPLARS.find((b) => b.id === id);
    if (!exemplar) return;

    setQuestionType(exemplar.questionType);
    setQuestionTitle(exemplar.questionPrompt);
    setExtractsText(exemplar.extractsText || '');
    setEssayText(exemplar.essayText);
    setMarkingResult(null);
    setError(null);
    setActiveTab('marker');
  };

  // From Exemplar vault: load and immediately mark
  const handleLoadAndMark = (exemplar: BenchmarkExemplar) => {
    setQuestionType(exemplar.questionType);
    setQuestionTitle(exemplar.questionPrompt);
    setExtractsText(exemplar.extractsText || '');
    setEssayText(exemplar.essayText);
    setMarkingResult(null);
    setActiveTab('marker');
    setTimeout(() => {
      handleMarkEssay();
    }, 100);
  };

  // Open Chat with specific prompt
  const handleOpenChatWithPrompt = (prompt: string) => {
    setChatInitialPrompt(prompt);
    setIsChatOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-slate-800 flex flex-col font-sans">
      {/* High Density Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'chat') {
            setIsChatOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        hasMarkingResult={Boolean(markingResult)}
        onOpenChat={() => {
          setChatInitialPrompt(null);
          setIsChatOpen(true);
        }}
      />

      {/* User Settings Panel at top of interface */}
      <UserSettingsPanel
        apiKey={apiKey}
        onApiKeyChange={handleApiKeyChange}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4">
        {/* Error notification */}
        {error && (
          <div className="mb-4 p-4 bg-rose-50 border border-rose-300 rounded-lg text-rose-950 text-xs shadow-xs">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <div>
                  <h4 className="font-bold text-rose-900 text-sm">Examiner System Notice</h4>
                  <p className="text-slate-800 leading-relaxed mt-0.5">{error}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={handleMarkEssay}
                    disabled={isMarking}
                    className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded text-xs transition-colors shadow-2xs flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isMarking ? 'Retrying Examination...' : 'Retry Marking Now'}</span>
                  </button>

                  <button
                    onClick={() => setError(null)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-xs font-semibold transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Marker Studio */}
        {activeTab === 'marker' && (
          <div className="space-y-4">
            {markingResult ? (
              <MarkingDashboard
                result={markingResult}
                onOpenChatWithPrompt={handleOpenChatWithPrompt}
                onReset={() => setMarkingResult(null)}
              />
            ) : (
              <div className="space-y-4">
                {/* High-density informative banner */}
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                        AQA 7042 Certified Engine
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Official 25-Mark & 30-Mark Rubrics
                      </span>
                    </div>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900">
                      Automated Essay Examiner & Diagnostic Feedback
                    </h2>
                    <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                      Evaluates your historical knowledge, analyzes Question/Judgement links (Q/J), verifies evidence, and provides an actionable Level 5 upgrade roadmap.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setChatInitialPrompt(null);
                        setIsChatOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Ask AI Tutor</span>
                    </button>
                  </div>
                </div>

                {/* Input Studio */}
                <EssayInputSection
                  questionType={questionType}
                  setQuestionType={setQuestionType}
                  questionTitle={questionTitle}
                  setQuestionTitle={setQuestionTitle}
                  extractsText={extractsText}
                  setExtractsText={setExtractsText}
                  essayText={essayText}
                  setEssayText={setEssayText}
                  onSubmit={handleMarkEssay}
                  isMarking={isMarking}
                  onLoadBenchmark={handleLoadBenchmark}
                  apiKey={apiKey}
                />
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Benchmark Vault */}
        {activeTab === 'benchmarks' && (
          <ExemplarVault
            onLoadAndMark={handleLoadAndMark}
            onAskTutorAboutExemplar={(ex) => {
              handleOpenChatWithPrompt(`Let's discuss the ${ex.title} exemplar essay that scored ${ex.achievedMark}/${ex.maxMark} (${ex.achievedGrade}). What can I learn from this student's technique?`);
            }}
          />
        )}

        {/* Tab 3: Official Rubrics */}
        {activeTab === 'rubrics' && <RubricsGuide />}
      </main>

      {/* Floating Ask Tutor Button on mobile */}
      <button
        onClick={() => {
          setChatInitialPrompt(null);
          setIsChatOpen(true);
        }}
        className="fixed bottom-4 right-4 z-40 sm:hidden w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg border border-slate-700"
        title="Ask Tutor AI"
      >
        <Sparkles className="w-4 h-4 text-indigo-400" />
      </button>

      {/* AI Tutor Chat Drawer */}
      <AIChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        essayText={essayText}
        markingResult={markingResult}
        initialPrompt={chatInitialPrompt}
        apiKey={apiKey}
      />
    </div>
  );
}
