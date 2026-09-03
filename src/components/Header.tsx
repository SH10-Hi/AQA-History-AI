import React from 'react';
import { BookOpen, Sparkles, Award, FileText, Upload } from 'lucide-react';

interface HeaderProps {
  activeTab: 'marker' | 'benchmarks' | 'rubrics' | 'chat';
  setActiveTab: (tab: 'marker' | 'benchmarks' | 'rubrics' | 'chat') => void;
  hasMarkingResult: boolean;
  onOpenChat: () => void;
  onUploadClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  hasMarkingResult,
  onOpenChat,
  onUploadClick,
}) => {
  return (
    <header className="h-14 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 shrink-0">
      {/* Logo & Brand */}
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('marker')}>
        <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center shadow-xs">
          <span className="text-white font-bold text-xs italic">AQA</span>
        </div>
        <h1 className="font-bold text-base sm:text-lg tracking-tight text-slate-900 flex items-center gap-1.5">
          <span>History Marker</span>
          <span className="text-slate-400 font-normal text-xs sm:text-sm">v2.4</span>
        </h1>
      </div>

      {/* Center Nav Tabs */}
      <nav className="hidden md:flex items-center gap-1 text-xs">
        <button
          id="nav-tab-marker"
          onClick={() => setActiveTab('marker')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-medium transition-colors ${
            activeTab === 'marker'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Essay Marker</span>
        </button>

        <button
          id="nav-tab-benchmarks"
          onClick={() => setActiveTab('benchmarks')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-medium transition-colors ${
            activeTab === 'benchmarks'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Award className="w-3.5 h-3.5 text-amber-500" />
          <span>Benchmark Vault</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
            activeTab === 'benchmarks' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            5
          </span>
        </button>

        <button
          id="nav-tab-rubrics"
          onClick={() => setActiveTab('rubrics')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-medium transition-colors ${
            activeTab === 'rubrics'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Mark Schemes</span>
        </button>
      </nav>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3 text-xs">
        {/* System Active Status Badge */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-slate-600 font-medium">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span>System Active: AQA Mark Scheme 2024</span>
        </div>

        {/* AI Tutor Chat Trigger */}
        <button
          id="header-chat-btn"
          onClick={onOpenChat}
          className="relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded font-medium transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span className="hidden sm:inline">Ask Tutor AI</span>
          <span className="sm:hidden">Tutor</span>
          {hasMarkingResult && (
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping" />
          )}
        </button>

        {/* Upload New Essay Action */}
        <button
          id="header-upload-btn"
          onClick={() => {
            setActiveTab('marker');
            if (onUploadClick) onUploadClick();
          }}
          className="px-3 sm:px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium shadow-xs transition-colors flex items-center gap-1.5"
        >
          <Upload className="w-3.5 h-3.5 hidden sm:inline" />
          <span>Upload Essay</span>
        </button>
      </div>
    </header>
  );
};
