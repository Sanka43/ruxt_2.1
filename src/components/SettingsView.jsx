import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  SlidersHorizontal, 
  Cpu, 
  ShieldCheck, 
  Radio, 
  Palette, 
  Database, 
  Activity, 
  Search, 
  X, 
  Check, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  Terminal, 
  Zap, 
  Laptop, 
  CheckCircle2, 
  AlertCircle, 
  Pause, 
  Power,
  PowerOff, 
  Trash2, 
  Download, 
  Copy, 
  Eye, 
  EyeOff, 
  FolderOpen, 
  Server,
  Layers,
  ArrowRight,
  ShieldAlert,
  Info,
  LayoutDashboard,
  Crown,
  ExternalLink,
  Settings,
  ShoppingBag,
  Users,
  CheckSquare,
  Bot,
  Camera,
  Upload,
  Mail,
  Briefcase,
  Award,
  FileText,
  UserCheck,
  Image,
  Key,
  ChevronDown,
  ChevronUp,
  HardDrive,
  User
} from 'lucide-react';
import ModelProvidersSection from './ModelProvidersSection.jsx';
import ApiKeysSection from './ApiKeysSection.jsx';

// Web Audio API Synthesizer for subtle haptic cues (zero external assets needed)
export function playSound(type = 'click') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.04);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'toggle') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.05);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.07);
      osc.frequency.setValueAtTime(783.99, now + 0.14);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (_) {}
}

export const PROVIDER_NAMES = {
  antigravity: 'Google Antigravity (ACP Engine)',
  gemini: 'Google Gemini (Cloud API)',
  claude: 'Anthropic Claude Engine',
  openai: 'OpenAI / Codex Engine',
  xai: 'Grok (xAI) Engine',
  openrouter: 'OpenRouter Multi-Model',
  ollama: 'Local Ollama Engine',
  custom: 'Custom LLM Server'
};

export const CATEGORY_GROUPS = [
  {
    title: 'YOU',
    items: [
      { id: 'overview', name: 'Overview & Leader', icon: LayoutDashboard, badge: 'LEADER' },
      { id: 'general', name: 'General & Profile', icon: SlidersHorizontal, badge: 'PROFILE' },
      { id: 'appearance', name: 'Appearance & Layout', icon: Palette, badge: null }
    ]
  },
  {
    title: 'AI',
    items: [
      { id: 'models', name: 'Model providers', icon: Terminal, badge: 'READY' },
      { id: 'api_keys', name: 'API keys', icon: Key, badge: 'KEYS' },
      { id: 'guardrails', name: 'Guardrails & Cognition', icon: ShieldCheck, badge: 'ACTIVE' }
    ]
  },
  {
    title: 'DEVICES & SYSTEM',
    items: [
      { id: 'network', name: 'Cloud Tunnel & Bridge', icon: Radio, badge: 'PORT 1234' },
      { id: 'storage', name: 'SQLite Storage & WAL', icon: Database, badge: null },
      { id: 'diagnostics', name: 'System & Diagnostics', icon: Activity, badge: 'v2.1.0' }
    ]
  }
];

const CATEGORIES = CATEGORY_GROUPS.flatMap(g => g.items);

// Visual Provider Brand Icons matching screenshot design
function AntigravityLogo({ className = "w-6 h-6" }) {
  return (
    <div className={`rounded-xl bg-white flex items-center justify-center p-1.5 shadow-sm border border-slate-200/80 shrink-0 ${className}`}>
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <path d="M50 15 C30 15 18 40 18 70 C24 60 34 50 50 50 C66 50 76 60 82 70 C82 40 70 15 50 15 Z" fill="#0f172a" />
        <path d="M50 55 C38 55 30 65 24 75 C32 82 42 85 50 85 C58 85 68 82 76 75 C70 65 62 55 50 55 Z" fill="#0f172a" />
      </svg>
    </div>
  );
}

