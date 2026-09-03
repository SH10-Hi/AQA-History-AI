import React, { useState } from 'react';
import { Award, CheckCircle } from 'lucide-react';
import { AQA_MARK_SCHEMES } from '../data/benchmarks';
import { QuestionType } from '../types';

export const RubricsGuide: React.FC = () => {
  const [selectedScheme, setSelectedScheme] = useState<QuestionType>('essay_25');

  const scheme = AQA_MARK_SCHEMES[selectedScheme];

  return (
    <div className="space-y-4">
      {/* Intro Header */}
      <div className="bg-white p-4 sm:p-5 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                Official AQA 7042 Criteria
              </span>
              <span className="text-[11px] text-slate-400">Examiner Standardisation Guide</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Generic Mark Schemes & Level Descriptors
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
              AQA examiners apply "best-fit" principles. To secure Level 4 and Level 5, students must demonstrate sustained analytical balance, substantiated judgement, and precise own knowledge.
            </p>
          </div>

          {/* Scheme Switcher */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200 shrink-0">
            <button
              onClick={() => setSelectedScheme('essay_25')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                selectedScheme === 'essay_25'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              25-Mark Essay (Sec B)
            </button>
            <button
              onClick={() => setSelectedScheme('source_30')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                selectedScheme === 'source_30'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30-Mark Source (Sec A)
            </button>
          </div>
        </div>
      </div>

      {/* Level Band Cards */}
      <div className="space-y-3">
        {scheme.levels.map((lvl) => {
          const isL5 = lvl.level === 'L5';
          const isL4 = lvl.level === 'L4';
          const isL3 = lvl.level === 'L3';

          return (
            <div
              key={lvl.level}
              className={`p-4 rounded-lg border transition-all ${
                isL5
                  ? 'bg-indigo-50/40 border-indigo-300'
                  : isL4
                  ? 'bg-slate-50/80 border-slate-300'
                  : isL3
                  ? 'bg-white border-slate-200'
                  : 'bg-white border-slate-200 opacity-90'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-7 h-7 rounded font-bold text-xs flex items-center justify-center font-mono ${
                      isL5
                        ? 'bg-indigo-600 text-white'
                        : isL4
                        ? 'bg-slate-800 text-white'
                        : isL3
                        ? 'bg-slate-600 text-white'
                        : 'bg-slate-400 text-white'
                    }`}
                  >
                    {lvl.level}
                  </span>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 font-mono">
                      {lvl.marks} Marks
                    </h3>
                    <span className="text-[11px] font-medium text-slate-500">
                      Grade Band: {lvl.grade}
                    </span>
                  </div>
                </div>

                {isL5 && (
                  <span className="text-[10px] font-bold bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-indigo-700" />
                    <span>Top Analytical Tier (A/A*)</span>
                  </span>
                )}
                {isL4 && (
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-300">
                    Solid Level 4 Standard (Grade B)
                  </span>
                )}
                {isL3 && (
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                    Threshold Level 3 (Grade C)
                  </span>
                )}
              </div>

              <div className="mt-2.5">
                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-serif-essay">
                  {lvl.description}
                </p>
              </div>

              {/* Examiner Context Callout */}
              <div className="mt-2.5 pt-2.5 border-t border-slate-200 text-xs text-slate-600 flex items-start gap-1.5">
                <Award className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  {isL5 && selectedScheme === 'essay_25' && (
                    <>
                      <strong className="text-slate-800">Examiner Benchmark:</strong> See Seb's Stalin 24/25 essay. Requires nuanced, fully substantiated judgement woven across paragraphs, with high quantitative evidence and sustained balance.
                    </>
                  )}
                  {isL4 && selectedScheme === 'essay_25' && (
                    <>
                      <strong className="text-slate-800">Examiner Benchmark:</strong> See Seb's Henry VII 18/25 essay. Good analytical style and specific facts, but judgment is only partially substantiated or factor evidence is repeated.
                    </>
                  )}
                  {isL3 && selectedScheme === 'essay_25' && (
                    <>
                      <strong className="text-slate-800">Examiner Benchmark:</strong> See Seb's February 1917 15/25 essay. Detailed factual recall, but falls into narrative storytelling without explicit, sustained links back to the Question and Judgement (Q/J).
                    </>
                  )}
                  {isL5 && selectedScheme === 'source_30' && (
                    <>
                      <strong className="text-slate-800">Examiner Benchmark:</strong> See Seb's Henry VIII 25/30 essay. Thoroughly evaluates all three extracts on argument, tone, provenance, and deep own knowledge. Note: <em>No overall conclusion is needed in source questions!</em>
                    </>
                  )}
                  {isL3 && selectedScheme === 'source_30' && (
                    <>
                      <strong className="text-slate-800">Examiner Benchmark:</strong> See Seb's Lenin NEP 18/30 essay. Strong factual context, but loses focus on the specific question asked or treats reliability as the sole measure of utility.
                    </>
                  )}
                  {(lvl.level === 'L2' || lvl.level === 'L1') && (
                    <>
                      <strong className="text-slate-800">Examiner Guidance:</strong> Responses here lack coherent structure, drift into general knowledge without answering the set question, or provide minimal factual evidence.
                    </>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
