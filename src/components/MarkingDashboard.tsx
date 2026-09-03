import React, { useState } from 'react';
import { 
  Award, 
  CheckCircle, 
  AlertTriangle, 
  Sparkles, 
  TrendingUp, 
  BookOpen, 
  FileText, 
  ArrowRight,
  Send,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  Check
} from 'lucide-react';
import { MarkingResult } from '../types';
import { BENCHMARK_EXEMPLARS } from '../data/benchmarks';
import { AQAGradingScaleIndicator } from './AQAGradingScaleIndicator';

interface MarkingDashboardProps {
  result: MarkingResult;
  onOpenChatWithPrompt: (prompt: string) => void;
  onReset: () => void;
}

export const MarkingDashboard: React.FC<MarkingDashboardProps> = ({
  result,
  onOpenChatWithPrompt,
  onReset,
}) => {
  const [viewMode, setViewMode] = useState<'annotated' | 'diagnostics'>('annotated');
  const [diagnosticTab, setDiagnosticTab] = useState<'overview' | 'paragraphs' | 'upgrade'>('overview');
  const [expandedParagraphs, setExpandedParagraphs] = useState<number[]>([1, 2]);
  const [askInput, setAskInput] = useState('');
  const [copiedPdf, setCopiedPdf] = useState(false);

  const toggleParagraph = (idx: number) => {
    setExpandedParagraphs((prev) =>
      prev.includes(idx) ? prev.filter((p) => p !== idx) : [...prev, idx]
    );
  };

  const handleAskAi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!askInput.trim()) return;
    onOpenChatWithPrompt(askInput.trim());
    setAskInput('');
  };

  const handleExportText = () => {
    const strengths = result.rubricBreakdown.flatMap(r => r.strengths);
    const weaknesses = result.rubricBreakdown.flatMap(r => r.improvements);
    const reportText = `AQA A-Level History Marking Report\nTitle: ${result.questionTitle}\nScore: ${result.mark}/${result.maxMarks} (${result.grade}, ${result.level})\n\nSummary:\n${result.executiveSummary}\n\nKey Strengths:\n${strengths.map(s => `• ${s}`).join('\n')}\n\nPriorities for Improvement:\n${weaknesses.map(w => `• ${w}`).join('\n')}`;
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AQA_History_Evaluation_${result.grade}.txt`;
    link.click();
    setCopiedPdf(true);
    setTimeout(() => setCopiedPdf(false), 2000);
  };

  const allStrengths = result.rubricBreakdown.flatMap(r => r.strengths);
  const allWeaknesses = result.rubricBreakdown.flatMap(r => r.improvements);

  // Check which level is active
  const isLevel5 = result.level.includes('5');
  const isLevel4 = result.level.includes('4');
  const isLevel3 = result.level.includes('3');
  const isLevel2 = result.level.includes('2');
  const isLevel1 = result.level.includes('1');

  const progressPercent = Math.min(Math.round((result.mark / result.maxMarks) * 100), 100);

  return (
    <div className="flex flex-col bg-[#F4F5F7] rounded-lg border border-slate-200 overflow-hidden shadow-xs">
      {/* Top Action Bar */}
      <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
            {result.questionType === 'source_30' ? '30-Mark Source' : '25-Mark Essay'}
          </span>
          <span className="text-xs font-semibold text-slate-700 truncate max-w-md hidden sm:inline">
            {result.questionTitle}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'annotated' ? 'diagnostics' : 'annotated')}
            className={`px-2.5 py-1 border rounded text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 ${
              viewMode === 'annotated'
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>{viewMode === 'annotated' ? 'Annotation View' : 'Diagnostic View'}</span>
          </button>

          <button
            onClick={handleExportText}
            className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1"
          >
            {copiedPdf ? <Check className="w-3 h-3 text-emerald-600" /> : <Download className="w-3 h-3" />}
            <span>{copiedPdf ? 'Saved' : 'Export'}</span>
          </button>

          <button
            onClick={onReset}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
          >
            New Essay
          </button>
        </div>
      </div>

      {/* Main Multi-Column High Density Layout */}
      <div className="flex flex-col lg:flex-row flex-1">
        {/* Left Aside: Recent Evaluations & Benchmarks */}
        <aside className="w-full lg:w-60 xl:w-64 border-r border-slate-200 bg-white flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-100">
            <h2 className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">
              Recent Evaluations
            </h2>
            <div className="space-y-1">
              {/* Active Evaluation */}
              <div className="p-2 bg-indigo-50 border-l-2 border-indigo-600 rounded-r">
                <p className="text-xs font-semibold truncate text-slate-900">
                  {result.questionTitle}
                </p>
                <p className="text-[10px] text-indigo-600 font-bold">
                  {result.mark}/{result.maxMarks} • Grade {result.grade}
                </p>
              </div>

              {/* Reference Benchmarks */}
              {BENCHMARK_EXEMPLARS.slice(0, 3).map((bm) => (
                <div
                  key={bm.id}
                  onClick={() => onOpenChatWithPrompt(`Compare my essay to the ${bm.title} exemplar (${bm.achievedMark}/${bm.maxMark}, Grade ${bm.achievedGrade}). What was the difference in depth of evidence?`)}
                  className="p-2 hover:bg-slate-50 cursor-pointer rounded transition-colors"
                >
                  <p className="text-xs font-medium truncate text-slate-700">{bm.title}</p>
                  <p className="text-[10px] text-slate-500">
                    {bm.achievedMark}/{bm.maxMark} • Grade {bm.achievedGrade}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 mt-auto">
            <div className="bg-slate-900 text-white p-3 rounded-lg shadow-2xs">
              <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                Comparison Baseline
              </p>
              <div className="flex justify-between items-end">
                <span className="text-xl font-bold font-mono text-indigo-300">
                  {result.grade === 'A*' ? 'A* Standard' : 'Top 5% Model'}
                </span>
                <span className="text-[10px] text-slate-300">
                  {result.wordCount} words
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Central Workspace */}
        <section className="flex-1 flex flex-col bg-slate-50 relative min-w-0">
          <div className="p-4 sm:p-6 flex flex-col flex-1">
            {/* Header Title Area */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-bold italic font-serif-essay text-slate-900 leading-tight">
                  {result.questionTitle}
                </h2>
                <p className="text-xs text-slate-500 italic mt-0.5">
                  AQA Specification 7042 • {result.questionType === 'source_30' ? 'Section A Source Extract' : 'Section B Essay'} (0–{result.maxMarks} marks)
                </p>
              </div>

              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => setDiagnosticTab('overview')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                    diagnosticTab === 'overview'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => {
                    setViewMode('diagnostics');
                    setDiagnosticTab('paragraphs');
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                    viewMode === 'diagnostics' && diagnosticTab === 'paragraphs'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Paragraphs ({result.paragraphAnalysis.length})
                </button>
                <button
                  onClick={() => {
                    setViewMode('diagnostics');
                    setDiagnosticTab('upgrade');
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                    viewMode === 'diagnostics' && diagnosticTab === 'upgrade'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Upgrade Roadmap
                </button>
              </div>
            </div>

            {/* Official AQA Grading Scale Visualizer */}
            <div className="mb-4">
              <AQAGradingScaleIndicator
                result={result}
                onOpenChatWithPrompt={onOpenChatWithPrompt}
              />
            </div>

            {/* View Mode 1: High Density Annotated Essay Viewer */}
            {viewMode === 'annotated' && (
              <div className="flex-1 bg-white p-5 sm:p-8 shadow-xs border border-slate-200 rounded leading-relaxed text-sm text-slate-700 relative overflow-y-auto max-h-[520px]">
                {/* Simulated / Real annotated paragraphs */}
                <div className="space-y-4 font-serif-essay text-slate-800 text-sm leading-relaxed pr-0 sm:pr-4">
                  {result.paragraphAnalysis.map((p, idx) => (
                    <div key={p.paragraphNumber} className="relative group">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-slate-400 font-sans">
                          PARAGRAPH {p.paragraphNumber}: {p.focusTitle.toUpperCase()}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-sans ${
                          p.levelBand.includes('5')
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.levelBand.includes('4')
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {p.levelBand}
                        </span>
                      </div>

                      <p className="mb-2">
                        {idx % 2 === 0 ? (
                          <>
                            <span className="bg-yellow-100 border-b-2 border-yellow-400 px-0.5">
                              {p.snippet}
                            </span>
                            {' '}
                            {p.historicalContextNotes && (
                              <span className="text-slate-600">
                                {p.historicalContextNotes}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="bg-blue-100 border-b-2 border-blue-400 px-0.5">
                              {p.snippet}
                            </span>
                            {' '}
                            {p.whatWentWell[0] && (
                              <span className="text-slate-600">
                                {p.whatWentWell[0]}
                              </span>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Floating High-Density AI Feedback Card */}
                <div className="mt-6 sm:absolute sm:bottom-6 sm:right-6 w-full sm:w-72 bg-slate-900 text-white p-3.5 rounded shadow-xl border border-slate-800">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-indigo-400" />
                      AI Examiner Verdict
                    </span>
                    <span className="text-[10px] bg-slate-700 text-slate-200 px-1.5 py-0.2 rounded font-mono font-bold">
                      {result.level}
                    </span>
                  </div>
                  <p className="text-xs leading-snug text-slate-200 line-clamp-4">
                    {result.executiveSummary}
                  </p>
                  <div className="mt-2.5 pt-2 border-t border-slate-800 flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 font-medium">Link-to-Q Quality: {result.paragraphAnalysis[0]?.linkToQuestionQuality || 'Strong'}</span>
                    <button
                      onClick={() => onOpenChatWithPrompt(`Can you explain why paragraph 1 was marked as ${result.paragraphAnalysis[0]?.levelBand} and how to improve it?`)}
                      className="text-[10px] text-indigo-300 font-bold hover:underline"
                    >
                      Discuss →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* View Mode 2: Diagnostics (Overview, Paragraphs, Upgrade) */}
            {viewMode === 'diagnostics' && (
              <div className="flex-1 bg-white p-5 shadow-xs border border-slate-200 rounded overflow-y-auto max-h-[520px] space-y-4">
                {diagnosticTab === 'overview' && (
                  <div className="space-y-4">
                    {/* Diagnostic Summary */}
                    <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Senior Examiner Appraisal
                        </span>
                        <span className="text-xs font-bold text-indigo-700">
                          Score: {result.mark}/{result.maxMarks} ({result.grade})
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-800 font-serif-essay leading-relaxed">
                        "{result.executiveSummary}"
                      </p>
                    </div>

                    {/* Rubric Criteria Grid */}
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        AQA Criteria Analysis
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {result.rubricBreakdown.map((item, idx) => (
                          <div key={idx} className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900">{item.name}</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                                {item.scoreOut10}/10 • {item.verdict}
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                              <div
                                className="bg-indigo-600 h-full rounded-full"
                                style={{ width: `${Math.min(item.scoreOut10 * 10, 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-slate-600 leading-snug">{item.feedback}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {diagnosticTab === 'paragraphs' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs text-slate-500 pb-1 border-b border-slate-100">
                      <span>Detailed line-by-line annotations for each paragraph:</span>
                      <button
                        onClick={() => {
                          if (expandedParagraphs.length === result.paragraphAnalysis.length) {
                            setExpandedParagraphs([]);
                          } else {
                            setExpandedParagraphs(result.paragraphAnalysis.map((_, i) => i + 1));
                          }
                        }}
                        className="text-indigo-600 font-semibold hover:underline"
                      >
                        {expandedParagraphs.length === result.paragraphAnalysis.length ? 'Collapse All' : 'Expand All'}
                      </button>
                    </div>

                    {result.paragraphAnalysis.map((para) => {
                      const isExpanded = expandedParagraphs.includes(para.paragraphNumber);
                      return (
                        <div key={para.paragraphNumber} className="border border-slate-200 rounded overflow-hidden">
                          <div
                            onClick={() => toggleParagraph(para.paragraphNumber)}
                            className="p-3 bg-slate-50 hover:bg-slate-100/80 cursor-pointer flex items-center justify-between transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center font-mono">
                                §{para.paragraphNumber}
                              </span>
                              <span className="text-xs font-bold text-slate-900">{para.focusTitle}</span>
                              <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded font-mono">
                                {para.levelBand}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenChatWithPrompt(`Can you help me rewrite paragraph ${para.paragraphNumber} ("${para.focusTitle}") to push it into Level 5? Give me the exact upgraded text.`);
                                }}
                                className="text-[10px] text-indigo-700 hover:text-indigo-900 font-bold px-2 py-0.5 bg-white border border-slate-200 rounded hover:bg-indigo-50"
                              >
                                Rewrite §{para.paragraphNumber}
                              </button>
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="p-3 bg-white space-y-2.5 text-xs">
                              <div className="p-2.5 bg-slate-50 border-l-2 border-indigo-600 font-serif-essay text-slate-700 italic">
                                "{para.snippet}"
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <div className="p-2.5 bg-emerald-50/60 border border-emerald-200 rounded">
                                  <span className="font-bold text-emerald-900 block mb-1">What Went Well (WWW):</span>
                                  <ul className="space-y-1 text-emerald-950">
                                    {para.whatWentWell.map((w, i) => (
                                      <li key={i} className="flex items-start gap-1">
                                        <span className="text-emerald-500">•</span>
                                        <span>{w}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                <div className="p-2.5 bg-rose-50/60 border border-rose-200 rounded">
                                  <span className="font-bold text-rose-900 block mb-1">Even Better If (EBI):</span>
                                  <ul className="space-y-1 text-rose-950">
                                    {para.evenBetterIf.map((e, i) => (
                                      <li key={i} className="flex items-start gap-1">
                                        <span className="text-rose-500">•</span>
                                        <span>{e}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {diagnosticTab === 'upgrade' && (
                  <div className="space-y-4">
                    {/* Golden Rules */}
                    <div className="p-3.5 bg-slate-900 text-white rounded space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-300">
                          Upgrade Target: {result.upgradeAdvice.nextLevel}
                        </span>
                        <span className="text-[10px] font-mono text-slate-300">
                          Target Band: {result.upgradeAdvice.targetMarks}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold">
                        Examiner Golden Rules to Elevate Your Essay
                      </h4>
                      <div className="space-y-1.5 pt-1">
                        {result.upgradeAdvice.goldenRules.map((rule, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-slate-200">
                            <span className="w-4 h-4 rounded bg-indigo-600 text-white flex items-center justify-center text-[9px] font-bold shrink-0 font-mono mt-0.5">
                              {idx + 1}
                            </span>
                            <span>{rule}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sentence Makeover */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded space-y-2.5">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        Academic Sentence Makeover (Level 5 Transformation)
                      </h4>
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-xs">
                        <span className="font-bold text-rose-900 block mb-0.5">Original Descriptive Sentence:</span>
                        <p className="italic font-serif-essay text-slate-800">
                          "{result.upgradeAdvice.sentenceMakeover.original}"
                        </p>
                      </div>
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs">
                        <span className="font-bold text-emerald-900 block mb-0.5">Level 5 Substantiated Makeover:</span>
                        <p className="italic font-serif-essay text-slate-900 font-medium">
                          "{result.upgradeAdvice.sentenceMakeover.upgraded}"
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        <span className="font-bold text-slate-800">Rationale: </span>
                        {result.upgradeAdvice.sentenceMakeover.rationale}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Inquiry Bar */}
            <form onSubmit={handleAskAi} className="h-12 mt-4 flex gap-2">
              <input
                type="text"
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
                placeholder="Ask AI about this specific grade or request a paragraph rewrite..."
                className="flex-1 bg-white border border-slate-300 rounded px-4 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 shadow-2xs"
              />
              <button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white px-5 rounded font-bold uppercase text-[10px] sm:text-xs tracking-wider transition-colors shrink-0"
              >
                Analyze
              </button>
            </form>
          </div>
        </section>

        {/* Right Aside: Official Mark Scheme Breakdown */}
        <aside className="w-full lg:w-72 xl:w-80 border-t lg:border-t-0 lg:border-l border-slate-200 bg-white flex flex-col p-4 shrink-0">
          <div className="mb-4">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-3">
              Official Mark Scheme Breakdown
            </h3>
            <div className="space-y-2">
              {/* Level 5 */}
              <div
                className={`relative flex items-center px-3 py-2 rounded transition-all ${
                  isLevel5
                    ? 'border border-indigo-600 bg-indigo-50/50 shadow-xs'
                    : 'border border-slate-100 opacity-60'
                }`}
              >
                {isLevel5 && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 rounded-l" />
                )}
                <div>
                  <p className={`text-[10px] font-bold ${isLevel5 ? 'text-indigo-700' : 'text-slate-700'}`}>
                    LEVEL 5 ({result.maxMarks === 30 ? '25–30' : '21–25'})
                  </p>
                  <p className="text-[9px] text-slate-600 leading-tight">
                    Full understanding, sustained analysis & balanced judgment.
                  </p>
                </div>
                {isLevel5 && (
                  <div className="ml-auto font-black text-indigo-700 italic text-sm font-mono">
                    {result.mark}
                  </div>
                )}
              </div>

              {/* Level 4 */}
              <div
                className={`relative flex items-center px-3 py-2 rounded transition-all ${
                  isLevel4
                    ? 'border border-indigo-600 bg-indigo-50/50 shadow-xs'
                    : 'border border-slate-100 opacity-60'
                }`}
              >
                {isLevel4 && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 rounded-l" />
                )}
                <div>
                  <p className={`text-[10px] font-bold ${isLevel4 ? 'text-indigo-700' : 'text-slate-700'}`}>
                    LEVEL 4 ({result.maxMarks === 30 ? '19–24' : '16–20'})
                  </p>
                  <p className="text-[9px] text-slate-500 leading-tight">
                    Good understanding, analytical structure with slight lapses.
                  </p>
                </div>
                {isLevel4 && (
                  <div className="ml-auto font-black text-indigo-700 italic text-sm font-mono">
                    {result.mark}
                  </div>
                )}
              </div>

              {/* Level 3 */}
              <div
                className={`relative flex items-center px-3 py-2 rounded transition-all ${
                  isLevel3
                    ? 'border border-indigo-600 bg-indigo-50/50 shadow-xs'
                    : 'border border-slate-100 opacity-40'
                }`}
              >
                {isLevel3 && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 rounded-l" />
                )}
                <div>
                  <p className={`text-[10px] font-bold ${isLevel3 ? 'text-indigo-700' : 'text-slate-700'}`}>
                    LEVEL 3 ({result.maxMarks === 30 ? '13–18' : '11–15'})
                  </p>
                  <p className="text-[9px] text-slate-500 leading-tight">
                    Sound knowledge, mostly descriptive without sustained Q/J.
                  </p>
                </div>
                {isLevel3 && (
                  <div className="ml-auto font-black text-indigo-700 italic text-sm font-mono">
                    {result.mark}
                  </div>
                )}
              </div>

              {/* Level 2 */}
              <div
                className={`relative flex items-center px-3 py-2 rounded transition-all ${
                  isLevel2
                    ? 'border border-indigo-600 bg-indigo-50/50 shadow-xs'
                    : 'border border-slate-100 opacity-20'
                }`}
              >
                {isLevel2 && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 rounded-l" />
                )}
                <div>
                  <p className={`text-[10px] font-bold ${isLevel2 ? 'text-indigo-700' : 'text-slate-700'}`}>
                    LEVEL 2 ({result.maxMarks === 30 ? '7–12' : '6–10'})
                  </p>
                </div>
                {isLevel2 && (
                  <div className="ml-auto font-black text-indigo-700 italic text-sm font-mono">
                    {result.mark}
                  </div>
                )}
              </div>

              {/* Level 1 */}
              <div
                className={`relative flex items-center px-3 py-2 rounded transition-all ${
                  isLevel1
                    ? 'border border-indigo-600 bg-indigo-50/50 shadow-xs'
                    : 'border border-slate-100 opacity-20'
                }`}
              >
                {isLevel1 && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 rounded-l" />
                )}
                <div>
                  <p className={`text-[10px] font-bold ${isLevel1 ? 'text-indigo-700' : 'text-slate-700'}`}>
                    LEVEL 1 ({result.maxMarks === 30 ? '1–6' : '1–5'})
                  </p>
                  <p className="text-[9px] text-slate-400 leading-tight">
                    Limited relevance, descriptive and partial understanding.
                  </p>
                </div>
                {isLevel1 && (
                  <div className="ml-auto font-black text-indigo-700 italic text-sm font-mono">
                    {result.mark}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Upgrade Criteria Required for Higher Grade */}
          <div className="mt-2 p-3 bg-indigo-50/60 border border-indigo-200 rounded">
            <div className="flex items-center justify-between mb-2 border-b border-indigo-200 pb-1">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-indigo-900">
                CRITERIA FOR HIGHER GRADE
              </h4>
              <span className="text-[9px] font-bold text-indigo-700 font-mono">
                {isLevel5 ? 'L5 Mastered' : 'Target: Next Level'}
              </span>
            </div>
            
            <div className="space-y-1.5 text-[10px]">
              {result.aqaScaleComparison?.specificCriteriaToAchieveHigherGrade?.length ? (
                result.aqaScaleComparison.specificCriteriaToAchieveHigherGrade.slice(0, 2).map((crit, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 text-slate-800">
                    <span className="text-indigo-600 font-bold">▲</span>
                    <span className="leading-tight">{crit}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-start gap-1.5 text-slate-800">
                  <span className="text-indigo-600 font-bold">▲</span>
                  <span className="leading-tight">
                    {isLevel5 
                      ? 'Deepen precision in conceptual synthesis across all themes.'
                      : 'Ensure all judgements are sustained and supported by distinct historical evidence.'}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => onOpenChatWithPrompt(`What specific criteria do I need to meet to move up from my current score of ${result.mark}/${result.maxMarks} (${result.grade}) to the next grade level?`)}
              className="w-full mt-2.5 py-1 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold transition-colors flex items-center justify-center gap-1 shadow-2xs"
            >
              <Sparkles className="w-3 h-3" />
              <span>Discuss Grade Criteria</span>
            </button>
          </div>

          {/* Criteria Checklist */}
          <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded">
            <h4 className="text-[10px] font-bold mb-2.5 border-b border-slate-200 pb-1 uppercase tracking-wider text-slate-600">
              CRITERIA DEMONSTRATED
            </h4>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <div className="mt-0.5 w-3.5 h-3.5 bg-green-100 rounded-full flex items-center justify-center border border-green-500 shrink-0">
                  <span className="text-[8px] text-green-700 font-bold">✓</span>
                </div>
                <p className="text-[10px] leading-tight text-slate-600">
                  {allStrengths[0] || 'Strong awareness of historical context (AQA Standard).'}
                </p>
              </div>

              <div className="flex items-start gap-2">
                <div className="mt-0.5 w-3.5 h-3.5 bg-green-100 rounded-full flex items-center justify-center border border-green-500 shrink-0">
                  <span className="text-[8px] text-green-700 font-bold">✓</span>
                </div>
                <p className="text-[10px] leading-tight text-slate-600">
                  {allStrengths[1] || 'Well-supported historical evaluation.'}
                </p>
              </div>

              <div className="flex items-start gap-2">
                <div className="mt-0.5 w-3.5 h-3.5 bg-orange-50 rounded-full flex items-center justify-center border border-orange-400 shrink-0">
                  <span className="text-[8px] text-orange-700 font-bold">!</span>
                </div>
                <p className="text-[10px] leading-tight text-slate-600">
                  {allWeaknesses[0] || 'Further depth required in domestic counter-evidence.'}
                </p>
              </div>
            </div>
          </div>

          {/* Final Grade Meter */}
          <div className="mt-auto pt-4 border-t border-slate-100">
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Final Grade</span>
              <span className="text-3xl font-black italic text-indigo-700 font-mono">
                {result.grade}
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-right mt-1 font-bold text-slate-400 uppercase font-mono">
              {result.mark} / {result.maxMarks} Marks ({progressPercent}%)
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};
