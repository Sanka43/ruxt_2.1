import React from 'react';
import { 
  RefreshCw, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  HardDrive, 
  User, 
  ExternalLink, 
  CheckCircle2, 
  Bot, 
  Sparkles, 
  Laptop, 
  Terminal 
} from 'lucide-react';

export function AntigravityLogo({ className = "w-10 h-10" }) {
  return (
    <div className={`rounded-2xl bg-white flex items-center justify-center p-1.5 shadow-sm border border-slate-200/80 shrink-0 ${className}`}>
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <path d="M50 15 C30 15 18 40 18 70 C24 60 34 50 50 50 C66 50 76 60 82 70 C82 40 70 15 50 15 Z" fill="#0f172a" />
        <path d="M50 55 C38 55 30 65 24 75 C32 82 42 85 50 85 C58 85 68 82 76 75 C70 65 62 55 50 55 Z" fill="#0f172a" />
      </svg>
    </div>
  );
}

export function GrokLogo({ className = "w-10 h-10" }) {
  return (
    <div className={`rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center p-2.5 border border-slate-200 dark:border-slate-700 shrink-0 ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-slate-800 dark:text-slate-100">
        <circle cx="12" cy="12" r="8" />
        <line x1="6" y1="18" x2="18" y2="6" />
      </svg>
    </div>
  );
}

export function KimiLogo({ className = "w-10 h-10" }) {
  return (
    <div className={`rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center p-2 border border-slate-200 dark:border-slate-700 relative shrink-0 ${className}`}>
      <span className="font-black text-slate-900 dark:text-white text-base font-sans tracking-tight">K</span>
      <span className="w-2 h-2 rounded-full bg-blue-500 absolute top-2 right-2" />
    </div>
  );
}

export function CursorLogo({ className = "w-10 h-10" }) {
  return (
    <div className={`rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center p-2.5 border border-slate-200 dark:border-slate-700 shrink-0 ${className}`}>
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-slate-800 dark:text-slate-100">
        <path d="M4 3l15 9-7 2-3 7L4 3z" />
      </svg>
    </div>
  );
}

export function DroidLogo({ className = "w-10 h-10" }) {
  return (
    <div className={`rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center p-2.5 border border-slate-200 dark:border-slate-700 shrink-0 ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-slate-800 dark:text-slate-100">
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="5" r="2" />
        <circle cx="12" cy="19" r="2" />
        <circle cx="5" cy="12" r="2" />
        <circle cx="19" cy="12" r="2" />
      </svg>
    </div>
  );
}

export function CommandCodeLogo({ className = "w-10 h-10" }) {
  return (
    <div className={`rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center p-2 border border-slate-200 dark:border-slate-700 shrink-0 ${className}`}>
      <span className="font-bold text-slate-800 dark:text-slate-100 text-base">⌘</span>
    </div>
  );
}

export function CopilotBrandLogo({ className = "w-10 h-10" }) {
  return (
    <div className={`rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center p-2.5 border border-slate-200 dark:border-slate-700 shrink-0 ${className}`}>
      <Bot className="w-full h-full text-slate-800 dark:text-slate-100" />
    </div>
  );
}

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
  onNavigateToApiKeys
}) {
  const readyList = providersData.ready || [];
  const antigravityReady = readyList.find(p => p.id === 'antigravity');
  const antigravityEmail = antigravityReady?.email || 'isankaerangahtc820@gmail.com';
  const antigravityVersion = antigravityReady?.version || 'v1.4.3';

  return (
    <div className="space-y-6">
      {/* Top Header (Matching Image 1) */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Model providers and accounts</h2>
          <p className="text-xs text-slate-400 mt-1">
            Connect the AI tools that power your bots. Accounts, setup and updates, all in one place.
          </p>
        </div>
        <button
          onClick={fetchProvidersStatus}
          disabled={isCheckingProviders}
          className="px-3.5 py-2 rounded-xl border border-slate-700/80 bg-slate-900/90 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isCheckingProviders ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Check again</span>
        </button>
      </div>

      {/* Ready Providers Section (Matching Image 1 & 2) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400">
          <span>Ready</span>
          <span className="text-[11px] font-medium text-slate-500">
            {readyList.length > 0 ? readyList.length : 1} model provider{readyList.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Main Google Gemini Antigravity Card */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322]/90 overflow-hidden shadow-sm transition hover:border-slate-700/80">
          <div
            onClick={() => setExpandedProvider(prev => ({ ...prev, antigravity: !prev.antigravity }))}
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/20 transition select-none"
          >
            <div className="flex items-center gap-3.5">
              <AntigravityLogo />
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Google Gemini (Antigravity)</h3>
                <p className="text-xs text-slate-400 mt-0.5">{antigravityEmail}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Ready</span>
              </span>
              <span className="text-xs text-slate-500 font-mono px-2 py-0.5 bg-slate-900/80 rounded-md border border-slate-800">
                {antigravityVersion}
              </span>
              <button className="text-slate-400 hover:text-white p-1">
                {expandedProvider.antigravity ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Expanded Accordion Body (Matching Image 2) */}
          {expandedProvider.antigravity && (
            <div className="px-5 pb-5 pt-3 border-t border-slate-800/80 space-y-4 bg-[#0a0e1a]/60">
              {/* Leftover files Inset Card */}
              <div className="p-4 rounded-xl border border-slate-800 bg-[#0c1220] flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <HardDrive className="w-4 h-4 text-slate-400" />
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
                      if (showNotification) showNotification('Google Account is authenticated through Antigravity / ACP.', 'info');
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
                  <div className="mt-3 p-3.5 rounded-xl bg-slate-950/90 border border-slate-800/80 text-xs space-y-2 font-mono">
                    <div className="text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="text-slate-500">Executable Binary:</span>
                      <span className="text-indigo-300 truncate max-w-lg">
                        {antigravityReady?.binaryPath || 'Language Server Windows x64 (agy_acp_server.exe)'}
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
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Any extra ready Cloud API providers */}
        {readyList.filter(p => p.id !== 'antigravity').map(p => (
          <div key={p.id} className="p-4 rounded-2xl border border-slate-800 bg-[#0d1322]/80 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">{p.name}</h4>
                <p className="text-xs text-slate-400">{p.subtitle}</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              <span>Ready</span>
            </span>
          </div>
        ))}
      </div>

      {/* Needs Setup Grid (Matching Image 1) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400">
          <span>Needs setup</span>
          <span className="text-[11px] font-medium text-slate-500">
            26 model providers
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {[
            { id: 'grok', name: 'Grok', vendor: 'xAI', logo: <GrokLogo /> },
            { id: 'kimi', name: 'Kimi', vendor: 'Moonshot AI', logo: <KimiLogo /> },
            { id: 'droid', name: 'Droid', vendor: 'Factory', logo: <DroidLogo /> },
            { id: 'cursor', name: 'Cursor', vendor: 'Cursor', logo: <CursorLogo /> },
            { id: 'copilot', name: 'GitHub Copilot', vendor: 'GitHub', logo: <CopilotBrandLogo /> },
            { id: 'commandcode', name: 'Command Code', vendor: 'Command Code', logo: <CommandCodeLogo /> },
            { id: 'claude', name: 'Anthropic Claude', vendor: 'Anthropic', logo: <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-amber-500 font-black text-lg">✱</div> },
            { id: 'openai', name: 'OpenAI / Codex', vendor: 'OpenAI', logo: <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-emerald-400"><Sparkles className="w-5 h-5" /></div> },
            { id: 'ollama', name: 'Local Ollama', vendor: 'Local Machine', logo: <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-purple-400"><Laptop className="w-5 h-5" /></div> }
          ].map((p) => (
            <div
              key={p.id}
              className="p-4 rounded-2xl border border-slate-800 bg-[#0d1322]/60 hover:bg-[#0d1322] flex items-center justify-between transition group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                {p.logo}
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white truncate">{p.name}</h4>
                  <p className="text-xs text-slate-400 truncate">{p.vendor}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>Needs setup</span>
                </span>
                <button
                  onClick={() => onNavigateToApiKeys(p.id)}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition group-hover:translate-x-0.5 cursor-pointer"
                >
                  <span>Set up</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
