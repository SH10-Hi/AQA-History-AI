import React, { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, Check, AlertCircle, ExternalLink, Settings, ShieldCheck, Trash2 } from 'lucide-react';
import { getStoredApiKey, setStoredApiKey, clearStoredApiKey } from '../utils/apiKey';

interface UserSettingsPanelProps {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  className?: string;
}

export const UserSettingsPanel: React.FC<UserSettingsPanelProps> = ({
  apiKey,
  onApiKeyChange,
  className = '',
}) => {
  const [showKey, setShowKey] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Initialize or synchronize from localStorage
  useEffect(() => {
    const saved = getStoredApiKey();
    if (saved && saved !== apiKey) {
      onApiKeyChange(saved);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value.trim();
    onApiKeyChange(newKey);
    setStoredApiKey(newKey);
    setSaveFeedback(true);
    setTimeout(() => setSaveFeedback(false), 2000);
  };

  const handleClear = () => {
    clearStoredApiKey();
    onApiKeyChange('');
  };

  const hasKey = Boolean(apiKey && apiKey.trim().length > 5);

  return (
    <section
      id="user-settings-panel"
      aria-label="User Settings"
      className={`bg-white border-b border-slate-200 transition-all ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Header & Status Indicator */}
          <div className="flex items-center justify-between md:justify-start gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded flex items-center justify-center ${
                hasKey ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                <Settings className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    User Settings
                  </h2>
                  {hasKey ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      Saved in LocalStorage
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                      Key Required
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Configure your Gemini API key for private, direct essay evaluation.
                </p>
              </div>
            </div>

            {/* Mobile collapse toggle */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="md:hidden text-xs text-slate-500 hover:text-slate-800 underline"
            >
              {isCollapsed ? 'Show Settings' : 'Hide'}
            </button>
          </div>

          {/* Key Input Field & Google Link */}
          <div className={`flex-1 max-w-2xl ${isCollapsed ? 'hidden md:block' : 'block'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="gemini-api-key-input"
                    className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                  >
                    <Key className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Enter your free Gemini API Key to start</span>
                  </label>

                  {/* Clickable link pointing to google.com as requested */}
                  <a
                    id="link-get-gemini-key"
                    href="https://google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1 shrink-0"
                    title="Get your free Gemini API key on Google"
                  >
                    <span>Get your free key on Google</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="relative flex items-center">
                  <input
                    id="gemini-api-key-input"
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={handleChange}
                    placeholder="Paste your Gemini API Key here (e.g. AIzaSy...)"
                    className="w-full text-xs font-mono py-1.5 pl-3 pr-20 bg-slate-50 border border-slate-300 rounded focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                    autoComplete="off"
                    spellCheck="false"
                  />

                  <div className="absolute right-1.5 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded"
                      title={showKey ? 'Hide key' : 'Show key'}
                    >
                      {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>

                    {hasKey && (
                      <button
                        type="button"
                        onClick={handleClear}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        title="Remove saved key from LocalStorage"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Status or Save Confirmation */}
              <div className="sm:self-end sm:pb-0.5">
                {saveFeedback ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold transition-all shadow-2xs whitespace-nowrap">
                    <Check className="w-3.5 h-3.5" />
                    Saved!
                  </span>
                ) : hasKey ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-xs font-medium whitespace-nowrap">
                    <Check className="w-3 h-3 text-emerald-600" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-100 text-amber-800 rounded text-xs font-medium whitespace-nowrap">
                    Awaiting Key
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
