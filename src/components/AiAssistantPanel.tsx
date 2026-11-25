import React, { useState } from 'react';
import { Loader2, Send, Sparkles } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../lib/api';
import type { DatasetRecord } from '../types';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const SUGGESTED_QUESTIONS = [
  'What does our Shannon diversity index indicate for this sample?',
  'Summarize the dominant taxa and highlight any unusual read-count patterns.',
  'What ecological limitations should be noted before drawing conservation conclusions?',
  'What follow-up sampling or primer validations would strengthen these findings?',
];

export function AiAssistantPanel({ dataset }: { dataset: DatasetRecord | null }) {
  const { notify } = useToast();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const sendQuestion = async (promptText: string) => {
    const clean = promptText.trim();
    if (!clean) return;

    const nextHistory = [...messages, { role: 'user' as const, text: clean }];
    setMessages(nextHistory);
    setQuestion('');
    setLoading(true);

    try {
      const res = await apiFetch<{ answer: string }>('/api/ai/interpret', {
        method: 'POST',
        body: JSON.stringify({
          question: clean,
          datasetId: dataset?.id || undefined,
          history: messages,
        }),
      });
      setMessages([...nextHistory, { role: 'assistant', text: res.answer }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to reach AI scientific assistant.';
      notify('AI Assistant Error', msg, 'error');
      setMessages([
        ...nextHistory,
        {
          role: 'assistant',
          text: `Unable to complete interpretation: ${msg}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E7EFEA] dark:border-[#143A2F] pb-4">
        <div>
          <h4 className="text-base font-semibold text-[#063B2B] dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#087A50] dark:text-[#55D6C2]" />
            AI Scientific Interpretation Assistant
          </h4>
          <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6] mt-0.5">
            {dataset
              ? `Grounded strictly in dataset "${dataset.dataset_name}". Distinguishes direct observations from ecological hypotheses.`
              : 'Ask methodological or biodiversity index questions. Attach an analyzed dataset for site-specific interpretation.'}
          </p>
        </div>
      </div>

      {/* Quick Prompt Buttons */}
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={loading}
            onClick={() => void sendQuestion(q)}
            className="text-left px-3 py-1.5 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] text-xs text-[#2E5547] dark:text-[#B9D8CA] hover:border-[#087A50] hover:text-[#063B2B] dark:hover:text-white transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Conversation History */}
      {messages.length > 0 && (
        <div className="max-h-96 overflow-y-auto space-y-3 rounded-lg border border-[#E7EFEA] dark:border-[#143A2F] bg-[#F9FCFA] dark:bg-[#071D17] p-4">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`rounded-lg p-3.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-[#087A50] text-white ml-auto max-w-2xl'
                  : 'bg-white dark:bg-[#0B271F] border border-[#D8E5DD] dark:border-[#143A2F] text-[#063B2B] dark:text-[#ECF5F0] mr-auto max-w-3xl'
              }`}
            >
              {m.text}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-[#4B6F61] dark:text-[#8FB7A6]">
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing dataset metrics and preparing scientific explanation...
            </div>
          )}
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendQuestion(question);
        }}
        className="flex gap-2.5"
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder='Ask e.g. "What does a Shannon diversity index of 2.4 indicate?"'
          className="flex-1 px-3.5 py-2.5 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#087A50] text-white text-sm font-medium hover:bg-[#063B2B] disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Ask Assistant
        </button>
      </form>
    </div>
  );
}
