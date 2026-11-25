import React, { useState, useMemo } from 'react';
import { 
  RefreshCw, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  HardDrive, 
  User, 
  ExternalLink, 
  CheckCircle2, 
  Sparkles, 
  Terminal,
  Zap,
  Search,
  Key,
  ShieldCheck,
  Cpu,
  Radio,
  ArrowRight,
  Info,
  Copy
} from 'lucide-react';

import {
  GeminiLogo,
  AntigravityLogo,
  ClaudeLogo,
  OpenAILogo,
  CursorLogo,
  GrokLogo,
  KimiLogo,
  DroidLogo,
  CopilotBrandLogo,
  CommandCodeLogo,
  OllamaLogo,
  DeepSeekLogo,
  MistralLogo,
  OpenRouterLogo,
  getProviderLogo
} from './ProviderIcons.jsx';

// Re-export for full backward compatibility across the codebase
export {
  GeminiLogo,
  AntigravityLogo,
  ClaudeLogo,
  OpenAILogo,
  CursorLogo,
  GrokLogo,
  KimiLogo,
  DroidLogo,
  CopilotBrandLogo,
  CommandCodeLogo,
  OllamaLogo,
  DeepSeekLogo,
  MistralLogo,
  OpenRouterLogo,
  getProviderLogo
};

