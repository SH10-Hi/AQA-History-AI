import React, { useState } from 'react';
import { Award, ArrowRight, Sparkles, MessageSquare } from 'lucide-react';
import { BENCHMARK_EXEMPLARS } from '../data/benchmarks';
import { BenchmarkExemplar } from '../types';

interface ExemplarVaultProps {
  onLoadAndMark: (exemplar: BenchmarkExemplar) => void;
  onAskTutorAboutExemplar: (exemplar: BenchmarkExemplar) => void;
}

export const ExemplarVault: React.FC<ExemplarVaultProps> = ({
  onLoadAndMark,
  onAskTutorAboutExemplar,
}) => {
  const [selectedExemplar, setSelectedExemplar] = useState<BenchmarkExemplar>(
    BENCHMARK_EXEMPLARS[0]
  );

  return (
    <div className="space-y-4">
      {/* Intro Header */}
      <div className="bg-white p-4 sm:p-5 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                Authentic Benchmark Vault
              </span>
              <span className="text-[11px] text-slate-400">Calibrated against Teacher-Marked Notebooks</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Benchmark Essays & Official Marking Annotations
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
              Authentic student essays used to calibrate the AI Examiner across AQA 7042 criteria. Inspect real margins, scores, and what separates an A* from a B or C.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">
              5 Calibrated Papers
            </span>
          </div>
        </div>
      </div>

      {/* Main Layout: Selector Sidebar + Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left List */}
        <div className="lg:col-span-4 space-y-2">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
            Select an Exemplar:
          </h3>

          {BENCHMARK_EXEMPLARS.map((ex) => {
            const isSelected = selectedExemplar.id === ex.id;
            return (
              <div
                key={ex.id}
                onClick={() => setSelectedExemplar(ex)}
                className={`p-3 rounded border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-indigo-50/70 border-indigo-600 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-medium text-slate-400 block truncate uppercase">
                      {ex.topic}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                      {ex.title}
                    </h4>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-indigo-700 block font-mono">
                      Grade {ex.achievedGrade}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {ex.achievedMark}/{ex.maxMark}
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100">
                  <span className="text-slate-500 truncate max-w-[170px]">
                    {ex.achievedLevel}
                  </span>
                  <span className="text-indigo-600 font-medium flex items-center gap-0.5 text-[10px] uppercase">
                    <span>Inspect</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Detail Pane */}
        <div className="lg:col-span-8 bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4">
          {/* Exemplar Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-600 text-white">
                  Grade {selectedExemplar.achievedGrade}
                </span>
                <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                  {selectedExemplar.achievedLevel}
                </span>
                <span className="text-xs font-bold font-mono text-slate-900">
                  {selectedExemplar.achievedMark} / {selectedExemplar.maxMark} Marks
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                {selectedExemplar.title}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 italic">
                {selectedExemplar.questionPrompt}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onLoadAndMark(selectedExemplar)}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-xs transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                <span>Test in Marker</span>
              </button>

              <button
                onClick={() => onAskTutorAboutExemplar(selectedExemplar)}
                className="flex items-center justify-center gap-1 px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                <span>Discuss</span>
              </button>
            </div>
          </div>

          {/* Teacher Commentary Card */}
          <div className="bg-slate-50 p-3.5 rounded border border-slate-200 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-indigo-600" />
              <span>Real Teacher Marking Commentary:</span>
            </span>
            <p className="text-xs italic font-serif-essay text-slate-800 leading-relaxed bg-white p-3 rounded border border-slate-200">
              "{selectedExemplar.teacherSummary}"
            </p>
          </div>

          {/* Key Diagnostic Takeaway */}
          <div className="bg-slate-50 p-3.5 rounded border border-slate-200 text-xs text-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Why Did It Score This Grade?</span>
            <p className="leading-relaxed text-slate-700">{selectedExemplar.keyTakeaway}</p>
          </div>

          {/* Teacher Margin Annotations */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Teacher Margin Annotations
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {selectedExemplar.teacherAnnotations.map((anno, i) => (
                <div key={i} className="text-xs p-2.5 rounded bg-slate-50 border border-slate-200 text-slate-800 flex items-start gap-1.5">
                  <span className="text-indigo-600 font-bold leading-none mt-0.5">•</span>
                  <span>{anno}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Full Essay Text */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Full Essay Text
              </h4>
              <span className="text-[10px] font-mono text-slate-400">
                {selectedExemplar.essayText.split(/\s+/).length} words
              </span>
            </div>
            <div className="p-3.5 bg-slate-50 rounded border border-slate-200 text-xs font-serif-essay leading-relaxed text-slate-800 max-h-80 overflow-y-auto whitespace-pre-wrap">
              {selectedExemplar.essayText}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
