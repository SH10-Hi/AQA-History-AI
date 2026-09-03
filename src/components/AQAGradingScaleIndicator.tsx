import React, { useState } from 'react';
import { 
  Award, 
  TrendingUp, 
  CheckCircle2, 
  ArrowUpRight, 
  ChevronRight, 
  Sparkles, 
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Target
} from 'lucide-react';
import { MarkingResult, QuestionType } from '../types';

interface AQAGradingScaleIndicatorProps {
  result: MarkingResult;
  onOpenChatWithPrompt?: (prompt: string) => void;
  compact?: boolean;
}

interface LevelBandSpec {
  level: 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  title: string;
  minMark: number;
  maxMark: number;
  gradeLabel: string;
  shortSummary: string;
  fullAqaDescriptor: string;
  upgradeRequirementsToNext: string[];
  color: {
    bgActive: string;
    borderActive: string;
    textActive: string;
    badgeBg: string;
    badgeText: string;
    barColor: string;
  };
}

export const AQAGradingScaleIndicator: React.FC<AQAGradingScaleIndicatorProps> = ({
  result,
  onOpenChatWithPrompt,
  compact = false,
}) => {
  const isSource = result.questionType === 'source_30';
  const maxMarks = isSource ? 30 : 25;
  const currentMark = Math.min(Math.max(result.mark, 0), maxMarks);

  // Define official AQA level bands
  const bands: LevelBandSpec[] = isSource
    ? [
        {
          level: 'L1',
          title: 'Level 1',
          minMark: 1,
          maxMark: 6,
          gradeLabel: 'Grade U',
          shortSummary: 'Limited or single-extract understanding with vague context.',
          fullAqaDescriptor: 'Shows accurate understanding of one extract only or addresses extracts in a generalist way, showing limited accurate understanding of arguments. Limited understanding of historical context.',
          upgradeRequirementsToNext: [
            'Address at least two extracts directly rather than focusing on just one.',
            'Introduce basic accurate historical context rather than unsupported opinions.',
            'Identify the main argument/interpretation of each author.',
          ],
          color: {
            bgActive: 'bg-rose-50',
            borderActive: 'border-rose-400',
            textActive: 'text-rose-900',
            badgeBg: 'bg-rose-100',
            badgeText: 'text-rose-800',
            barColor: 'bg-rose-500',
          },
        },
        {
          level: 'L2',
          title: 'Level 2',
          minMark: 7,
          maxMark: 12,
          gradeLabel: 'Grade D / E',
          shortSummary: 'Accurate comment on 2+ extracts with context, but limited evaluation.',
          fullAqaDescriptor: 'Provides some accurate comment on the interpretations given in at least two of the extracts, with reference to historical context. Contains some analysis, but little, if any, evaluation.',
          upgradeRequirementsToNext: [
            'Examine ALL THREE extracts comprehensively with equal weighting.',
            'Begin evaluating the strength of arguments instead of simply summarizing them.',
            'Incorporate precise own knowledge (OK) to substantiate or challenge interpretations.',
          ],
          color: {
            bgActive: 'bg-amber-50',
            borderActive: 'border-amber-400',
            textActive: 'text-amber-900',
            badgeBg: 'bg-amber-100',
            badgeText: 'text-amber-800',
            barColor: 'bg-amber-500',
          },
        },
        {
          level: 'L3',
          title: 'Level 3',
          minMark: 13,
          maxMark: 18,
          gradeLabel: 'Grade B / C (18 = B)',
          shortSummary: 'Supported comment across all 3 extracts; good context with uneven depth.',
          fullAqaDescriptor: 'Provides supported comment on interpretations given in all three extracts and comments on the strength of these arguments in relation to historical context. Demonstrates an understanding of context.',
          upgradeRequirementsToNext: [
            'Assess the VALUE and UTILITY of each source rather than merely declaring it "biased and therefore unreliable".',
            'Deepen own knowledge: add specific acts, statistics, and dates to corroborate or dispute claims.',
            'Balance depth across all 3 extracts so no extract is treated cursorily.',
          ],
          color: {
            bgActive: 'bg-sky-50',
            borderActive: 'border-sky-400',
            textActive: 'text-sky-900',
            badgeBg: 'bg-sky-100',
            badgeText: 'text-sky-800',
            barColor: 'bg-sky-500',
          },
        },
        {
          level: 'L4',
          title: 'Level 4',
          minMark: 19,
          maxMark: 24,
          gradeLabel: 'Grade A / B',
          shortSummary: 'Good understanding of all 3 extracts, well-supported analysis with minor lapses.',
          fullAqaDescriptor: 'Shows a good understanding of interpretations in all three extracts and combines this with knowledge of historical context to analyse and evaluate interpretations. Convincing evaluation with minor limitations in depth/breadth.',
          upgradeRequirementsToNext: [
            'Integrate author provenance and tone seamlessly with the substance of the historical debate.',
            'Ensure historical context demonstrates nuanced awareness of the broader debate rather than isolated examples.',
            'Refine evaluation into sustained, convincing judgements on the value of each interpretation for an historian.',
          ],
          color: {
            bgActive: 'bg-indigo-50',
            borderActive: 'border-indigo-500',
            textActive: 'text-indigo-950',
            badgeBg: 'bg-indigo-100',
            badgeText: 'text-indigo-800',
            barColor: 'bg-indigo-600',
          },
        },
        {
          level: 'L5',
          title: 'Level 5',
          minMark: 25,
          maxMark: 30,
          gradeLabel: 'Grade A* (25+ = A*)',
          shortSummary: 'Mastery of all 3 extracts; convincing evaluation with sophisticated context.',
          fullAqaDescriptor: 'Shows very good understanding of interpretations put forward in all three extracts and combines this with strong awareness of historical context to analyse and evaluate interpretations. Well-supported, convincing evaluation throughout. (No conclusion required).',
          upgradeRequirementsToNext: [
            'Maintain maximum marks by ensuring absolute precision in historiographical arguments.',
            'Ensure no minor factual omissions or over-generalizations in any extract commentary.',
          ],
          color: {
            bgActive: 'bg-emerald-50',
            borderActive: 'border-emerald-500',
            textActive: 'text-emerald-950',
            badgeBg: 'bg-emerald-100',
            badgeText: 'text-emerald-800',
            barColor: 'bg-emerald-600',
          },
        },
      ]
    : [
        {
          level: 'L1',
          title: 'Level 1',
          minMark: 1,
          maxMark: 5,
          gradeLabel: 'Grade U',
          shortSummary: 'Demands of question not understood; extremely limited or vague content.',
          fullAqaDescriptor: 'The question has not been properly understood and the response shows limited organisational and communication skills. Information is irrelevant or extremely limited.',
          upgradeRequirementsToNext: [
            'Structure essay into separate thematic paragraphs with clear focus.',
            'Include identifiable historical events, dates, and historical figures relating to the title.',
            'Ensure paragraphs attempt to respond directly to the prompt question.',
          ],
          color: {
            bgActive: 'bg-rose-50',
            borderActive: 'border-rose-400',
            textActive: 'text-rose-900',
            badgeBg: 'bg-rose-100',
            badgeText: 'text-rose-800',
            barColor: 'bg-rose-500',
          },
        },
        {
          level: 'L2',
          title: 'Level 2',
          minMark: 6,
          maxMark: 10,
          gradeLabel: 'Grade D / E',
          shortSummary: 'Descriptive or partial; shows awareness but fails to grasp full demands.',
          fullAqaDescriptor: 'Descriptive or partial, showing some awareness of question but failure to grasp full demands. Attempt to convey material in organised way, but statements are mostly unsupported and generalist.',
          upgradeRequirementsToNext: [
            'Move beyond descriptive storytelling: adopt strict PEEL paragraph structure.',
            'Provide concrete historical evidence (dates, acts, key individuals) for every claim.',
            'Introduce explicit counter-arguments to provide essential balance.',
          ],
          color: {
            bgActive: 'bg-amber-50',
            borderActive: 'border-amber-400',
            textActive: 'text-amber-900',
            badgeBg: 'bg-amber-100',
            badgeText: 'text-amber-800',
            barColor: 'bg-amber-500',
          },
        },
        {
          level: 'L3',
          title: 'Level 3',
          minMark: 11,
          maxMark: 15,
          gradeLabel: 'Grade C (15 = C)',
          shortSummary: 'Sound knowledge and some balance; commentary lacks sustained Q/J links.',
          fullAqaDescriptor: 'Shows understanding of question and supplies largely accurate information, but may lack precision of detail. Good deal of comment with some balance, but statements may be inadequately supported or generalist.',
          upgradeRequirementsToNext: [
            'Establish explicit Question/Judgement (Q/J) links in every paragraph sentence.',
            'Replace broad assertions with specific quantitative data and precise historical terminology.',
            'Sustain comparative analysis weighing the relative significance of competing factors.',
          ],
          color: {
            bgActive: 'bg-sky-50',
            borderActive: 'border-sky-400',
            textActive: 'text-sky-900',
            badgeBg: 'bg-sky-100',
            badgeText: 'text-sky-800',
            barColor: 'bg-sky-500',
          },
        },
        {
          level: 'L4',
          title: 'Level 4',
          minMark: 16,
          maxMark: 20,
          gradeLabel: 'Grade B (18 = B)',
          shortSummary: 'Clear analytical structure with good evidence; judgement partially substantiated.',
          fullAqaDescriptor: 'Displays good understanding of demands of question. Well-organised with range of clear, specific supporting information. Analytical in style, well-balanced with some judgement, which may be partially substantiated.',
          upgradeRequirementsToNext: [
            'Ensure judgement is sustained and comparative throughout, not just tacked onto the conclusion.',
            'Use DISTINCT evidence across factors—avoid recycling the same treaties or examples across multiple paragraphs.',
            'Nuance the distinction between short-term catalysts and long-term structural causes.',
          ],
          color: {
            bgActive: 'bg-indigo-50',
            borderActive: 'border-indigo-500',
            textActive: 'text-indigo-950',
            badgeBg: 'bg-indigo-100',
            badgeText: 'text-indigo-800',
            barColor: 'bg-indigo-600',
          },
        },
        {
          level: 'L5',
          title: 'Level 5',
          minMark: 21,
          maxMark: 25,
          gradeLabel: 'Grade A / A* (24+ = A*)',
          shortSummary: 'Full mastery of question; sustained analytical judgement with precise evidence.',
          fullAqaDescriptor: 'Displays very good understanding of full demands of question. Supporting information is well-selected, specific and precise. Fully analytical with balanced argument and well-substantiated judgement throughout.',
          upgradeRequirementsToNext: [
            'Consolidate full marks (25/25) through effortless conceptual synthesis.',
            'Weigh immediate human or economic costs directly against long-term structural transformation.',
          ],
          color: {
            bgActive: 'bg-emerald-50',
            borderActive: 'border-emerald-500',
            textActive: 'text-emerald-950',
            badgeBg: 'bg-emerald-100',
            badgeText: 'text-emerald-800',
            barColor: 'bg-emerald-600',
          },
        },
      ];

  // Find active band based on student mark
  const currentBandIndex = bands.findIndex(
    (b) => currentMark >= b.minMark && currentMark <= b.maxMark
  );
  const activeBandIndex = currentBandIndex !== -1 ? currentBandIndex : bands.length - 1;
  const currentBand = bands[activeBandIndex];

  // Next band for upgrade roadmap
  const hasHigherBand = activeBandIndex < bands.length - 1;
  const nextBand = hasHigherBand ? bands[activeBandIndex + 1] : null;
  const marksToNextLevel = nextBand ? nextBand.minMark - currentMark : 0;

  const [selectedBandForModal, setSelectedBandForModal] = useState<LevelBandSpec | null>(null);
  const [activeTab, setActiveTab] = useState<'scale' | 'criteria'>('scale');

  // Bespoke criteria from server if available, otherwise official AQA upgrade requirements
  const upgradeCriteriaList =
    result.aqaScaleComparison?.specificCriteriaToAchieveHigherGrade?.length
      ? result.aqaScaleComparison.specificCriteriaToAchieveHigherGrade
      : currentBand.upgradeRequirementsToNext;

  const currentDemonstrations =
    result.aqaScaleComparison?.whatEssayCurrentlyDemonstrates?.length
      ? result.aqaScaleComparison.whatEssayCurrentlyDemonstrates
      : [
          currentBand.shortSummary,
          `Assessed within AQA ${currentBand.title} mark range (${currentBand.minMark}–${currentBand.maxMark} marks).`,
        ];

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
      {/* Header Banner: Assessed Grade & Scale Overview */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-extrabold bg-indigo-500/30 text-indigo-300 border border-indigo-400/40 px-2 py-0.5 rounded">
              Official AQA 7042 Assessment
            </span>
            <span className="text-xs text-slate-300 font-medium">
              {isSource ? '30-Mark Source Question Scale (L1–L5)' : '25-Mark Essay Scale (L1–L5)'}
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>Student Assessment:</span>
            <span className="text-emerald-400 font-mono font-black text-xl sm:text-2xl">
              Grade {result.grade}
            </span>
            <span className="text-slate-400 font-normal text-sm">
              ({result.mark} / {result.maxMarks} Marks • {result.level})
            </span>
          </h3>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            {result.levelDescriptor || currentBand.fullAqaDescriptor}
          </p>
        </div>

        {/* Distance to next level indicator card */}
        <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-lg p-3 sm:p-3.5 shrink-0 min-w-[200px] sm:min-w-[230px]">
          <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
            <span className="font-bold uppercase tracking-wider flex items-center gap-1 text-indigo-300">
              <Target className="w-3.5 h-3.5 text-indigo-400" />
              Scale Position
            </span>
            <span className="font-bold font-mono text-white">
              {Math.round((currentMark / maxMarks) * 100)}%
            </span>
          </div>

          <div className="text-sm font-bold text-white mb-1.5">
            {hasHigherBand ? (
              <div className="flex items-baseline gap-1.5">
                <span className="text-amber-300 font-mono font-black text-lg">
                  +{marksToNextLevel}
                </span>
                <span className="text-xs font-medium text-slate-200">
                  marks to <strong className="text-white">{nextBand?.title} ({nextBand?.gradeLabel})</strong>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-emerald-300">
                <Award className="w-4 h-4 text-emerald-400" />
                <span>Level 5 Pinnacle Band</span>
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-300 flex items-center justify-between border-t border-white/10 pt-1.5 mt-1">
            <span>Band: {currentBand.title} ({currentBand.minMark}–{currentBand.maxMark})</span>
            <span className="font-mono text-indigo-200 font-bold">{currentBand.gradeLabel}</span>
          </div>
        </div>
      </div>

      {/* Mode / View Switcher */}
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('scale')}
            className={`px-3 py-1 text-xs font-bold rounded transition-colors flex items-center gap-1.5 ${
              activeTab === 'scale'
                ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
            Visual Grading Scale (L1–L5)
          </button>
          <button
            onClick={() => setActiveTab('criteria')}
            className={`px-3 py-1 text-xs font-bold rounded transition-colors flex items-center gap-1.5 ${
              activeTab === 'criteria'
                ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            Criteria for Higher Grade
            {hasHigherBand && (
              <span className="ml-1 px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded text-[10px] font-mono">
                {nextBand?.title}
              </span>
            )}
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500 font-medium">
          <span>Click any level band to view official AQA standard</span>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="p-4 sm:p-6">
        {activeTab === 'scale' && (
          <div className="space-y-6">
            {/* Visual Multi-Segment Level Track */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  AQA Level Progression Ladder
                </span>
                <span className="text-xs font-semibold text-slate-600">
                  Current Position: <strong className="text-indigo-700 font-mono">{currentMark}/{maxMarks} Marks</strong> ({currentBand.title})
                </span>
              </div>

              {/* 5-Step Visual Band Bar */}
              <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {bands.map((band, idx) => {
                  const isActive = idx === activeBandIndex;
                  const isPast = idx < activeBandIndex;

                  return (
                    <div
                      key={band.level}
                      onClick={() => setSelectedBandForModal(band)}
                      className={`relative cursor-pointer group flex flex-col p-2 sm:p-2.5 rounded-lg border transition-all ${
                        isActive
                          ? `${band.color.bgActive} ${band.color.borderActive} ring-2 ring-indigo-500/20 shadow-xs`
                          : isPast
                          ? 'bg-slate-50/80 border-slate-200 hover:border-slate-300'
                          : 'bg-white border-slate-200/80 opacity-70 hover:opacity-100 hover:border-slate-300'
                      }`}
                    >
                      {/* Active Pin Marker */}
                      {isActive && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 bg-slate-900 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-sm tracking-wider flex items-center gap-1 shrink-0 whitespace-nowrap">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                          Assessed
                        </div>
                      )}

                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[11px] sm:text-xs font-black font-mono ${isActive ? band.color.textActive : 'text-slate-700'}`}>
                          {band.level}
                        </span>
                        <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${band.color.badgeBg} ${band.color.badgeText}`}>
                          {band.minMark}–{band.maxMark}m
                        </span>
                      </div>

                      <div className="text-[10px] font-bold truncate text-slate-600 mb-1">
                        {band.gradeLabel}
                      </div>

                      {/* Mini indicator bar */}
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-auto">
                        <div
                          className={`h-full ${band.color.barColor} transition-all duration-500`}
                          style={{
                            width: isActive
                              ? `${Math.max(20, Math.min(100, Math.round(((currentMark - band.minMark) / (band.maxMark - band.minMark + 1)) * 100)))}%`
                              : isPast
                              ? '100%'
                              : '0%',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Legend */}
              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 mt-2 px-1">
                <span>0 Marks (Ungraded)</span>
                <span className="font-semibold text-slate-700">
                  AQA Grade Boundaries: L1 (U) • L2 (D/E) • L3 (C/B) • L4 (B/A) • L5 (A*)
                </span>
                <span>{maxMarks} Marks (Full Standard)</span>
              </div>
            </div>

            {/* Active Band Breakdown & Distance to Higher Grade */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Left Column: Current Level Diagnostic */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                      ✓
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Current Assessed Band: {currentBand.title}
                    </h4>
                  </div>
                  <span className="text-xs font-mono font-bold text-indigo-700">
                    {result.mark} / {result.maxMarks} Marks
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed font-serif-essay">
                  "{currentBand.fullAqaDescriptor}"
                </p>

                <div className="space-y-1.5 pt-2 border-t border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    What your essay currently demonstrated:
                  </span>
                  {currentDemonstrations.slice(0, 3).map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Higher Grade Target */}
              <div className="p-4 bg-indigo-50/40 rounded-lg border border-indigo-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                      ↑
                    </div>
                    <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                      {hasHigherBand
                        ? `Next Level Target: ${nextBand?.title} (${nextBand?.gradeLabel})`
                        : 'Level 5 Full Mastery'}
                    </h4>
                  </div>
                  {hasHigherBand && (
                    <span className="text-xs font-mono font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                      +{marksToNextLevel} Marks Needed
                    </span>
                  )}
                </div>

                <p className="text-xs text-indigo-900 leading-relaxed">
                  {hasHigherBand
                    ? `To advance from ${currentBand.title} (${currentMark} marks) into ${nextBand?.title} (${nextBand?.minMark}–${nextBand?.maxMark} marks), examiners require meeting these criteria:`
                    : `You have attained the top AQA grade band (${currentBand.title}, Grade ${result.grade}). Continue honing precision to secure full 25/25 or 30/30.`}
                </p>

                <div className="space-y-1.5 pt-2 border-t border-indigo-200/60">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                    Key Criteria to meet for higher grade:
                  </span>
                  {upgradeCriteriaList.slice(0, 3).map((crit, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-800">
                      <ArrowUpRight className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                      <span className="font-medium">{crit}</span>
                    </div>
                  ))}
                </div>

                {onOpenChatWithPrompt && (
                  <button
                    onClick={() =>
                      onOpenChatWithPrompt(
                        `How can I improve my essay to reach ${nextBand?.title || 'full marks'} (${nextBand?.gradeLabel || 'Level 5'})? Specifically, what changes should I make to meet the criteria: "${upgradeCriteriaList[0]}"?`
                      )
                    }
                    className="w-full mt-2 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Ask AI Tutor How to Reach {nextBand?.title || 'Higher Marks'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Detailed Criteria Comparison Table */}
        {activeTab === 'criteria' && (
          <div className="space-y-4">
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Official AQA Mark Scheme Diagnostic Matrix
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Direct comparison between your essay's performance and the exact descriptor required for the higher grade.
                </p>
              </div>

              {hasHigherBand && (
                <div className="px-3 py-1 bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold rounded flex items-center gap-1.5 shrink-0">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                  Target: {nextBand?.minMark} marks (+{marksToNextLevel} marks)
                </div>
              )}
            </div>

            {/* Criteria Comparison Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Current Band Criteria */}
              <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                      Current: {currentBand.level}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {currentBand.gradeLabel} ({currentBand.minMark}–{currentBand.maxMark}m)
                    </span>
                  </div>
                  <span className="text-xs font-bold font-mono text-slate-500">
                    Awarded: {result.mark}m
                  </span>
                </div>

                <div>
                  <h5 className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider">
                    Official Level Descriptor
                  </h5>
                  <p className="text-xs text-slate-700 leading-relaxed font-serif-essay bg-slate-50 p-3 rounded border border-slate-100">
                    "{currentBand.fullAqaDescriptor}"
                  </p>
                </div>

                <div>
                  <h5 className="text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-wider">
                    Assessed Characteristics
                  </h5>
                  <ul className="space-y-2">
                    {currentDemonstrations.map((item, idx) => (
                      <li key={idx} className="text-xs text-slate-700 flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Higher Grade Criteria */}
              <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50/20 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-indigo-600 text-white font-mono">
                      Target: {nextBand?.level || 'L5 (Top)'}
                    </span>
                    <span className="text-xs font-bold text-indigo-950">
                      {nextBand?.gradeLabel || 'Level 5 Pinnacle'} ({nextBand ? `${nextBand.minMark}–${nextBand.maxMark}m` : `${maxMarks}m`})
                    </span>
                  </div>
                  <span className="text-xs font-bold font-mono text-indigo-700">
                    {hasHigherBand ? `Goal: ${nextBand?.minMark}m+` : 'Full Marks Goal'}
                  </span>
                </div>

                <div>
                  <h5 className="text-[10px] font-bold uppercase text-indigo-500 mb-1.5 tracking-wider">
                    Required Higher Descriptor
                  </h5>
                  <p className="text-xs text-slate-700 leading-relaxed font-serif-essay bg-white p-3 rounded border border-indigo-100">
                    "{nextBand?.fullAqaDescriptor || currentBand.fullAqaDescriptor}"
                  </p>
                </div>

                <div>
                  <h5 className="text-[10px] font-bold uppercase text-indigo-600 mb-2 tracking-wider">
                    Specific Criteria Needed to Advance
                  </h5>
                  <ul className="space-y-2">
                    {upgradeCriteriaList.map((crit, idx) => (
                      <li key={idx} className="text-xs text-slate-800 flex items-start gap-2 bg-white p-2 rounded border border-indigo-100 shadow-2xs">
                        <ArrowUpRight className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <span className="font-medium">{crit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Quick Action Bar */}
            <div className="p-3 bg-slate-900 text-white rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-300">
                <span>Want to see a real paragraph rewrite demonstrating these Level {nextBand?.level || '5'} criteria?</span>
              </div>
              {onOpenChatWithPrompt && (
                <button
                  onClick={() =>
                    onOpenChatWithPrompt(
                      `Please rewrite my introduction and first factor paragraph to demonstrate the specific criteria needed for ${nextBand?.title || 'Level 5'} (${nextBand?.gradeLabel || 'Grade A*'}). Explain what changes you made.`
                    )
                  }
                  className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded transition-colors shrink-0 flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Request Paragraph Upgrade in AI Tutor</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal for viewing any level band descriptor */}
      {selectedBandForModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-5 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-black px-2 py-0.5 rounded font-mono ${selectedBandForModal.color.badgeBg} ${selectedBandForModal.color.badgeText}`}>
                  {selectedBandForModal.level}
                </span>
                <h4 className="text-sm font-bold text-slate-900">
                  {selectedBandForModal.title} — {selectedBandForModal.gradeLabel} ({selectedBandForModal.minMark}–{selectedBandForModal.maxMark} Marks)
                </h4>
              </div>
              <button
                onClick={() => setSelectedBandForModal(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold px-1.5 py-0.5 rounded"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Official AQA 7042 Mark Scheme Text:
              </span>
              <p className="text-xs text-slate-700 leading-relaxed font-serif-essay bg-slate-50 p-3 rounded border border-slate-200">
                "{selectedBandForModal.fullAqaDescriptor}"
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Core Criteria & Examiner Focus:
              </span>
              <ul className="space-y-1.5">
                {selectedBandForModal.upgradeRequirementsToNext.map((req, i) => (
                  <li key={i} className="text-xs text-slate-700 flex items-start gap-2">
                    <span className="text-indigo-600 font-bold">•</span>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedBandForModal(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded text-xs font-bold hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