export default function ModelProvidersSection({
  providersData = { ready: [], needsSetup: [] },
  fetchProvidersStatus,
  isCheckingProviders = false,
  handleCleanTempFiles,
  cleaningTemp = false,
  cleanFeedback = null,
  expandedProvider = { antigravity: true },
  setExpandedProvider,
  cliPathOpen = false,
  setCliPathOpen,
  onSaveSetting,
  showNotification,
  onNavigateToApiKeys,
  localSettings = {},
  handleChange = null
}) {
  const [testingEngine, setTestingEngine] = useState(false);
  const [engineTestFeedback, setEngineTestFeedback] = useState(null);
  const [antigravitySetupOpen, setAntigravitySetupOpen] = useState(false);
  
  // UI filter & search states
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'ready' | 'needsSetup' | 'cli' | 'cloud'
  const [searchQuery, setSearchQuery] = useState('');
  const [inlineSetupId, setInlineSetupId] = useState(null);
  const [inlineKeyValue, setInlineKeyValue] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [copiedBinaryPath, setCopiedBinaryPath] = useState(false);

  const readyList = providersData.ready || [];
  const antigravityReady = readyList.find(p => p.id === 'antigravity');
  const antigravityEmail = antigravityReady?.email || 'No account authenticated';
  const antigravityVersion = antigravityReady?.version || 'v1.5.10';

  // Active provider / Primary Brain calculation
  const currentActiveProvider = localSettings?.active_provider || providersData?.activeProvider || (readyList.length > 0 ? readyList[0].id : 'gemini');

  // Handle setting primary brain
  const handleSetActiveBrain = (providerId) => {
    if (onSaveSetting) {
      onSaveSetting('active_provider', providerId);
      if (showNotification) {
        showNotification(`Primary Brain switched to ${providerId.toUpperCase()}`, 'success');
      }
      if (fetchProvidersStatus) {
        fetchProvidersStatus();
      }
    }
  };

  const handleTestAntigravity = async (customPath) => {
    setTestingEngine(true);
    setEngineTestFeedback(null);
    try {
      const res = await fetch('/api/settings/antigravity/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPath: customPath || localSettings?.antigravity_custom_path })
      });
      const data = await res.json();
      if (data.success) {
        setEngineTestFeedback({ type: 'success', text: data.message });
        if (showNotification) showNotification(data.message, 'success');
        if (fetchProvidersStatus) fetchProvidersStatus();
      } else {
        setEngineTestFeedback({ type: 'error', text: data.error || 'Connection failed' });
        if (showNotification) showNotification(`Connection failed: ${data.error}`, 'error');
      }
    } catch (err) {
      setEngineTestFeedback({ type: 'error', text: err.message });
      if (showNotification) showNotification(err.message, 'error');
    } finally {
      setTestingEngine(false);
    }
  };

  const handleLaunchAntigravityLogin = async (customPath) => {
    try {
      const res = await fetch('/api/settings/antigravity/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPath: customPath || localSettings?.antigravity_custom_path })
      });
      const data = await res.json();
      if (data.success) {
        if (showNotification) showNotification(data.message, 'info');
      } else {
        if (showNotification) showNotification(`Login error: ${data.error}`, 'error');
      }
    } catch (err) {
      if (showNotification) showNotification(err.message, 'error');
    }
  };

  // Comprehensive catalog of all supported model providers
  const allNeedsSetupCandidates = useMemo(() => [
    !antigravityReady ? {
      id: 'antigravity',
      name: 'Google Gemini (Antigravity)',
      vendor: 'Google DeepMind',
      type: 'local',
      category: 'cli',
      modelsDesc: 'Gemini 3.8 Flash, Pro & Thought Models via ACP',
      docsUrl: 'https://deepmind.google/technologies/gemini/',
      apiKeyTarget: null
    } : null,
    {
      id: 'gemini',
      name: 'Google Gemini (Cloud API)',
      vendor: 'Google AI Studio',
      type: 'api',
      category: 'cloud',
      modelsDesc: 'Gemini 2.5 Flash, 2.0 Flash & Gemini 1.5 Pro',
      docsUrl: 'https://aistudio.google.com/app/apikey',
      apiKeyTarget: 'gemini_api_key'
    },
    {
      id: 'openai',
      name: 'OpenAI / Codex',
      vendor: 'OpenAI',
      type: 'api/cli',
      category: 'cloud',
      modelsDesc: 'GPT-4o, o3-mini, o1 Reasoning & Codex CLI',
      docsUrl: 'https://platform.openai.com/api-keys',
      apiKeyTarget: 'openai_api_key'
    },
    {
      id: 'claude',
      name: 'Anthropic Claude (Sonnet 3.7)',
      vendor: 'Anthropic',
      type: 'api/cli',
      category: 'cloud',
      modelsDesc: 'Claude 3.7 Sonnet, 3.5 Haiku & Opus',
      docsUrl: 'https://console.anthropic.com/',
      apiKeyTarget: 'anthropic_api_key'
    },
    {
      id: 'cursor',
      name: 'Cursor AI (Agent & Editor)',
      vendor: 'Anysphere',
      type: 'cli',
      category: 'cli',
      modelsDesc: 'Local Cursor IDE Session & Background Agent',
      docsUrl: 'https://www.cursor.com/',
      apiKeyTarget: null
    },
    {
      id: 'xai',
      name: 'Grok',
      vendor: 'xAI',
      type: 'api',
      category: 'cloud',
      modelsDesc: 'Grok 2, Grok 3 & Grok Vision models',
      docsUrl: 'https://x.ai/api',
      apiKeyTarget: 'xai_api_key'
    },
    {
      id: 'kimi',
      name: 'Kimi',
      vendor: 'Moonshot AI',
      type: 'api',
      category: 'cloud',
      modelsDesc: 'Kimi 1.5 & Moonshot 128k Long-Context',
      docsUrl: 'https://platform.moonshot.cn/',
      apiKeyTarget: 'kimi_api_key'
    },
    {
      id: 'droid',
      name: 'Droid',
      vendor: 'Factory',
      type: 'agent',
      category: 'cli',
      modelsDesc: 'Factory.ai Autonomous Software Engineering Droid',
      docsUrl: 'https://factory.ai/',
      apiKeyTarget: 'droid_api_key'
    },
    {
      id: 'copilot',
      name: 'GitHub Copilot',
      vendor: 'GitHub',
      type: 'cli',
      category: 'cli',
      modelsDesc: 'GitHub Copilot CLI & VSCode Extension Bridge',
      docsUrl: 'https://github.com/features/copilot',
      apiKeyTarget: null
    },
    {
      id: 'commandcode',
      name: 'Command Code',
      vendor: 'Cohere',
      type: 'api',
      category: 'cloud',
      modelsDesc: 'Cohere Command R & Command R+ Enterprise Models',
      docsUrl: 'https://cohere.com/',
      apiKeyTarget: 'cohere_api_key'
    },
    {
      id: 'ollama',
      name: 'Local Ollama Runtime',
      vendor: 'Local Machine',
      type: 'local',
      category: 'cli',
      modelsDesc: '100% Offline Models (Llama 3.3, DeepSeek-R1, Mistral)',
      docsUrl: 'https://ollama.com/',
      apiKeyTarget: null
    },
    {
      id: 'deepseek',
      name: 'DeepSeek AI',
      vendor: 'DeepSeek',
      type: 'api',
      category: 'cloud',
      modelsDesc: 'DeepSeek-V3 & DeepSeek-R1 Open Reasoning',
      docsUrl: 'https://platform.deepseek.com/',
      apiKeyTarget: 'deepseek_api_key'
    },
    {
      id: 'mistral',
      name: 'Mistral AI',
      vendor: 'Mistral AI',
      type: 'api',
      category: 'cloud',
      modelsDesc: 'Mistral Large, Codestral & Pixtral 12B',
      docsUrl: 'https://console.mistral.ai/',
      apiKeyTarget: 'mistral_api_key'
    },
    {
      id: 'openrouter',
      name: 'OpenRouter',
      vendor: 'OpenRouter',
      type: 'api',
      category: 'cloud',
      modelsDesc: 'Unified Gateway: Access 100+ Models with 1 Key',
      docsUrl: 'https://openrouter.ai/keys',
      apiKeyTarget: 'openrouter_api_key'
    }
  ].filter(Boolean), [antigravityReady]);

  // Compute pending setup list (filter out those already ready)
  const pendingList = useMemo(() => {
    return allNeedsSetupCandidates.filter(c => {
      const isReady = readyList.some(r => {
        if (r.id === c.id) return true;
        if (r.id === 'xai' && c.id === 'grok') return true;
        if (r.id === 'grok' && c.id === 'xai') return true;
        return false;
      });
      return !isReady;
    });
  }, [allNeedsSetupCandidates, readyList]);

  // Handle Quick Inline API Key Save
  const handleSaveInlineKey = async (provider) => {
    if (!provider.apiKeyTarget) {
      if (onNavigateToApiKeys) onNavigateToApiKeys(provider.id);
      return;
    }
    const val = inlineKeyValue.trim();
    if (!val) {
      if (showNotification) showNotification('Please enter a valid API key or token', 'error');
      return;
    }

    setIsSavingKey(true);
    try {
      if (onSaveSetting) {
        onSaveSetting(provider.apiKeyTarget, val);
        onSaveSetting('active_provider', provider.id);
      }
      if (showNotification) {
        showNotification(`${provider.name} connected successfully! Switched to active brain.`, 'success');
      }
      setInlineSetupId(null);
      setInlineKeyValue('');
      if (fetchProvidersStatus) {
        setTimeout(fetchProvidersStatus, 300);
      }
    } catch (err) {
      if (showNotification) showNotification(`Failed to save key: ${err.message}`, 'error');
    } finally {
      setIsSavingKey(false);
    }
  };

  // Filter lists based on search query and category pill
  const filteredReady = readyList.filter(p => {
    if (activeFilter === 'needsSetup') return false;
    if (activeFilter === 'cli' && p.type !== 'cli' && p.type !== 'acp' && p.type !== 'local') return false;
    if (activeFilter === 'cloud' && p.type !== 'api') return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.id?.toLowerCase().includes(q) ||
      p.subtitle?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q)
    );
  });

  const filteredPending = pendingList.filter(p => {
    if (activeFilter === 'ready') return false;
    if (activeFilter === 'cli' && p.category !== 'cli') return false;
    if (activeFilter === 'cloud' && p.category !== 'cloud') return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.id?.toLowerCase().includes(q) ||
      p.vendor?.toLowerCase().includes(q) ||
      p.modelsDesc?.toLowerCase().includes(q)
    );
  });

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text);
    setCopiedBinaryPath(true);
    setTimeout(() => setCopiedBinaryPath(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Model providers and accounts
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {readyList.length} Connected
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Connect the AI tools that power your bots. Accounts, setup and updates, all in one place.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchProvidersStatus}
            disabled={isCheckingProviders}
            className="px-3.5 py-2 rounded-xl border border-slate-700/80 bg-slate-900/90 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition flex items-center gap-2 shadow-sm active:scale-95 cursor-pointer disabled:opacity-60"
            title="Scan system PATH, active binaries and API tokens"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingProviders ? 'animate-spin text-indigo-400' : 'text-slate-400'}`} />
            <span>{isCheckingProviders ? 'Scanning...' : 'Check again'}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-1.5 rounded-2xl bg-[#0c1220]/80 border border-slate-800/80">
        {/* Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'All Providers', count: readyList.length + pendingList.length },
            { id: 'ready', label: 'Ready', count: readyList.length },
            { id: 'needsSetup', label: 'Needs Setup', count: pendingList.length },
            { id: 'cli', label: 'CLI & Local' },
            { id: 'cloud', label: 'Cloud API' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeFilter === f.id
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>{f.label}</span>
              {typeof f.count === 'number' && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeFilter === f.id ? 'bg-indigo-700/80 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Quick Search Box */}
        <div className="relative min-w-[200px] md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search provider, model, vendor..."
            className="w-full bg-[#080d1a] border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. READY PROVIDERS SECTION                                */}
      {/* ======================================================== */}
      {activeFilter !== 'needsSetup' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-0.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
              <span className="text-white tracking-wide uppercase text-[11px]">Ready</span>
            </div>
            <span className="text-[11px] font-medium text-slate-500">
              {filteredReady.length} model provider{filteredReady.length === 1 ? '' : 's'}
            </span>
          </div>

          {filteredReady.length === 0 && (
            <div className="p-6 rounded-2xl border border-dashed border-slate-800 bg-[#0d1322]/40 text-center text-xs text-slate-400">
              {searchQuery ? 'No connected providers match your search filter.' : 'No model providers connected yet. Connect an engine below to get started.'}
            </div>
          )}

          {/* Antigravity Accordion Card */}
          {antigravityReady && (!searchQuery || filteredReady.some(p => p.id === 'antigravity')) && (
            <div className={`rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm ${
              currentActiveProvider === 'antigravity'
                ? 'border-indigo-500/50 bg-[#0d1322] shadow-[0_0_20px_rgba(99,102,241,0.12)]'
                : 'border-slate-800 bg-[#0d1322]/90 hover:border-slate-700/80'
            }`}>
              <div
                onClick={() => setExpandedProvider(prev => ({ ...prev, antigravity: !prev.antigravity }))}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/20 transition select-none"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <AntigravityLogo className="w-10 h-10 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-white tracking-tight">
                        Google Gemini (Antigravity)
                      </h3>
                      {currentActiveProvider === 'antigravity' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1 shadow-[0_0_10px_rgba(99,102,241,0.25)]">
                          <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                          <span>Active Brain</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetActiveBrain('antigravity');
                          }}
                          className="text-[10px] font-medium text-slate-400 hover:text-indigo-300 px-2 py-0.5 rounded-md hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/30 transition cursor-pointer"
                        >
                          Set as Active
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5 font-mono">
                      {antigravityEmail}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 shadow-[0_0_12px_rgba(52,211,153,0.15)]">
                    <Check className="w-3.5 h-3.5" />
                    <span>Ready</span>
                  </span>
                  <span className="text-xs text-slate-400 font-mono px-2 py-0.5 bg-slate-900/90 rounded-md border border-slate-800">
                    {antigravityVersion}
                  </span>
                  <button className="text-slate-400 hover:text-white p-1">
                    {expandedProvider.antigravity ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded Accordion Body */}
              {expandedProvider.antigravity && (
                <div className="px-5 pb-5 pt-3 border-t border-slate-800/80 space-y-4 bg-[#0a0e1a]/70">
                  {/* Leftover files Inset Card */}
                  <div className="p-4 rounded-xl border border-slate-800 bg-[#0c1220] flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        <HardDrive className="w-4 h-4 text-indigo-400" />
                        <span>Leftover files</span>
                      </div>
                      <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
                        On Windows, Antigravity can leave large temporary files behind when it stops. RuXt clears its own. This also finds ones left in the Windows temporary folder. Nothing is deleted until you confirm.
                      </p>
                    </div>
                    <button
                      onClick={handleCleanTempFiles}
                      disabled={cleaningTemp}
                      className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-700 text-white text-xs font-semibold shrink-0 transition active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {cleaningTemp ? 'Cleaning...' : 'Free up space'}
                    </button>
                  </div>

                  {cleanFeedback && (
                    <div className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-3.5 py-2.5 rounded-xl flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{cleanFeedback}</span>
                    </div>
                  )}

                  {/* User Account Row */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border-b border-slate-800/80 pb-4">
                    <div className="flex items-center gap-2 text-slate-300 font-mono">
                      <User className="w-4 h-4 text-slate-400" />
                      <span>{antigravityEmail}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => {
                          if (showNotification) showNotification('Google Account authenticated through Antigravity ACP session.', 'info');
                        }}
                        className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1 transition cursor-pointer"
                      >
                        <span>+ Add Google account</span>
                      </button>
                      <button
                        onClick={() => {
                          onSaveSetting('engine_status_antigravity', 'disconnected');
                          if (showNotification) showNotification('Signed out from Antigravity session', 'info');
                          fetchProvidersStatus();
                        }}
                        className="text-xs font-semibold text-slate-400 hover:text-rose-400 transition cursor-pointer"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>

                  {/* Collapsible: CLI path and updates */}
                  <div className="pt-1">
                    <button
                      onClick={() => setCliPathOpen(!cliPathOpen)}
                      className="text-xs font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <span className="text-[10px]">{cliPathOpen ? '▼' : '▶'}</span>
                      <span>CLI path and updates</span>
                    </button>

                    {cliPathOpen && (
                      <div className="mt-3 p-3.5 rounded-xl bg-slate-950/90 border border-slate-800/80 text-xs space-y-3 font-mono">
                        <div className="text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <span className="text-slate-500">Executable Binary:</span>
                          <span className="text-indigo-300 truncate max-w-lg flex items-center gap-1.5">
                            <span>{antigravityReady?.binaryPath || 'Language Server Windows x64 (agy.exe)'}</span>
                            {antigravityReady?.binaryPath && (
                              <button
                                onClick={() => copyToClipboard(antigravityReady.binaryPath)}
                                title="Copy full path"
                                className="text-slate-500 hover:text-white p-0.5"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        </div>
                        <div className="text-slate-400 flex items-center justify-between">
                          <span className="text-slate-500">ACP Communication:</span>
                          <span className="text-emerald-400 font-semibold">JSON-RPC 2.0 stdio (Zero Disk Polling)</span>
                        </div>
                        <div className="text-slate-400 flex items-center justify-between">
                          <span className="text-slate-500">Auto Lifecycle:</span>
                          <span className="text-slate-300">Managed background process (15 min idle cleanup)</span>
                        </div>

                        <div className="pt-2 border-t border-slate-800 space-y-2 font-sans">
                          <label className="text-[11px] font-semibold text-slate-400">Custom agy.exe Path:</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={localSettings?.antigravity_custom_path || ''}
                              onChange={(e) => handleChange && handleChange('antigravity_custom_path', e.target.value)}
                              placeholder="e.g. C:\Users\<User>\AppData\Local\agy\bin\agy.exe"
                              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                onSaveSetting('antigravity_custom_path', localSettings?.antigravity_custom_path);
                                if (showNotification) showNotification('Custom Antigravity path saved!', 'success');
                                fetchProvidersStatus();
                              }}
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                            >
                              Save
                            </button>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <button
                              type="button"
                              onClick={() => handleTestAntigravity(localSettings?.antigravity_custom_path)}
                              disabled={testingEngine}
                              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition cursor-pointer"
                            >
                              {testingEngine ? 'Testing Engine...' : 'Test Connection'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleLaunchAntigravityLogin(localSettings?.antigravity_custom_path)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
                            >
                              Sign in with Google
                            </button>
                          </div>

                          {engineTestFeedback && (
                            <div className={`p-2 rounded-lg border text-xs ${engineTestFeedback.type === 'success' ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' : 'bg-rose-950/40 border-rose-500/30 text-rose-300'}`}>
                              {engineTestFeedback.text}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Other Ready Providers (Claude, Cursor, OpenAI, Gemini Cloud API, Ollama, etc.) */}
          {filteredReady.filter(p => p.id !== 'antigravity').map(p => {
            const isActive = currentActiveProvider === p.id;
            return (
              <div
                key={p.id}
                className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isActive 
                    ? 'border-indigo-500/50 bg-[#0d1322] shadow-[0_0_20px_rgba(99,102,241,0.12)]' 
                    : 'border-slate-800 bg-[#0d1322]/80 hover:border-slate-700/80 hover:bg-[#0d1322]'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {getProviderLogo(p.id, "w-10 h-10 shrink-0")}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-white tracking-tight">
                        {p.name}
                      </h4>
                      {p.type === 'cli' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono font-medium">
                          CLI Bridge
                        </span>
                      )}
                      {p.type === 'api' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono font-medium">
                          Cloud API
                        </span>
                      )}
                      {p.type === 'local' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono font-medium">
                          Local Engine
                        </span>
                      )}

                      {isActive ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1 shadow-[0_0_10px_rgba(99,102,241,0.25)]">
                          <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                          <span>Active Brain</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetActiveBrain(p.id)}
                          className="text-[10px] font-medium text-slate-400 hover:text-indigo-300 px-2 py-0.5 rounded-md hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/30 transition cursor-pointer"
                        >
                          Set as Active
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {p.subtitle || p.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 shadow-[0_0_12px_rgba(52,211,153,0.15)]">
                    <Check className="w-3.5 h-3.5" />
                    <span>Ready</span>
                  </span>
                  {p.version && (
                    <span className="text-xs text-slate-400 font-mono px-2 py-0.5 bg-slate-900/90 rounded-md border border-slate-800">
                      {p.version}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. NEEDS SETUP SECTION                                    */}
      {/* ======================================================== */}
      {activeFilter !== 'ready' && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-0.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
              <span className="text-white tracking-wide uppercase text-[11px]">Needs setup</span>
            </div>
            <span className="text-[11px] font-medium text-slate-500">
              {filteredPending.length} model provider{filteredPending.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredPending.map((p) => {
              const isInlineOpen = inlineSetupId === p.id;
              return (
                <div
                  key={p.id}
                  className={`p-4 rounded-2xl border border-slate-800/90 bg-[#0d1322]/70 hover:bg-[#0d1322] hover:border-slate-700 transition flex flex-col justify-between gap-3 group ${
                    p.id === 'antigravity' && antigravitySetupOpen ? 'md:col-span-2' : ''
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {getProviderLogo(p.id, "w-10 h-10 shrink-0")}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white truncate tracking-tight">
                            {p.name}
                          </h4>
                        </div>
                        <p className="text-xs text-slate-400 truncate">
                          {p.vendor}
                        </p>
                        {p.modelsDesc && (
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {p.modelsDesc}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-semibold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span>Needs setup</span>
                      </span>

                      {p.id === 'antigravity' ? (
                        <button
                          onClick={() => setAntigravitySetupOpen(!antigravitySetupOpen)}
                          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition cursor-pointer"
                        >
                          <span>{antigravitySetupOpen ? 'Close' : 'Set up'}</span>
                          {antigravitySetupOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      ) : p.apiKeyTarget ? (
                        <button
                          onClick={() => {
                            if (isInlineOpen) {
                              setInlineSetupId(null);
                            } else {
                              setInlineSetupId(p.id);
                              setInlineKeyValue(localSettings[p.apiKeyTarget] || '');
                            }
                          }}
                          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition group-hover:translate-x-0.5 cursor-pointer"
                        >
                          <span>{isInlineOpen ? 'Cancel' : 'Set up'}</span>
                          {isInlineOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => onNavigateToApiKeys(p.id)}
                          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition group-hover:translate-x-0.5 cursor-pointer"
                        >
                          <span>Set up</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick Inline API Key Setup Drawer */}
                  {isInlineOpen && p.apiKeyTarget && (
                    <div className="mt-2 pt-3 border-t border-slate-800 space-y-2.5 text-xs bg-slate-950/60 p-3 rounded-xl">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Enter API Key / Token:</span>
                        {p.docsUrl && (
                          <a
                            href={p.docsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-400 hover:underline flex items-center gap-1"
                          >
                            <span>Get API key</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="password"
                          value={inlineKeyValue}
                          onChange={(e) => setInlineKeyValue(e.target.value)}
                          placeholder={`Paste ${p.name} Key...`}
                          className="flex-1 bg-[#090e1a] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                        />
                        <button
                          type="button"
                          disabled={isSavingKey}
                          onClick={() => handleSaveInlineKey(p)}
                          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          {isSavingKey ? 'Saving...' : 'Connect'}
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                        <span>Key is securely encrypted in local SQLite storage.</span>
                        <button
                          type="button"
                          onClick={() => onNavigateToApiKeys(p.id)}
                          className="text-slate-400 hover:text-indigo-300 underline cursor-pointer"
                        >
                          Open in API Keys tab
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Antigravity Setup Details */}
                  {p.id === 'antigravity' && antigravitySetupOpen && (
                    <div className="pt-3 border-t border-slate-800/80 space-y-3 text-xs">
                      <p className="text-slate-400 leading-relaxed font-sans">
                        Google Antigravity runs locally using your Google Account (zero API key required). If installed in a custom location, enter the binary path below or sign in:
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={localSettings?.antigravity_custom_path || ''}
                          onChange={(e) => handleChange && handleChange('antigravity_custom_path', e.target.value)}
                          placeholder="e.g. C:\Users\<Username>\AppData\Local\agy\bin\agy.exe"
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            onSaveSetting('antigravity_custom_path', localSettings?.antigravity_custom_path);
                            if (showNotification) showNotification('Custom Antigravity path saved!', 'success');
                            fetchProvidersStatus();
                          }}
                          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition cursor-pointer"
                        >
                          Save Path
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => handleTestAntigravity(localSettings?.antigravity_custom_path)}
                          disabled={testingEngine}
                          className="px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white font-semibold transition cursor-pointer"
                        >
                          {testingEngine ? 'Testing Engine...' : 'Test Connection'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLaunchAntigravityLogin(localSettings?.antigravity_custom_path)}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition cursor-pointer"
                        >
                          Sign in with Google
                        </button>
                      </div>

                      {engineTestFeedback && (
                        <div className={`p-2.5 rounded-xl border text-xs ${engineTestFeedback.type === 'success' ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' : 'bg-rose-950/40 border-rose-500/30 text-rose-300'}`}>
                          {engineTestFeedback.text}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
