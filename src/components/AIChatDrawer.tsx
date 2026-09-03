import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  Sparkles, 
  Bot, 
  User, 
  RefreshCw, 
  BookOpen, 
  Copy, 
  Check, 
  Lightbulb
} from 'lucide-react';
import Markdown from 'react-markdown';
import { ChatMessage, MarkingResult } from '../types';
import { getStoredApiKey } from '../utils/apiKey';
import { chatWithHistorianDirect, formatGeminiErrorMessage } from '../services/geminiClient';

interface AIChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  essayText: string;
  markingResult: MarkingResult | null;
  initialPrompt?: string | null;
  apiKey?: string;
}

export const AIChatDrawer: React.FC<AIChatDrawerProps> = ({
  isOpen,
  onClose,
  essayText,
  markingResult,
  initialPrompt,
  apiKey,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      role: 'assistant',
      content: `Hello! I am your **AQA History Senior Examiner & AI Tutor**.\n\nI have the complete official AQA 7042 mark schemes and benchmark standard essays (including Seb's 24/25 Stalin essay, 18/25 Henry VII essay, and 15/25 1917 essay) loaded in my system.\n\n${
        markingResult
          ? `I see you just marked your essay: **${markingResult.questionTitle}**, achieving **${markingResult.mark}/${markingResult.maxMarks} (${markingResult.grade}, ${markingResult.level})**.\n\nHow can I help you improve? Would you like me to rewrite a specific paragraph into Level 5, suggest additional historical evidence/statistics, or practice planning your conclusion?`
          : `Ask me anything about AQA A-Level History essay structure, mark schemes, historical context, or essay planning!`
      }`,
      timestamp: Date.now(),
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  useEffect(() => {
    if (initialPrompt && isOpen) {
      sendMessage(initialPrompt);
    }
  }, [initialPrompt, isOpen]);

  const sendMessage = async (textToSend: string) => {
    const userText = textToSend.trim();
    if (!userText || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const key = apiKey || getStoredApiKey();
    if (!key) {
      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: 'Please enter your free Gemini API Key in the User Settings panel at the top of the page to chat with Master Historian AI.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setLoading(false);
      return;
    }

    try {
      // Direct client-side browser fetch to Google Gemini API
      const reply = await chatWithHistorianDirect(key, {
        message: userText,
        history: messages.map((m) => ({ role: m.role, content: m.content })),
        essayContext: essayText,
        markingResult: markingResult,
      });

      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: reply || 'No response received from tutor.',
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error(err);
      const friendlyError = formatGeminiErrorMessage(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Examiner System Notice:** ${friendlyError}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        {/* Chat Header */}
        <div className="h-12 px-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-slate-800 border border-slate-700 flex items-center justify-center">
              <Bot className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-bold text-xs tracking-tight flex items-center gap-1.5">
                <span>AQA Examiner AI Tutor</span>
                <span className="text-[9px] bg-indigo-600 text-white font-mono px-1 py-0.2 rounded">
                  7042
                </span>
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preset Prompt Suggestions */}
        <div className="p-2.5 bg-slate-50 border-b border-slate-200 overflow-x-auto flex gap-1.5 scrollbar-none">
          <button
            onClick={() => sendMessage("Why did I get this mark, and what is the single biggest flaw holding this essay back from Level 5?")}
            className="shrink-0 text-[11px] px-2.5 py-1 rounded bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 font-medium transition-colors shadow-2xs flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3 text-indigo-500" />
            <span>Why this mark?</span>
          </button>

          <button
            onClick={() => sendMessage("Can you suggest 3 precise historical statistics, dates, or acts that I should add to my essay to boost own knowledge (OK)?")}
            className="shrink-0 text-[11px] px-2.5 py-1 rounded bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 font-medium transition-colors shadow-2xs flex items-center gap-1"
          >
            <BookOpen className="w-3 h-3 text-blue-500" />
            <span>Give 3 facts/statistics</span>
          </button>

          <button
            onClick={() => sendMessage("Show me how to rewrite my conclusion so that it demonstrates a sustained, nuanced judgement (Level 5 standard).")}
            className="shrink-0 text-[11px] px-2.5 py-1 rounded bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 font-medium transition-colors shadow-2xs flex items-center gap-1"
          >
            <Lightbulb className="w-3 h-3 text-amber-500" />
            <span>Upgrade conclusion</span>
          </button>
        </div>

        {/* Message Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#F4F5F7]">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-2 ${
                msg.role === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              <div
                className={`w-6 h-6 rounded flex items-center justify-center shrink-0 mt-1 ${
                  msg.role === 'user'
                    ? 'bg-slate-900 text-white'
                    : 'bg-indigo-600 text-white'
                }`}
              >
                {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              <div
                className={`max-w-[85%] rounded p-3 text-xs leading-relaxed shadow-2xs relative group ${
                  msg.role === 'user'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-800 border border-slate-200'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-xs max-w-none text-slate-800 prose-headings:font-bold prose-headings:text-slate-900 prose-headings:mb-1 prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
                    <Markdown>{msg.content}</Markdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}

                {msg.role === 'assistant' && (
                  <button
                    onClick={() => handleCopy(msg.id, msg.content)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-opacity"
                    title="Copy text"
                  >
                    {copiedId === msg.id ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="bg-white border border-slate-200 rounded p-3 text-xs text-slate-600 flex items-center gap-2 shadow-2xs">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>Examiner AI is evaluating against AQA criteria...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <div className="p-3 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question or request a paragraph rewrite..."
              className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-colors shadow-2xs"
            />

            <button
              type="submit"
              disabled={loading || !input.trim()}
              className={`px-3 py-2 rounded text-white text-xs font-medium transition-colors shadow-xs ${
                loading || !input.trim()
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-slate-900 hover:bg-slate-800'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