function GrokLogo({ className = "w-6 h-6" }) {
  return (
    <div className={`rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center p-2 border border-slate-200 dark:border-slate-700 shrink-0 ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-slate-800 dark:text-slate-100">
        <circle cx="12" cy="12" r="8" />
        <line x1="6" y1="18" x2="18" y2="6" />
      </svg>
    </div>
  );
}

function KimiLogo({ className = "w-6 h-6" }) {
  return (
    <div className={`rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center p-1.5 border border-slate-200 dark:border-slate-700 relative shrink-0 ${className}`}>
      <span className="font-black text-slate-900 dark:text-white text-sm font-sans tracking-tight">K</span>
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 absolute top-1.5 right-1.5" />
    </div>
  );
}

function CursorLogo({ className = "w-6 h-6" }) {
  return (
    <div className={`rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center p-2 border border-slate-200 dark:border-slate-700 shrink-0 ${className}`}>
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-slate-800 dark:text-slate-100">
        <path d="M4 3l15 9-7 2-3 7L4 3z" />
      </svg>
    </div>
  );
}

function DroidLogo({ className = "w-6 h-6" }) {
  return (
    <div className={`rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center p-2 border border-slate-200 dark:border-slate-700 shrink-0 ${className}`}>
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

function CommandCodeLogo({ className = "w-6 h-6" }) {
  return (
    <div className={`rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center p-2 border border-slate-200 dark:border-slate-700 shrink-0 ${className}`}>
      <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">⌘</span>
    </div>
  );
}

function CopilotBrandLogo({ className = "w-6 h-6" }) {
  return (
    <div className={`rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center p-2 border border-slate-200 dark:border-slate-700 shrink-0 ${className}`}>
      <Bot className="w-full h-full text-slate-800 dark:text-slate-100" />
    </div>
  );
}

export default function SettingsView({
  settings = {},
  onSaveSetting,
  onSaveBatch,
  onClose,
  runtimes = [],
  onScanRuntimes,
  scanningRuntimes = false,
  showNotification,
  testingConnection = false,
  connectionTestResult = null,
  handleTestConnection,
  initialCategory = 'overview',
  agents = [],
  tasks = [],
  marketplaceAgents = [],
  onCommandLeader,
  onNavigateTab
}) {
  const [activeCategory, setActiveCategory] = useState(initialCategory || 'overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [showApiKey, setShowApiKey] = useState({});
  const [localSettings, setLocalSettings] = useState({ ...settings });
  const [storageStats, setStorageStats] = useState(null);
  const [diagInfo, setDiagInfo] = useState(null);
  const [vacuuming, setVacuuming] = useState(false);
  const [purging, setPurging] = useState(false);
  const [pingStatus, setPingStatus] = useState(null);
  const [providersData, setProvidersData] = useState({ ready: [], needsSetup: [], readyCount: 0, needsSetupCount: 0 });
  const [isCheckingProviders, setIsCheckingProviders] = useState(false);
  const [cleaningTemp, setCleaningTemp] = useState(false);
  const [cleanFeedback, setCleanFeedback] = useState(null);
  const [expandedProvider, setExpandedProvider] = useState({ antigravity: true });
  const [savedKeyFeedback, setSavedKeyFeedback] = useState({});
  const [apiKeySearchQuery, setApiKeySearchQuery] = useState('');
  const [cliPathOpen, setCliPathOpen] = useState(false);
  const avatarInputRef = React.useRef(null);

  const fetchProvidersStatus = async () => {
    setIsCheckingProviders(true);
    try {
      const res = await fetch('/api/settings/providers-status');
      const data = await res.json();
      if (data.success) {
        setProvidersData(data);
      }
    } catch (_) {}
    finally {
      setIsCheckingProviders(false);
    }
  };

  const handleCleanTempFiles = async () => {
    setCleaningTemp(true);
    setCleanFeedback(null);
    try {
      const res = await fetch('/api/settings/clean-temp-files', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCleanFeedback(data.message);
        if (showNotification) showNotification(data.message, 'success');
        if (localSettings.sound_haptics !== 'false') playSound('success');
      }
    } catch (e) {
      setCleanFeedback('Cleaning failed: ' + e.message);
    } finally {
      setCleaningTemp(false);
    }
  };

  const handleSaveApiKey = (keyName) => {
    const val = (localSettings[keyName] || '').trim();
    onSaveSetting(keyName, val);
    setSavedKeyFeedback(prev => ({ ...prev, [keyName]: true }));
    setTimeout(() => {
      setSavedKeyFeedback(prev => ({ ...prev, [keyName]: false }));
    }, 2500);
    fetchProvidersStatus();
    if (showNotification) showNotification('API key saved successfully!', 'success');
    if (localSettings.sound_haptics !== 'false') playSound('success');
  };

  // Sync initialCategory when opened
  useEffect(() => {
    if (initialCategory) {
      setActiveCategory(initialCategory);
    }
  }, [initialCategory]);

  // Sync settings when parent updates
  useEffect(() => {
    setLocalSettings(prev => ({ ...prev, ...settings }));
  }, [settings]);

  // Load storage & diagnostics data on mount
  useEffect(() => {
    fetchStorageStats();
    fetchDiagnostics();
    fetchProvidersStatus();
  }, []);

  const fetchStorageStats = async () => {
    try {
      const res = await fetch('/api/settings/storage-stats');
      const data = await res.json();
      if (data.success) setStorageStats(data);
    } catch (_) {}
  };

  const fetchDiagnostics = async () => {
    try {
      const res = await fetch('/api/settings/diagnostics');
      const data = await res.json();
      if (data.success) setDiagInfo(data);
    } catch (_) {}
  };

  const handleToggle = (key, defaultVal = true) => {
    const current = localSettings[key] !== undefined ? localSettings[key] !== 'false' : defaultVal;
    const nextVal = current ? 'false' : 'true';
    setLocalSettings(prev => ({ ...prev, [key]: nextVal }));
    onSaveSetting(key, nextVal);
    if (localSettings.sound_haptics !== 'false') playSound('toggle');
  };

  const handleChange = (key, val) => {
    setLocalSettings(prev => ({ ...prev, [key]: val }));
  };

  const handleSaveSingle = (key) => {
    onSaveSetting(key, localSettings[key]);
    if (localSettings.sound_haptics !== 'false') playSound('success');
    showNotification(`Saved: ${key}`);
  };

  const handleSaveCurrentCategory = async (keys) => {
    const toSave = {};
    keys.forEach(k => {
      if (localSettings[k] !== undefined) toSave[k] = localSettings[k];
    });
    if (onSaveBatch) {
      await onSaveBatch(toSave);
    } else {
      for (const [k, v] of Object.entries(toSave)) {
        onSaveSetting(k, v);
      }
    }
    if (localSettings.sound_haptics !== 'false') playSound('success');
    showNotification('Settings saved successfully!');
  };

  const handleVacuumDb = async () => {
    setVacuuming(true);
    try {
      const res = await fetch('/api/settings/vacuum', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showNotification(`Vacuum complete! Freed ${data.freedFormatted}`);
        fetchStorageStats();
        if (localSettings.sound_haptics !== 'false') playSound('success');
      }
    } catch (e) {
      showNotification('Vacuum failed: ' + e.message);
    } finally {
      setVacuuming(false);
    }
  };

  const handlePurgeHistory = async () => {
    if (!window.confirm('Are you sure you want to clear chat messages and sessions? This cannot be undone.')) return;
    setPurging(true);
    try {
      const res = await fetch('/api/settings/clear-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'all' })
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Chat history and activity logs cleared!');
        fetchStorageStats();
        fetchDiagnostics();
        if (localSettings.sound_haptics !== 'false') playSound('success');
      }
    } catch (e) {
      showNotification('Purge failed: ' + e.message);
    } finally {
      setPurging(false);
    }
  };

  const handlePingBridge = async () => {
    setPingStatus('pinging');
    const start = performance.now();
    try {
      const res = await fetch('/api/workspace');
      const lat = Math.round(performance.now() - start);
      if (res.ok) {
        setPingStatus(`Active • ${lat}ms latency`);
        if (localSettings.sound_haptics !== 'false') playSound('success');
      } else {
        setPingStatus('Engine responded with error');
      }
    } catch (e) {
      setPingStatus('Bridge connection failed');
    }
  };

  const handleExportBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(localSettings, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `ruxt-settings-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showNotification('Settings backup exported!');
  };

  // Provider display names
  const activeProviderName = useMemo(() => {
    return PROVIDER_NAMES[localSettings.active_provider] || 'Google Gemini (Cloud API)';
  }, [localSettings.active_provider]);

  // RuXt Leader
  const ruxtLeader = useMemo(() => {
    return agents.find(a => a.slug === 'ruxt') || {
      name: 'RuXt',
      avatar: '/ruxt-logo.png',
      role: 'Team Leader & Engine Orchestrator',
      description: 'Central control layer of RuXt Local Engine. Coordinates installed specialists (Julian Vance, Maya Brooks, Noah Reed), plans multi-stage projects, distributes tasks, and enforces deliverable quality.'
    };
  }, [agents]);

  // Search indexing: filter items when search query is entered
  const isSearching = searchQuery.trim().length > 0;
  const filteredCategories = useMemo(() => {
    if (!isSearching) return CATEGORIES;
    const q = searchQuery.toLowerCase();
    return CATEGORIES.filter(c => c.name.toLowerCase().includes(q) || c.id.includes(q));
  }, [isSearching, searchQuery]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0f19] text-slate-100 overflow-hidden select-none">
      {/* Top Header */}
      <header className="px-6 py-4 border-b border-slate-800/80 bg-[#0d1322]/90 backdrop-blur flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-bold text-white tracking-tight">Workspace Settings</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-semibold tracking-wide">
                {activeProviderName}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure neural models, cognitive guardrails, tunnel bridges, and UI ergonomics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Live Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search settings..."
              className="w-60 bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition shadow-inner"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Close Button */}
          {onClose && (
            <button
              onClick={onClose}
              title="Close Settings"
              className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Two-Column Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Categories (Grouped like Image 3) */}
        <aside className="w-64 border-r border-slate-800/80 bg-[#090d16] flex flex-col justify-between shrink-0 p-3 overflow-y-auto">
          <div className="space-y-4">
            {isSearching ? (
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 py-1">
                  Search Results
                </div>
                {filteredCategories.map((cat) => {
                  const IconComp = cat.icon;
                  const isSelected = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setActiveCategory(cat.id);
                        if (localSettings.sound_haptics !== 'false') playSound('click');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <IconComp className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                        <span className="truncate">{cat.name}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              CATEGORY_GROUPS.map((group) => (
                <div key={group.title} className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 py-1">
                    {group.title}
                  </div>
                  {group.items.map((cat) => {
                    const IconComp = cat.icon;
                    const isSelected = activeCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setActiveCategory(cat.id);
                          if (localSettings.sound_haptics !== 'false') playSound('click');
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <IconComp className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                          <span className="truncate">{cat.name}</span>
                        </div>
                        {cat.badge && (
                          <span
                            className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${
                              isSelected
                                ? 'bg-white/20 border-white/30 text-white'
                                : 'bg-slate-800/80 border-slate-700 text-slate-400'
                            }`}
                          >
                            {cat.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Bottom Actions: Active Brain & Web Hub Portal (Matching Image) */}
          <div className="mt-auto pt-3 border-t border-slate-800/70 space-y-2">
            {/* Active Brain Display Card (Image Match) */}
            <div 
              onClick={() => {
                setActiveCategory('models');
                if (localSettings.sound_haptics !== 'false') playSound('click');
              }}
              className="p-2.5 rounded-2xl bg-[#0e1424] border border-slate-800 hover:border-indigo-500/50 cursor-pointer transition flex items-center justify-between group shadow-sm"
              title="Click to configure Active Brain"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <Zap className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 font-medium block -mb-0.5">Active Brain</span>
                  <span className="font-semibold text-white text-[11px] truncate block">
                    {activeProviderName}
                  </span>
                </div>
              </div>
              <Settings className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition shrink-0" />
            </div>

            {/* Web Hub Portal Link (Image Match) */}
            <a
              href="/hub"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition group"
            >
              <span className="flex items-center gap-2">
                <ExternalLink className="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-300 transition" />
                <span className="text-slate-300 group-hover:text-white text-xs">Web Hub Portal</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono group-hover:text-slate-400">skills.sh</span>
            </a>
          </div>

          {/* Sidebar Bottom Footer Status */}
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 mt-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                EXPRESS HTTP/WS
              </span>
              <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ACTIVE
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Port {localSettings.server_port || '1234'} • Local-First
            </div>
          </div>
        </aside>

        {/* Right Main Content Viewport */}
        <main className="flex-1 overflow-y-auto p-8 space-y-6 max-w-4xl">
          {/* ======================================================== */}
          {/* CATEGORY 0: OVERVIEW & LEADER                            */}
          {/* ======================================================== */}
          {(activeCategory === 'overview' || (isSearching && 'overview leader orchestrator'.includes(searchQuery.toLowerCase()))) && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <LayoutDashboard className="w-5 h-5 text-indigo-400" />
                  Overview & Team Leader
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  RuXt central orchestrator hub, multi-specialist talent fleet, and workspace engine status.
                </p>
              </div>

              {/* RuXt Core Leader Command Hub Card */}
              <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-950 via-purple-950/60 to-slate-900 border border-indigo-500/30 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <img 
                      src={ruxtLeader.avatar || '/agent-avatars/ruxt.png'} 
                      alt="RuXt Leader" 
                      className="w-20 h-20 rounded-2xl object-cover ring-4 ring-amber-400/60 shadow-xl bg-slate-800"
                      onError={(e) => { e.target.src = '/agent-avatars/ruxt.png'; }}
                    />
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-500 text-slate-950 text-xs flex items-center justify-center font-bold shadow-lg" title="Team Leader">
                      👑
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl font-black text-white">RuXt</h3>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                        TEAM LEADER & ENGINE ORCHESTRATOR
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
                      Central control layer of RuXt Local Engine. Coordinates installed specialists (Julian Vance, Maya Brooks, Noah Reed), plans multi-stage projects, distributes tasks, and enforces deliverable quality.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto">
                  <button
                    onClick={() => {
                      if (onCommandLeader) onCommandLeader('Coordinate with RuXt (Team Leader)');
                      else if (onClose) onClose();
                    }}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <Crown className="w-4 h-4 text-amber-300" />
                    Command Team with RuXt
                  </button>
                  <button
                    onClick={() => {
                      if (onNavigateTab) onNavigateTab('marketplace');
                      else if (onClose) onClose();
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <ShoppingBag className="w-4 h-4 text-pink-400" />
                    Hire Specialists
                  </button>
                </div>
              </div>

              {/* Real-time Workspace Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/90">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-400">Team Specialists</span>
                    <Users className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="text-2xl font-bold text-white">{agents.length || 3}</div>
                  <p className="text-[10px] text-slate-500 mt-1">Installed local AI agents</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/90">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-400">Available on Hub</span>
                    <ShoppingBag className="w-4 h-4 text-pink-400" />
                  </div>
                  <div className="text-2xl font-bold text-white">{marketplaceAgents.length || 5}</div>
                  <p className="text-[10px] text-slate-500 mt-1">Verified skills & talents</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/90">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-400">Active Tasks</span>
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold text-white">{tasks.filter(t => t.status !== 'done').length}</div>
                  <p className="text-[10px] text-slate-500 mt-1">Orchestration pipeline</p>
                </div>

                <div 
                  onClick={() => {
                    setActiveCategory('models');
                    if (localSettings.sound_haptics !== 'false') playSound('click');
                  }}
                  className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/90 hover:border-amber-500/50 cursor-pointer transition group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-400">Active Brain</span>
                    <Zap className="w-4 h-4 text-amber-400 group-hover:scale-110 transition" />
                  </div>
                  <div className="text-xs font-bold text-white truncate">
                    {activeProviderName}
                  </div>
                  <p className="text-[10px] text-amber-400/80 mt-1 flex items-center gap-1 font-medium">
                    <span>Manage Models</span>
                    <ArrowRight className="w-3 h-3 inline group-hover:translate-x-0.5 transition" />
                  </p>
                </div>
              </div>

              {/* Installed Specialists Showcase */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/90 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    Specialist Fleet Under RuXt Command
                  </h4>
                  <button
                    onClick={() => {
                      if (onNavigateTab) onNavigateTab('agents');
                      else if (onClose) onClose();
                    }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    View All Agents →
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {agents.slice(0, 3).map((agent) => (
                    <div key={agent.id || agent.slug} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-3">
                      <img 
                        src={agent.avatar || '/agent-avatars/ruxt.png'} 
                        alt={agent.name}
                        className="w-10 h-10 rounded-xl object-cover ring-1 ring-slate-700 bg-slate-800 shrink-0" 
                        onError={(e) => { e.target.src = '/agent-avatars/ruxt.png'; }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-white text-xs truncate">{agent.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{agent.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Web Hub Portal Direct Banner */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                    <ExternalLink className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">RuXt Web Hub Portal</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Access the offline and cloud talent marketplace at <span className="font-mono text-indigo-300">skills.sh</span> or local port 1234.
                    </p>
                  </div>
                </div>
                <a
                  href="/hub"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shrink-0 flex items-center gap-1.5 shadow"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Hub Portal
                </a>
              </div>
            </div>
          )}
          {/* ======================================================== */}
          {/* CATEGORY 1: GENERAL & RUXT LEADER PROFILE                */}
          {/* ======================================================== */}
          {(activeCategory === 'general' || (isSearching && 'general ruxt profile photo email skill name avatar role'.includes(searchQuery.toLowerCase()))) && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
                    General & RuXt Profile
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Fully customize RuXt Leader's identity, photo, email, skills, and workspace preferences.
                  </p>
                </div>
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1">
                  👑 TEAM LEADER PROFILE
                </span>
              </div>

              {/* RUXT FULL PROFILE CARD */}
              <div className="p-6 rounded-3xl bg-gradient-to-b from-indigo-950/40 via-slate-900/80 to-slate-900 border border-indigo-500/30 shadow-xl space-y-6">
                
                {/* Header preview row: Avatar + Live Title Badge */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                  <div className="flex items-center gap-4">
                    {/* Avatar with Upload Trigger */}
                    <div className="relative group">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden ring-4 ring-indigo-500/40 shadow-xl bg-slate-950">
                        <img
                          src={localSettings.team_leader_avatar || '/agent-avatars/ruxt.png'}
                          alt={localSettings.team_leader_name || 'RuXt'}
                          onError={(e) => { e.target.src = '/agent-avatars/ruxt.png'; }}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-500 text-[11px] flex items-center justify-center text-slate-950 font-bold shadow-md" title="Team Leader">
                        👑
                      </span>
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 rounded-2xl flex flex-col items-center justify-center text-white text-[10px] font-semibold transition cursor-pointer"
                        title="Upload new photo"
                      >
                        <Camera className="w-4 h-4 mb-0.5 text-amber-300" />
                        Change
                      </button>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-extrabold text-white">
                          {localSettings.team_leader_name || 'RuXt'}
                        </h3>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/30 uppercase">
                          Leader
                        </span>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Status: Online" />
                      </div>
                      <p className="text-xs font-semibold text-indigo-400 mt-0.5">
                        {localSettings.team_leader_role || 'Team Leader & Engine Orchestrator'}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {localSettings.team_leader_email || 'ruxt.leader@workspace.ai'}
                      </p>
                    </div>
                  </div>

                  {/* Upload button & reset */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChange('team_leader_avatar', '/agent-avatars/ruxt.png')}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                      title="Reset to default RuXt avatar"
                    >
                      Reset
                    </button>
                    <input
                      type="file"
                      ref={avatarInputRef}
                      onChange={handleAvatarUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                </div>



                {/* Name & Email Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                      Leader Name
                    </label>
                    <input
                      type="text"
                      value={localSettings.team_leader_name !== undefined ? localSettings.team_leader_name : 'RuXt'}
                      onChange={(e) => handleChange('team_leader_name', e.target.value)}
                      placeholder="e.g. RuXt, RuXt Leader, Chief Executive"
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-indigo-400" />
                      Leader Email / Coordination Address
                    </label>
                    <input
                      type="email"
                      value={localSettings.team_leader_email !== undefined ? localSettings.team_leader_email : 'ruxt.leader@workspace.ai'}
                      onChange={(e) => handleChange('team_leader_email', e.target.value)}
                      placeholder="e.g. ruxt.leader@workspace.ai"
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                {/* Role / Title & Department */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                      Role / Professional Title
                    </label>
                    <input
                      type="text"
                      value={localSettings.team_leader_role !== undefined ? localSettings.team_leader_role : 'Team Leader & Engine Orchestrator'}
                      onChange={(e) => handleChange('team_leader_role', e.target.value)}
                      placeholder="e.g. Team Leader & Engine Orchestrator"
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                      Department / Operation Scope
                    </label>
                    <input
                      type="text"
                      value={localSettings.team_leader_department !== undefined ? localSettings.team_leader_department : 'Autonomous Platform Operations'}
                      onChange={(e) => handleChange('team_leader_department', e.target.value)}
                      placeholder="e.g. Autonomous Platform Operations"
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Leader Skills & Capabilities */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      Leader Skills & Capabilities (Comma separated)
                    </label>
                    <span className="text-[10px] text-slate-500">Click suggestions below to quickly add</span>
                  </div>
                  <input
                    type="text"
                    value={localSettings.team_leader_skills !== undefined ? localSettings.team_leader_skills : 'System Orchestration, Team Delegation, Technical Architecture, Code Review, Security Governance, Full-Stack Design'}
                    onChange={(e) => handleChange('team_leader_skills', e.target.value)}
                    placeholder="e.g. System Orchestration, Technical Architecture, Team Delegation, Code Review"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                  />
                  {/* Quick-add skill pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      'Full-Stack Architecture',
                      'Task Delegation',
                      'Code Review',
                      'DevOps & CI/CD',
                      'Financial Modeling',
                      'UI/UX Design',
                      'Database Systems',
                      'Security Governance',
                      'AI Prompt Engineering'
                    ].map(skill => {
                      const currentSkills = (localSettings.team_leader_skills || '').split(',').map(s => s.trim().toLowerCase());
                      const hasSkill = currentSkills.includes(skill.toLowerCase());
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => {
                            const cur = (localSettings.team_leader_skills || '').trim();
                            if (hasSkill) return;
                            const updated = cur ? `${cur}, ${skill}` : skill;
                            handleChange('team_leader_skills', updated);
                            if (localSettings.sound_haptics !== 'false') playSound('click');
                          }}
                          className={`text-[10px] px-2.5 py-1 rounded-lg border transition flex items-center gap-1 ${
                            hasSkill
                              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300 cursor-default'
                              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                          }`}
                        >
                          <span>{hasSkill ? '✓' : '+'}</span>
                          <span>{skill}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Bio / Persona Quote */}
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    Bio & Presentation Quote (Hero Greeting)
                  </label>
                  <textarea
                    rows={3}
                    value={localSettings.team_leader_bio !== undefined ? localSettings.team_leader_bio : 'Hello! I am your private AI partner and Chief of Staff. Ask me anything in any language. I can break down projects, delegate to specialist executives, track tasks, and optimize your business.'}
                    onChange={(e) => handleChange('team_leader_bio', e.target.value)}
                    placeholder="Describe RuXt's introduction and presentation quote..."
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 leading-relaxed resize-none"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    This message is displayed in the main chat canvas hero when RuXt Leader is active.
                  </p>
                </div>

                {/* Custom Photo URL Fallback */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                    <Image className="w-3 h-3 text-slate-500" />
                    Direct Photo URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={localSettings.team_leader_avatar || ''}
                    onChange={(e) => handleChange('team_leader_avatar', e.target.value)}
                    placeholder="https://example.com/avatar.png or /agent-avatars/ruxt.png"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-300 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* WORKSPACE PREFERENCES SECTION */}
              <div className="space-y-4 pt-2">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                  Workspace Preferences
                </h3>

                {/* Workspace Identifier */}
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/90 space-y-2">
                  <label className="block text-xs font-bold text-slate-200">
                    Workspace Identifier
                  </label>
                  <input
                    type="text"
                    value={localSettings.workspace_name || 'RuXt Lab Main'}
                    onChange={(e) => handleChange('workspace_name', e.target.value)}
                    placeholder="RuXt Lab Main"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                  />
                  <p className="text-[11px] text-slate-500">
                    Displayed on companion CLI terminals and internal bridge sessions.
                  </p>
                </div>

                {/* Auto-Scroll Toggle */}
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/90 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">Auto-Scroll During Stream</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Automatically stick to bottom as agent streams tokens.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle('auto_scroll_stream', true)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      localSettings.auto_scroll_stream !== 'false' ? 'bg-indigo-600' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        localSettings.auto_scroll_stream !== 'false' ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Sound & Audio Haptics */}
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/90 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                      {localSettings.sound_haptics !== 'false' ? (
                        <Volume2 className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <VolumeX className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        Sound & Audio Haptics
                        <button
                          type="button"
                          onClick={() => playSound('success')}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 underline font-normal"
                        >
                          (Test Sound)
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Play subtle auditory cues on task completion and message arrivals.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle('sound_haptics', true)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      localSettings.sound_haptics !== 'false' ? 'bg-indigo-600' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        localSettings.sound_haptics !== 'false' ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Simulation Stream Cadence */}
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/90 space-y-3">
                  <div>
                    <div className="text-xs font-bold text-white">Simulation Stream Cadence</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Controls token typing speed for mockups and agent responses.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: '15', label: 'Ultra Fast (15ms)' },
                      { id: '30', label: 'Balanced (30ms)' },
                      { id: '50', label: 'Natural Thought (50ms)' }
                    ].map((cad) => {
                      const isCadActive = (localSettings.stream_cadence || '30') === cad.id;
                      return (
                        <button
                          key={cad.id}
                          type="button"
                          onClick={() => {
                            handleChange('stream_cadence', cad.id);
                            onSaveSetting('stream_cadence', cad.id);
                            if (localSettings.sound_haptics !== 'false') playSound('click');
                          }}
                          className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                            isCadActive
                              ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 ring-1 ring-indigo-500'
                              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {cad.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Save All General & RuXt Details Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleSaveCurrentCategory([
                    'team_leader_avatar',
                    'team_leader_name',
                    'team_leader_email',
                    'team_leader_role',
                    'team_leader_department',
                    'team_leader_skills',
                    'team_leader_bio',
                    'workspace_name',
                    'auto_scroll_stream',
                    'sound_haptics',
                    'stream_cadence'
                  ])}
                  className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-extrabold transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transform active:scale-95 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  Save RuXt Profile & General Settings
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* CATEGORY 2: MODEL PROVIDERS & ACCOUNTS (Images 1 & 2 Match) */}
          {/* ======================================================== */}
          {(activeCategory === 'models' || (isSearching && 'models providers brain llm gemini claude openai antigravity acp'.includes(searchQuery.toLowerCase()))) && (
            <ModelProvidersSection
              providersData={providersData}
              fetchProvidersStatus={fetchProvidersStatus}
              isCheckingProviders={isCheckingProviders}
              handleCleanTempFiles={handleCleanTempFiles}
              cleaningTemp={cleaningTemp}
              cleanFeedback={cleanFeedback}
              expandedProvider={expandedProvider}
              setExpandedProvider={setExpandedProvider}
              cliPathOpen={cliPathOpen}
              setCliPathOpen={setCliPathOpen}
              onSaveSetting={onSaveSetting}
              showNotification={showNotification}
              onNavigateToApiKeys={(providerId) => {
                setActiveCategory('api_keys');
                if (localSettings.sound_haptics !== 'false') playSound('click');
              }}
            />
          )}

          {/* ======================================================== */}
          {/* CATEGORY 2B: API KEYS (Image 3 Match)                    */}
          {/* ======================================================== */}
          {(activeCategory === 'api_keys' || (isSearching && 'api keys token openai anthropic claude gemini xai grok openrouter'.includes(searchQuery.toLowerCase()))) && (
            <ApiKeysSection
              localSettings={localSettings}
              handleChange={handleChange}
              handleSaveApiKey={handleSaveApiKey}
              savedKeyFeedback={savedKeyFeedback}
              showApiKey={showApiKey}
              setShowApiKey={setShowApiKey}
              apiKeySearchQuery={apiKeySearchQuery}
              setApiKeySearchQuery={setApiKeySearchQuery}
              onClose={onClose}
            />
          )}

          {/* ======================================================== */}
          {/* CATEGORY 3: GUARDRAILS & COGNITION                       */}
          {/* ======================================================== */}
          {(activeCategory === 'guardrails' || (isSearching && 'guardrails cognition security autonomous rules'.includes(searchQuery.toLowerCase()))) && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Guardrails & Cognition</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Enforce strict workspace safety policies, reasoning budgets, and fallback chains.
                </p>
              </div>

              {/* Autonomous Execution Policy */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/90 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">Autonomous Shell Execution Policy</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Determines when agents execute terminal actions autonomously.
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    GUARDED
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'safe', label: 'Safe Auto-Run', sub: 'Inspect & read only' },
                    { id: 'confirm', label: 'Ask Confirmation', sub: 'Before file writes' },
                    { id: 'full', label: 'Autonomous Pro', sub: 'Fast execution' }
                  ].map((pol) => {
                    const isPolActive = (localSettings.guardrail_policy || 'safe') === pol.id;
                    return (
                      <button
                        key={pol.id}
                        type="button"
                        onClick={() => {
                          handleChange('guardrail_policy', pol.id);
                          onSaveSetting('guardrail_policy', pol.id);
                          if (localSettings.sound_haptics !== 'false') playSound('click');
                        }}
                        className={`p-3 rounded-xl text-left border transition ${
                          isPolActive
                            ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold text-white">{pol.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{pol.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Max Reasoning Steps Budget */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/90 space-y-3">
                <div>
                  <div className="text-xs font-bold text-white">Max Reasoning / Thinking Steps Budget</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Upper bound on recursive cognitive loops before concluding responses.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: '10', label: 'Snappy (10 steps)' },
                    { id: '25', label: 'Balanced (25 steps)' },
                    { id: '50', label: 'Deep Architecture (50 steps)' }
                  ].map((st) => {
                    const isStepActive = (localSettings.thinking_budget || '25') === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          handleChange('thinking_budget', st.id);
                          onSaveSetting('thinking_budget', st.id);
                          if (localSettings.sound_haptics !== 'false') playSound('click');
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                          isStepActive
                            ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 ring-1 ring-indigo-500'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Strict Context Boundary Toggle */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/90 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Strict Workspace Context Boundary</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Forbid agents from hallucinating code outside your open project structure.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('strict_context_boundary', true)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    localSettings.strict_context_boundary !== 'false' ? 'bg-indigo-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      localSettings.strict_context_boundary !== 'false' ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Fallback Provider Chain Toggle */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/90 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Automated Fallback Brain Chain</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    If active provider suffers 429 quota exhaustion, automatically try secondary brain.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('fallback_brain_chain', true)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    localSettings.fallback_brain_chain !== 'false' ? 'bg-indigo-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      localSettings.fallback_brain_chain !== 'false' ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Global System Prompt Instructions */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/90 space-y-2">
                <label className="block text-xs font-bold text-white">
                  Global System Persona Invariant Rules
                </label>
                <textarea
                  rows={3}
                  value={localSettings.global_system_rules || ''}
                  onChange={(e) => handleChange('global_system_rules', e.target.value)}
                  placeholder="e.g. Always write code with clear comments. Follow Next.js 15 app router conventions..."
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleSaveSingle('global_system_rules')}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                >
                  Save Invariant Rules
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* CATEGORY 4: CLOUD TUNNEL & BRIDGE                        */}
          {/* ======================================================== */}
          {(activeCategory === 'network' || (isSearching && 'tunnel bridge port network lan fastify express'.includes(searchQuery.toLowerCase()))) && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Cloud Tunnel & Companion Bridge</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Connect companion terminal tools, IDE drivers, and external webhook integrations.
                </p>
              </div>

              {/* Port & Host Configuration */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/90 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1">
                      Server Port
                    </label>
                    <input
                      type="text"
                      value={localSettings.server_port || '1234'}
                      onChange={(e) => handleChange('server_port', e.target.value)}
                      placeholder="1234"
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Default local port is 1234.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1">
                      Network Binding
                    </label>
                    <select
                      value={localSettings.network_bind || '0.0.0.0'}
                      onChange={(e) => {
                        handleChange('network_bind', e.target.value);
                        onSaveSetting('network_bind', e.target.value);
                      }}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="0.0.0.0">0.0.0.0 (Local Network / LAN)</option>
                      <option value="127.0.0.1">127.0.0.1 (Strict Localhost Only)</option>
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">Controls remote device access.</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Apply port changes:</span>
                  <button
                    type="button"
                    onClick={() => handleSaveSingle('server_port')}
                    className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                  >
                    Save Port
                  </button>
                </div>
              </div>

              {/* Companion Bridge Token */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/90 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white">Companion Bridge Bearer Token</div>
                  <span className="text-[10px] text-slate-500">Auto-Generated</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={localSettings.bridge_token || 'ruxt_sec_89f029a8c17b5e'}
                    className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-300 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(localSettings.bridge_token || 'ruxt_sec_89f029a8c17b5e');
                      showNotification('Bearer token copied to clipboard!');
                      if (localSettings.sound_haptics !== 'false') playSound('click');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Include as header <code className="text-indigo-400 font-mono">Authorization: Bearer &lt;token&gt;</code> when querying API externally.
                </p>
              </div>

              {/* Bridge Diagnostic Ping */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/90 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Live Bridge Engine Check</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Verify connectivity to internal Node/Express HTTP endpoints.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {pingStatus && (
                    <span className="text-xs font-mono font-semibold text-emerald-400">
                      {pingStatus}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handlePingBridge}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
                  >
                    Ping Bridge
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* CATEGORY 5: APPEARANCE & LAYOUT                          */}
          {/* ======================================================== */}
          {(activeCategory === 'appearance' || (isSearching && 'appearance layout theme color font ui presets dark light ruxt ocean sand'.includes(searchQuery.toLowerCase()))) && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Appearance & Layout</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Personalize themes, visual styles, and UI ergonomics across the entire workspace.
                </p>
              </div>

              {/* 1. SAVED THEME PRESETS (Exact match to user reference image) */}
              <div className="space-y-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                  Saved Theme Presets
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {[
                    {
                      id: 'ruxt',
                      tag: 'RUXT',
                      title: 'RuXt Green',
                      hex: '#143228',
                      bgStyle: 'linear-gradient(135deg, #143228 0%, #081a13 100%)',
                      borderClass: 'border-emerald-800/40 hover:border-emerald-600/60',
                      activeBorderClass: 'border-emerald-400 ring-2 ring-emerald-400/40 shadow-lg shadow-emerald-950/50'
                    },
                    {
                      id: 'light',
                      tag: 'LIGHT',
                      title: 'Clean Light',
                      hex: '#1967ff',
                      bgStyle: 'linear-gradient(135deg, #1967ff 0%, #0d52db 100%)',
                      borderClass: 'border-blue-500/40 hover:border-blue-400',
                      activeBorderClass: 'border-white ring-2 ring-blue-400 shadow-lg shadow-blue-500/30'
                    },
                    {
                      id: 'dark',
                      tag: 'DARK',
                      title: 'Focus Dark',
                      hex: '#7eb6ff',
                      bgStyle: 'linear-gradient(135deg, #0e1726 0%, #060911 100%)',
                      borderClass: 'border-slate-800 hover:border-slate-700',
                      activeBorderClass: 'border-[#7eb6ff] ring-2 ring-[#7eb6ff]/30 shadow-lg shadow-blue-950/60'
                    },
                    {
                      id: 'ocean',
                      tag: 'OCEAN',
                      title: 'Ocean Calm',
                      hex: '#0f6f8a',
                      bgStyle: 'linear-gradient(135deg, #0f6f8a 0%, #062b36 100%)',
                      borderClass: 'border-cyan-800/40 hover:border-cyan-600/60',
                      activeBorderClass: 'border-cyan-400 ring-2 ring-cyan-400/40 shadow-lg shadow-cyan-950/50'
                    },
                    {
                      id: 'sand',
                      tag: 'SAND',
                      title: 'Warm Sand',
                      hex: '#8b5a2b',
                      bgStyle: 'linear-gradient(135deg, #8b5a2b 0%, #3d2310 100%)',
                      borderClass: 'border-amber-800/40 hover:border-amber-600/60',
                      activeBorderClass: 'border-amber-400 ring-2 ring-amber-400/40 shadow-lg shadow-amber-950/50'
                    }
                  ].map((preset) => {
                    const isSelected = (localSettings.theme_preset || 'dark') === preset.id;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => {
                          handleChange('theme_preset', preset.id);
                          onSaveSetting('theme_preset', preset.id);
                          document.documentElement.setAttribute('data-theme', preset.id);
                          if (localSettings.sound_haptics !== 'false') playSound('click');
                          showNotification(`Switched theme to ${preset.title}!`);
                        }}
                        style={{ background: preset.bgStyle }}
                        className={`h-28 rounded-2xl p-3.5 flex flex-col justify-between cursor-pointer transition-all duration-200 select-none border hover:scale-[1.02] ${
                          isSelected ? preset.activeBorderClass : preset.borderClass
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black tracking-wider text-white uppercase drop-shadow-sm">
                            {preset.tag}
                          </span>
                          {isSelected && (
                            <Check className="w-4 h-4 text-emerald-400 stroke-[3] drop-shadow" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white tracking-tight drop-shadow-sm">
                            {preset.title}
                          </div>
                          <div className="text-[10px] text-white/70 font-mono mt-0.5">
                            {preset.hex}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Custom Accent Palette Swatches */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/90 space-y-3">
                <div className="text-xs font-bold text-white">Custom Accent Palette</div>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2.5">
                  {[
                    { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-600' },
                    { id: 'emerald', label: 'RuXt Green', bg: 'bg-emerald-600' },
                    { id: 'blue', label: 'Royal Blue', bg: 'bg-blue-600' },
                    { id: 'cyan', label: 'Cyber Cyan', bg: 'bg-cyan-600' },
                    { id: 'amber', label: 'Warm Amber', bg: 'bg-amber-600' },
                    { id: 'rose', label: 'Rose Pink', bg: 'bg-rose-600' },
                    { id: 'violet', label: 'Violet', bg: 'bg-purple-600' }
                  ].map((col) => {
                    const isSelected = (localSettings.theme_accent || 'indigo') === col.id;
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => {
                          handleChange('theme_accent', col.id);
                          onSaveSetting('theme_accent', col.id);
                          document.documentElement.setAttribute('data-accent', col.id);
                          if (localSettings.sound_haptics !== 'false') playSound('click');
                          showNotification(`Accent color updated to ${col.label}`);
                        }}
                        className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                          isSelected
                            ? 'border-white ring-2 ring-white/40 bg-slate-800 shadow-md'
                            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full ${col.bg} shadow-sm`} />
                        <span className="text-[10px] font-semibold text-slate-300 truncate w-full text-center">
                          {col.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Interface Density */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/90 space-y-3">
                <div className="text-xs font-bold text-white">Interface Density & Sizing</div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'comfortable', label: 'Comfortable', sub: 'Spacious padding & breathing room' },
                    { id: 'compact', label: 'Compact', sub: 'Maximum screen real estate & dense rows' }
                  ].map((den) => {
                    const isDenActive = (localSettings.ui_density || 'comfortable') === den.id;
                    return (
                      <button
                        key={den.id}
                        type="button"
                        onClick={() => {
                          handleChange('ui_density', den.id);
                          onSaveSetting('ui_density', den.id);
                          document.documentElement.setAttribute('data-density', den.id);
                          if (localSettings.sound_haptics !== 'false') playSound('click');
                          showNotification(`Density set to ${den.label}`);
                        }}
                        className={`p-3.5 rounded-xl border text-left transition ${
                          isDenActive
                            ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold text-white">{den.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{den.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Chat Bubble & Message Styling */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/90 space-y-3">
                <div className="text-xs font-bold text-white">Chat Message Bubble Layout</div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'cards', label: 'Modern Rounded Cards', sub: 'Distinct bubbles with subtle borders' },
                    { id: 'minimal', label: 'Minimal Stream Thread', sub: 'Flush markdown thread without cards' }
                  ].map((st) => {
                    const isStyleActive = (localSettings.chat_bubble_style || 'cards') === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          handleChange('chat_bubble_style', st.id);
                          onSaveSetting('chat_bubble_style', st.id);
                          if (localSettings.sound_haptics !== 'false') playSound('click');
                        }}
                        className={`p-3.5 rounded-xl border text-left transition ${
                          isStyleActive
                            ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold text-white">{st.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{st.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. Code Blocks Display Toggles */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/90 space-y-3">
                <div className="text-xs font-bold text-white">Code Editor & Chat Markdown</div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-slate-200">Show line numbers in code blocks</span>
                      <p className="text-[10px] text-slate-500">Displays gutter line indexes in code snippets.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggle('code_line_numbers', true)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        localSettings.code_line_numbers !== 'false' ? 'bg-indigo-600' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          localSettings.code_line_numbers !== 'false' ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-slate-200">Enable programming ligatures</span>
                      <p className="text-[10px] text-slate-500">Connects symbols like =&gt;, ===, and !== into clean glyphs.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const current = localSettings.font_ligatures !== 'false';
                        const nextVal = current ? 'false' : 'true';
                        handleChange('font_ligatures', nextVal);
                        onSaveSetting('font_ligatures', nextVal);
                        document.documentElement.setAttribute('data-ligatures', nextVal);
                        if (localSettings.sound_haptics !== 'false') playSound('toggle');
                      }}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        localSettings.font_ligatures !== 'false' ? 'bg-indigo-600' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          localSettings.font_ligatures !== 'false' ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-slate-200">Glassmorphism & Backdrop Blur</span>
                      <p className="text-[10px] text-slate-500">Enable translucent frosted-glass modal and sidebar surfaces.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggle('glassmorphism', true)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        localSettings.glassmorphism !== 'false' ? 'bg-indigo-600' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          localSettings.glassmorphism !== 'false' ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* CATEGORY 6: SQLITE STORAGE & WAL                         */}
          {/* ======================================================== */}
          {(activeCategory === 'storage' || (isSearching && 'sqlite storage wal database backup vacuum'.includes(searchQuery.toLowerCase()))) && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">SQLite Storage & WAL</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Inspect database disk footprint, run vacuum maintenance, and purge old sessions.
                </p>
              </div>

              {/* Database Status Metrics Card */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/90 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-indigo-400" />
                    <span className="text-xs font-bold text-white">SQLite 3 Database Info</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    WAL ACTIVE
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                    <div className="text-base font-bold text-white">
                      {storageStats?.totalSizeFormatted || 'Calculating...'}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Total Disk Size</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                    <div className="text-base font-bold text-indigo-400">
                      {storageStats?.counts?.messages || 0}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Chat Messages</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                    <div className="text-base font-bold text-purple-400">
                      {storageStats?.counts?.sessions || 0}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Chat Sessions</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                    <div className="text-base font-bold text-emerald-400">
                      {storageStats?.counts?.tasks || 0}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Tasks Tracked</div>
                  </div>
                </div>

                {storageStats?.dbPath && (
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Database Location on Disk</label>
                    <code className="block p-2.5 rounded-xl bg-slate-950 text-[11px] text-slate-300 font-mono truncate border border-slate-800 select-all">
                      {storageStats.dbPath}
                    </code>
                  </div>
                )}
              </div>

              {/* Maintenance Tools */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/90 space-y-3">
                <div className="text-xs font-bold text-white">Database Optimization & Backup</div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleVacuumDb}
                    disabled={vacuuming}
                    className="p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition"
                  >
                    <RefreshCw className={`w-4 h-4 ${vacuuming ? 'animate-spin' : ''}`} />
                    {vacuuming ? 'Compacting...' : 'Vacuum & Compact DB'}
                  </button>

                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition"
                  >
                    <Download className="w-4 h-4 text-indigo-400" />
                    Export Settings Backup
                  </button>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-3">
                <div className="flex items-center gap-2 text-rose-400">
                  <ShieldAlert className="w-4 h-4" />
                  <span className="text-xs font-bold">Storage Danger Zone</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Purge all historical chat sessions and activity logs to free up storage. Your installed agents and API settings will NOT be touched.
                </p>
                <button
                  type="button"
                  onClick={handlePurgeHistory}
                  disabled={purging}
                  className="px-4 py-2 rounded-xl bg-rose-600/80 hover:bg-rose-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {purging ? 'Purging...' : 'Clear All Chat History'}
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* CATEGORY 7: SYSTEM & DIAGNOSTICS                         */}
          {/* ======================================================== */}
          {(activeCategory === 'diagnostics' || (isSearching && 'system diagnostics specs cli runtimes scan'.includes(searchQuery.toLowerCase()))) && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">System & Diagnostics</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Environment telemetry, local CLI runtimes, and engine logs.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onScanRuntimes}
                  disabled={scanningRuntimes}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-md shadow-indigo-600/25"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${scanningRuntimes ? 'animate-spin' : ''}`} />
                  {scanningRuntimes ? 'Scanning PC...' : 'Rescan Local PC'}
                </button>
              </div>

              {/* System Specs */}
              {diagInfo?.system && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Host OS</div>
                    <div className="text-xs font-bold text-white mt-0.5 truncate">{diagInfo.system.os}</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Node Engine</div>
                    <div className="text-xs font-bold text-emerald-400 mt-0.5 font-mono">{diagInfo.system.nodeVersion}</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Available Memory</div>
                    <div className="text-xs font-bold text-indigo-400 mt-0.5">{diagInfo.system.memoryFreeMB} MB / {diagInfo.system.memoryTotalMB} MB</div>
                  </div>
                </div>
              )}

              {/* PC Discovered Runtimes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    Discovered Local Tools & Engines
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">5-Tier Discovery Cascade</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {runtimes.map((rt) => (
                    <div
                      key={rt.id}
                      className={`p-3.5 rounded-2xl border transition flex items-start justify-between ${
                        rt.installed 
                          ? 'bg-slate-950/80 border-emerald-500/30' 
                          : 'bg-slate-950/40 border-slate-800 text-slate-500'
                      }`}
                    >
                      <div className="flex-1 pr-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-white text-xs">{rt.name}</span>
                          {rt.isRunning ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-bold border border-emerald-500/40 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              RUNNING
                            </span>
                          ) : rt.installed ? (
                            <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[9px] font-bold border border-indigo-500/30">
                              INSTALLED
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-500 text-[9px]">
                              Not in PATH
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">{rt.description}</p>
                        {rt.path && (
                          <code className="text-[10px] text-slate-500 block truncate font-mono mt-1">
                            {rt.path}
                          </code>
                        )}
                      </div>
                      {rt.installed && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity Logs Mini Viewer */}
              {diagInfo?.recentLogs && diagInfo.recentLogs.length > 0 && (
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-400" />
                    Engine Activity Trail
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {diagInfo.recentLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[9px] font-mono uppercase">
                            {log.type}
                          </span>
                          <span className="text-slate-300 text-[11px] truncate">{log.message}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-2">
                          {new Date(log.timestamp || log.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
