import React from 'react';
import { 
  Search, 
  X, 
  Eye, 
  EyeOff, 
  Check, 
  ExternalLink, 
  Sparkles, 
  Zap, 
  Layers 
} from 'lucide-react';
import { GrokLogo } from './ModelProvidersSection.jsx';

export default function ApiKeysSection({
  localSettings = {},
  handleChange,
  handleSaveApiKey,
  savedKeyFeedback = {},
  showApiKey = {},
  setShowApiKey,
  apiKeySearchQuery = '',
  setApiKeySearchQuery,
  onClose
}) {
  const matchesSearch = (terms) => {
    if (!apiKeySearchQuery || !apiKeySearchQuery.trim()) return true;
    const q = apiKeySearchQuery.toLowerCase();
    return terms.some(t => t.toLowerCase().includes(q));
  };

  return (
    <div className="space-y-6">
      {/* Top Header (Matching Image 3) */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">API keys</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Keys for AI providers and optional services. Paste a key and it saves and checks itself.
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Keys Input (Matching Image 3) */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search keys"
          value={apiKeySearchQuery}
          onChange={(e) => setApiKeySearchQuery(e.target.value)}
          className="w-full bg-[#0d1322] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
        />
      </div>

      {/* AI providers Section (Matching Image 3) */}
      <div className="space-y-4">
        <div className="border-b border-slate-800/80 pb-2">
          <h3 className="text-sm font-bold text-white">AI providers</h3>
          <p className="text-xs text-slate-400 mt-0.5">Keys for the models your bots run on.</p>
        </div>

        <div className="space-y-5">
          {/* 1. Google Gemini API Key */}
          {matchesSearch(['gemini', 'google', 'cloud']) && (
            <div className="p-4 rounded-2xl border border-slate-800 bg-[#0d1322]/80 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Google Gemini API key</h4>
                  <p className="text-[11px] text-slate-400">Gemini 2.0 Flash, Flash-Lite, and Pro models</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showApiKey.gemini ? "text" : "password"}
                    value={localSettings.gemini_api_key || ''}
                    onChange={(e) => handleChange('gemini_api_key', e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-[#0a0e1a] border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(p => ({ ...p, gemini: !p.gemini }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showApiKey.gemini ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <button
                  onClick={() => handleSaveApiKey('gemini_api_key')}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold shrink-0 transition flex items-center gap-1.5 cursor-pointer"
                >
                  {savedKeyFeedback.gemini_api_key ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Saved</span>
                    </>
                  ) : (
                    <span>Save</span>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-slate-500">Direct Cloud API with free generous quota from Google AI Studio.</span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <span>Get a key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* 2. OpenAI API Key (Matching Image 3) */}
          {matchesSearch(['openai', 'gpt', 'codex', 'chatgpt']) && (
            <div className="p-4 rounded-2xl border border-slate-800 bg-[#0d1322]/80 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">OpenAI API key</h4>
                  <p className="text-[11px] text-slate-400">OpenAI models, reply readout and live calls</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showApiKey.openai ? "text" : "password"}
                    value={localSettings.openai_api_key || ''}
                    onChange={(e) => handleChange('openai_api_key', e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-[#0a0e1a] border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(p => ({ ...p, openai: !p.openai }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showApiKey.openai ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <button
                  onClick={() => handleSaveApiKey('openai_api_key')}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold shrink-0 transition flex items-center gap-1.5 cursor-pointer"
                >
                  {savedKeyFeedback.openai_api_key ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Saved</span>
                    </>
                  ) : (
                    <span>Save</span>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-slate-500">Codex doesn't use this key. It signs in with ChatGPT.</span>
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <span>Get a key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* 3. Anthropic API Key (Matching Image 3) */}
          {matchesSearch(['anthropic', 'claude', 'sonnet', 'haiku']) && (
            <div className="p-4 rounded-2xl border border-slate-800 bg-[#0d1322]/80 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-black text-base">
                  ✱
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Anthropic API key</h4>
                  <p className="text-[11px] text-slate-400">Claude models, billed per token</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showApiKey.claude ? "text" : "password"}
                    value={localSettings.anthropic_api_key || ''}
                    onChange={(e) => handleChange('anthropic_api_key', e.target.value)}
                    placeholder="sk-ant-..."
                    className="w-full bg-[#0a0e1a] border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(p => ({ ...p, claude: !p.claude }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showApiKey.claude ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <button
                  onClick={() => handleSaveApiKey('anthropic_api_key')}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold shrink-0 transition flex items-center gap-1.5 cursor-pointer"
                >
                  {savedKeyFeedback.anthropic_api_key ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Saved</span>
                    </>
                  ) : (
                    <span>Save</span>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-slate-500">Claude 3.7 Sonnet, 3.5 Haiku, and Opus models.</span>
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <span>Get a key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* 4. xAI API Key (Matching Image 3) */}
          {matchesSearch(['xai', 'grok', 'twitter', 'musk']) && (
            <div className="p-4 rounded-2xl border border-slate-800 bg-[#0d1322]/80 space-y-3">
              <div className="flex items-center gap-3">
                <GrokLogo className="w-9 h-9" />
                <div>
                  <h4 className="text-xs font-bold text-white">xAI API key</h4>
                  <p className="text-[11px] text-slate-400">Grok models and xAI pictures</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showApiKey.xai ? "text" : "password"}
                    value={localSettings.xai_api_key || ''}
                    onChange={(e) => handleChange('xai_api_key', e.target.value)}
                    placeholder="xai-..."
                    className="w-full bg-[#0a0e1a] border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(p => ({ ...p, xai: !p.xai }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showApiKey.xai ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <button
                  onClick={() => handleSaveApiKey('xai_api_key')}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold shrink-0 transition flex items-center gap-1.5 cursor-pointer"
                >
                  {savedKeyFeedback.xai_api_key ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Saved</span>
                    </>
                  ) : (
                    <span>Save</span>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-slate-500">Grok 2 and Grok Vision models via xAI platform.</span>
                <a
                  href="https://console.x.ai/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <span>Get a key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* 5. OpenRouter API Key (Matching Image 3) */}
          {matchesSearch(['openrouter', 'router', 'multi']) && (
            <div className="p-4 rounded-2xl border border-slate-800 bg-[#0d1322]/80 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">OpenRouter API key</h4>
                  <p className="text-[11px] text-slate-400">Hundreds of models through one key</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showApiKey.openrouter ? "text" : "password"}
                    value={localSettings.openrouter_api_key || ''}
                    onChange={(e) => handleChange('openrouter_api_key', e.target.value)}
                    placeholder="sk-or-v1-..."
                    className="w-full bg-[#0a0e1a] border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(p => ({ ...p, openrouter: !p.openrouter }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showApiKey.openrouter ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <button
                  onClick={() => handleSaveApiKey('openrouter_api_key')}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold shrink-0 transition flex items-center gap-1.5 cursor-pointer"
                >
                  {savedKeyFeedback.openrouter_api_key ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Saved</span>
                    </>
                  ) : (
                    <span>Save</span>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-slate-500">Access DeepSeek, Llama 3, Gemini, Claude, and GPT with unified balance.</span>
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <span>Get a key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
