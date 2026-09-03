export type QuestionType = 'essay_25' | 'source_30';

export interface RubricCriteria {
  name: string;
  scoreOut10: number;
  verdict: string;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export interface ParagraphFeedback {
  paragraphNumber: number;
  focusTitle: string;
  levelBand: 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  snippet: string;
  whatWentWell: string[];
  evenBetterIf: string[];
  historicalContextNotes: string;
  linkToQuestionQuality: 'Strong' | 'Adequate' | 'Weak/Missing';
}

export interface UpgradeAdvice {
  currentLevel: string;
  nextLevel: string;
  targetMarks: string;
  goldenRules: string[];
  recommendedEvidence: string[];
  sentenceMakeover: {
    original: string;
    upgraded: string;
    rationale: string;
  };
}

export interface AqaScaleComparison {
  scaleType: QuestionType;
  currentLevel: string;
  currentMark: number;
  maxMarks: number;
  grade: string;
  nextLevel: string;
  nextGrade: string;
  marksNeededForHigherGrade: number;
  specificCriteriaToAchieveHigherGrade: string[];
  whatEssayCurrentlyDemonstrates: string[];
  missingElementsKeepingInCurrentBand: string[];
}

export interface MarkingResult {
  questionType: QuestionType;
  questionTitle: string;
  mark: number;
  maxMarks: 25 | 30;
  level: 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  grade: 'A*' | 'A' | 'B' | 'C' | 'D' | 'E' | 'U';
  levelDescriptor: string;
  executiveSummary: string;
  rubricBreakdown: RubricCriteria[];
  paragraphAnalysis: ParagraphFeedback[];
  upgradeAdvice: UpgradeAdvice;
  aqaScaleComparison?: AqaScaleComparison;
  examinerTips: string[];
  wordCount: number;
}

export interface BenchmarkExemplar {
  id: string;
  title: string;
  topic: string;
  questionType: QuestionType;
  questionPrompt: string;
  achievedMark: number;
  maxMark: number;
  achievedLevel: string;
  achievedGrade: string;
  teacherSummary: string;
  keyTakeaway: string;
  essayText: string;
  extractsText?: string;
  teacherAnnotations: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}
