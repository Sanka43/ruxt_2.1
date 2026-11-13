import React, { useState, useEffect, useMemo, useRef } from 'react';
import SettingsView, { playSound } from './components/SettingsView.jsx';
import BoardRoomPanel from './components/BoardRoomPanel.jsx';
import KanbanBoard from './components/KanbanBoard.jsx';
import MarkdownRenderer from './components/MarkdownRenderer.jsx';
import DesktopLiveOperatorCard from './components/DesktopLiveOperatorCard.jsx';
import AgentStudioModal from './components/AgentStudioModal.jsx';
import { 
  Bot, 
  MessageSquare, 
  CheckSquare, 
  Settings, 
  LayoutDashboard, 
  ExternalLink, 
  Plus, 
  Send, 
  Key, 
  CheckCircle2, 
  AlertCircle,
  Database,
  Cpu,
  Layers,
  Sparkles,
  RefreshCw,
  Trash2,
  ShoppingBag,
  Users,
  Download,
  Upload,
  Star,
  Search,
  Check,
  Copy,
  UserCheck,
  Crown,
  ShieldAlert,
  Terminal,
  Laptop,
  Zap,
  Activity,
  Pause,
  PowerOff,
  ChevronDown,
  ChevronRight,
  X,
  UserPlus,
  ArrowUp,
  Mic,
  Paperclip,
  Folder,
  Landmark,
  Wand2,
  Sun,
  Moon
} from 'lucide-react';

function EngineStatusControl({ providerId, currentStatus, onSetStatus }) {
  const status = currentStatus || 'connected';
  return (
    <div className="flex items-center gap-1 bg-slate-950/90 border border-slate-800 rounded-xl p-1 shrink-0">
      <button
        type="button"
        onClick={() => onSetStatus(`engine_status_${providerId}`, 'connected')}
        title="Connect & Enable this Engine"
        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
          status === 'connected'
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
        Connect
      </button>
      <button
        type="button"
        onClick={() => onSetStatus(`engine_status_${providerId}`, 'paused')}
        title="Temporarily Pause / Suspend this Engine"
        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
          status === 'paused'
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        <Pause className="w-3 h-3 text-amber-400" />
        Pause
      </button>
      <button
        type="button"
        onClick={() => onSetStatus(`engine_status_${providerId}`, 'disconnected')}
        title="Disconnect & Disable this Engine"
        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
          status === 'disconnected'
            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        <PowerOff className="w-3 h-3 text-rose-400" />
        Disconnect
      </button>
    </div>
  );
}

export const AVATAR_MAP = {
  'ruxt': '/agent-avatars/ruxt.png',
  'julian-vance': '/agent-avatars/julian-vance.png',
  'maya-brooks': '/agent-avatars/maya-brooks.png',
  'noah-reed': '/agent-avatars/noah-reed.png',
  'elena-voss': '/agent-avatars/elena-voss.png',
  'elena-voss-chess': '/agent-avatars/elena-voss.png',
  'marcus-sterling': '/agent-avatars/marcus-sterling.png',
  'numbers': '/agent-avatars/numbers.png'
};

export function getAgentAvatar(slug, customAvatar = null, version = null) {
  let url = '';

  // 1. If explicit customAvatar is provided and valid
  if (customAvatar && typeof customAvatar === 'string' && customAvatar.trim()) {
    const trimmed = customAvatar.trim();
    if (
      trimmed.startsWith('data:') ||
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('/') ||
      trimmed.startsWith('./')
    ) {
      url = trimmed;
    }
  }

  // 2. If no valid custom avatar URL yet, resolve by slug
  if (!url) {
    const cleanSlug = (slug || '').toLowerCase().trim();
    if (cleanSlug) {
      if (AVATAR_MAP[cleanSlug]) {
        url = AVATAR_MAP[cleanSlug];
      } else if (cleanSlug.includes('elena-voss')) {
        url = '/agent-avatars/elena-voss.png';
      } else if (cleanSlug.includes('julian-vance')) {
        url = '/agent-avatars/julian-vance.png';
      } else if (cleanSlug.includes('maya-brooks')) {
        url = '/agent-avatars/maya-brooks.png';
      } else if (cleanSlug.includes('noah-reed')) {
        url = '/agent-avatars/noah-reed.png';
      } else if (cleanSlug.includes('marcus-sterling')) {
        url = '/agent-avatars/marcus-sterling.png';
      } else if (cleanSlug.includes('numbers')) {
        url = '/agent-avatars/numbers.png';
      } else if (cleanSlug === 'ruxt') {
        url = '/agent-avatars/ruxt.png';
      } else {
        // Any custom specialist created via Agent Studio (e.g. damon-cole)
        url = `/agent-avatars/${cleanSlug}.png`;
      }
    } else {
      url = '/agent-avatars/ruxt.png';
    }
  }

  // 3. Optional version query param for cache busting
  if (version && url && !url.startsWith('data:') && !url.includes('?')) {
    url = `${url}?v=${encodeURIComponent(version)}`;
  }

  return url;
}

const DEFAULT_SPECIALISTS = [
  { slug: 'julian-vance', name: 'Julian Vance', role: 'Senior Frontend Web Developer', avatar: '/agent-avatars/julian-vance.png' },
  { slug: 'maya-brooks', name: 'Maya Brooks', role: 'Chief Financial Analyst', avatar: '/agent-avatars/maya-brooks.png' },
  { slug: 'noah-reed', name: 'Noah Reed', role: 'Security & Cloud DevOps', avatar: '/agent-avatars/noah-reed.png' },
  { slug: 'elena-voss-chess', name: 'Elena Voss', role: 'Strategic Game Intelligence', avatar: '/agent-avatars/elena-voss.png' },
  { slug: 'marcus-sterling', name: 'Marcus Sterling', role: 'Enterprise Legal Counsel', avatar: '/agent-avatars/marcus-sterling.png' },
  { slug: 'numbers', name: 'Numbers', role: 'Quantitative Data Analyst', avatar: '/agent-avatars/numbers.png' }
];

const DOMAIN_DEFINITIONS = [
  {
    id: 'web_tech',
    label: 'Web & Software Development',
    tokens: [
      'web', 'frontend', 'front-end', 'front end', 'backend', 'back-end', 'react', 'next', 'vue',
      'tailwind', 'css', 'html', 'js', 'ts', 'javascript', 'typescript', 'ui', 'ux', 'design',
      'site', 'website', 'page', 'dashboard', 'app', 'application', 'dev', 'develop', 'development',
      'developmet', 'coding', 'code', 'software', 'interface', 'vite', 'node', 'fullstack'
    ],
    matchingSlugs: ['julian-vance', 'noah-reed'],
    conflictingSlugs: ['elena-voss-chess']
  },
  {
    id: 'devops_cloud',
    label: 'Cloud & Infrastructure DevOps',
    tokens: [
      'cloud', 'devops', 'docker', 'kubernetes', 'k8s', 'aws', 'azure', 'gcp', 'ci/cd',
      'deploy', 'deployment', 'server', 'infrastructure', 'infra', 'linux', 'security', 'pipeline'
    ],
    matchingSlugs: ['noah-reed', 'julian-vance'],
    conflictingSlugs: ['elena-voss-chess']
  },
  {
    id: 'finance_accounting',
    label: 'Finance, Tax & Accounting',
    tokens: [
      'finance', 'financial', 'budget', 'revenue', 'accounting', 'tax', 'taxes', 'audit',
      'auditing', 'profit', 'valuation', 'forecast', 'fiscal', 'investment', 'balance sheet',
      'cash flow', 'earnings', 'money', 'cost'
    ],
    matchingSlugs: ['maya-brooks', 'numbers', 'noah-reed'],
    conflictingSlugs: ['elena-voss-chess', 'julian-vance']
  },
  {
    id: 'data_analysis',
    label: 'Quantitative Data & Spreadsheets',
    tokens: [
      'data', 'analytics', 'analysis', 'quantitative', 'spreadsheet', 'excel', 'numbers',
      'metrics', 'formula', 'statistics', 'math', 'csv', 'calculation', 'table', 'computation'
    ],
    matchingSlugs: ['numbers', 'maya-brooks'],
    conflictingSlugs: ['elena-voss-chess']
  },
  {
    id: 'legal',
    label: 'Legal & Compliance',
    tokens: [
      'legal', 'law', 'lawyer', 'contract', 'contracts', 'agreement', 'compliance',
      'terms', 'nda', 'regulation', 'dispute', 'counsel', 'license', 'gdpr', 'policy'
    ],
    matchingSlugs: ['marcus-sterling', 'noah-reed'],
    conflictingSlugs: ['elena-voss-chess']
  },
  {
    id: 'chess_gaming',
    label: 'Chess & Game Coaching',
    tokens: [
      'chess', 'game', 'gaming', 'board', 'boardgame', 'tactics', 'gambit', 'endgame',
      'opening', 'coach', 'coaching', 'checkmate', 'grandmaster', 'puzzle', 'play'
    ],
    matchingSlugs: ['elena-voss-chess'],
    conflictingSlugs: ['julian-vance', 'maya-brooks', 'marcus-sterling', 'numbers', 'noah-reed']
  }
];

function evaluateMissionSquadFit(missionText, selectedSlugs, specialistList) {
  const text = (missionText || '').toLowerCase().trim();
  if (!text || text.length < 2) {
    return { mismatched: [], recommended: [], aligned: [] };
  }

  const words = text.split(/[\s,./\\_-]+/).filter(Boolean);

  const activeDomains = [];
  for (const domain of DOMAIN_DEFINITIONS) {
    let score = 0;
    for (const token of domain.tokens) {
      if (text.includes(token) || words.some(w => w.startsWith(token) || token.startsWith(w))) {
        score++;
      }
    }
    if (score > 0) {
      activeDomains.push({ domain, score });
    }
  }

  activeDomains.sort((a, b) => b.score - a.score);

  const selectedSet = new Set(selectedSlugs || []);
  const mismatched = [];
  const recommended = [];
  const aligned = [];

  if (activeDomains.length > 0) {
    const primaryDomain = activeDomains[0].domain;
    const allConflictingSlugs = new Set();
    const allMatchingSlugs = new Set();

    for (const item of activeDomains) {
      item.domain.conflictingSlugs.forEach(s => allConflictingSlugs.add(s));
      item.domain.matchingSlugs.forEach(s => allMatchingSlugs.add(s));
    }

    // Never conflict if the agent also matches any active domain
    for (const slug of allMatchingSlugs) {
      allConflictingSlugs.delete(slug);
    }

    for (const agent of specialistList) {
      if (agent.slug === 'ruxt') continue;
      const isSelected = selectedSet.has(agent.slug);

      if (isSelected) {
        if (allConflictingSlugs.has(agent.slug)) {
          mismatched.push({
            slug: agent.slug,
            name: agent.name,
            role: agent.role,
            avatar: agent.avatar,
            reason: `${agent.name} (${agent.role}) does not match ${primaryDomain.label}.`
          });
        } else {
          aligned.push({
            slug: agent.slug,
            name: agent.name,
            role: agent.role,
            avatar: agent.avatar
          });
        }
      } else {
        if (allMatchingSlugs.has(agent.slug) && !allConflictingSlugs.has(agent.slug)) {
          recommended.push({
            slug: agent.slug,
            name: agent.name,
            role: agent.role,
            avatar: agent.avatar,
            reason: `Recommended specialist for ${primaryDomain.label}.`
          });
        }
      }
    }
  } else {
    for (const agent of specialistList) {
      if (agent.slug === 'ruxt') continue;
      if (selectedSet.has(agent.slug)) {
        aligned.push({
          slug: agent.slug,
          name: agent.name,
          role: agent.role,
          avatar: agent.avatar
        });
      }
    }
  }

  return { mismatched, recommended, aligned };
}

export default function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [agents, setAgents] = useState([]);
  const [marketplaceAgents, setMarketplaceAgents] = useState([]);
  const [marketplaceFilter, setMarketplaceFilter] = useState('all');
  const [marketplaceSearch, setMarketplaceSearch] = useState('');
  const [installingSlug, setInstallingSlug] = useState(null);
  const [selectedMarketAgent, setSelectedMarketAgent] = useState(null);
  const [isAgentStudioOpen, setIsAgentStudioOpen] = useState(false);
  const [agentToEdit, setAgentToEdit] = useState(null);
  const [isImportingPackage, setIsImportingPackage] = useState(false);
  const ruxtFileInputRef = useRef(null);
  const [tasks, setTasks] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [selectedMockupCode, setSelectedMockupCode] = useState(null);
  const [workspaceStats, setWorkspaceStats] = useState(null);
  const [settings, setSettings] = useState({
    active_provider: 'gemini',
    gemini_api_key: '',
    gemini_model: 'gemini-2.0-flash',
    anthropic_api_key: '',
    claude_model: 'claude-3-7-sonnet-20250219',
    openai_api_key: '',
    openai_model: 'gpt-4o-mini',
    ollama_host: 'http://localhost:11434',
    ollama_model: 'deepseek-r1:latest',
    custom_base_url: 'http://localhost:1234/v1',
    custom_model: 'default'
  });
  const [selectedAgentUi, setSelectedAgentUi] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAgent, setNewTaskAgent] = useState('');
  const [notification, setNotification] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsCategory, setSettingsCategory] = useState('overview');

  // Board Room & Sequential Pipeline States
  const [isBoardRoomOpen, setIsBoardRoomOpen] = useState(false);
  const [boardroomSession, setBoardroomSession] = useState(null);
  const [boardroomMessages, setBoardroomMessages] = useState([]);
  const [boardroomTasks, setBoardroomTasks] = useState([]);
  const [isExecutingPipeline, setIsExecutingPipeline] = useState(false);

  // Inter-Agent Right-Side Consultation Popup State
  const [activeSubChatPopup, setActiveSubChatPopup] = useState(null);

  // Live Desktop & Vision Engine Control States
  const [isDesktopRunning, setIsDesktopRunning] = useState(false);
  const [activeDesktopGoal, setActiveDesktopGoal] = useState('');

  // Floating Modern Input & Tooling States (Matching RuXt Assistant Design)
  const [isTurboEnabled, setIsTurboEnabled] = useState(false);
  const [selectedWorkspaceName, setSelectedWorkspaceName] = useState('Primary Workspace');
  const [selectedProjectName, setSelectedProjectName] = useState('All Projects');
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const fileInputRef = React.useRef(null);

  // Sidebar Agents collapsible list state
  const [isAgentsOpen, setIsAgentsOpen] = useState(true);
  const [showAllAgents, setShowAllAgents] = useState(false);

  // Create Team Modal & State (RuXt excluded as he is overall Team Leader)
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [newTeamTitle, setNewTeamTitle] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [newTeamSelectedAgents, setNewTeamSelectedAgents] = useState(['julian-vance', 'noah-reed']);
  const [squadAlignment, setSquadAlignment] = useState({ mismatched: [], recommended: [], aligned: [] });
  const [isAnalyzingSquad, setIsAnalyzingSquad] = useState(false);
  const [showMismatchConfirmModal, setShowMismatchConfirmModal] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState(null);
  const [customTeams, setCustomTeams] = useState(() => {
    try {
      const saved = localStorage.getItem('ruxt_custom_teams');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Exclude 'ruxt' slug from custom team members as RuXt has leader access to all teams
          return parsed.map(t => ({
            ...t,
            agentSlugs: (t.agentSlugs || []).filter(s => s !== 'ruxt')
          })).filter(t => t.agentSlugs.length > 0);
        }
      }
    } catch (_) {}
    return [
      {
        id: 'team-core',
        title: 'Core Dev Squad',
        description: 'Frontend Architecture and Cloud Infrastructure',
        agentSlugs: ['julian-vance', 'noah-reed']
      }
    ];
  });

  // Persist custom teams to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ruxt_custom_teams', JSON.stringify(customTeams));
    } catch (_) {}
  }, [customTeams]);

  // Expanded teams map for accordion view
  const [expandedTeams, setExpandedTeams] = useState({ 'team-core': true });

  // Expanded agent chat histories map for sidebar accordion view
  const [expandedAgentHistories, setExpandedAgentHistories] = useState({ ruxt: true });

  const toggleExpandTeam = (teamId) => {
    setExpandedTeams(prev => ({
      ...prev,
      [teamId]: !prev[teamId]
    }));
  };

  // Specialist Agents List (Excludes RuXt who is exclusively the Leader at the top)
  const specialistAgents = useMemo(() => {
    const list = (agents && agents.length > 0) ? agents.filter(a => a.slug !== 'ruxt') : [];
    const slugs = new Set(list.map(a => a.slug));
    const extra = DEFAULT_SPECIALISTS.filter(a => !slugs.has(a.slug));
    return [...list, ...extra].map(ag => ({
      ...ag,
      avatar: getAgentAvatar(ag.slug, ag.avatar)
    }));
  }, [agents]);

  // Displayed specialist agents: 5 by default, or all if expanded
  const displayedAgents = showAllAgents ? specialistAgents : specialistAgents.slice(0, 5);

  const toggleAgentInTeam = (slug) => {
    setNewTeamSelectedAgents(prev => 
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
    );
  };

  const handleRemoveSpecialist = (slug) => {
    setNewTeamSelectedAgents(prev => prev.filter(s => s !== slug));
    showNotification('Removed specialist from team selection');
  };

  const handleAddSpecialist = (slug) => {
    setNewTeamSelectedAgents(prev => prev.includes(slug) ? prev : [...prev, slug]);
    showNotification('Added specialist to team selection');
  };

  const handleRemoveAllMismatched = () => {
    const mismatchedSlugs = new Set(squadAlignment.mismatched.map(m => m.slug));
    setNewTeamSelectedAgents(prev => prev.filter(slug => !mismatchedSlugs.has(slug)));
    showNotification(`Removed ${squadAlignment.mismatched.length} mismatched specialist(s)`);
  };

  const handleAddAllRecommended = () => {
    const recSlugs = squadAlignment.recommended.map(r => r.slug);
    setNewTeamSelectedAgents(prev => Array.from(new Set([...prev, ...recSlugs])));
    showNotification(`Added ${recSlugs.length} recommended specialist(s) to team`);
  };

  // Real-time dynamic mission & specialist alignment analysis
  useEffect(() => {
    if (!isCreateTeamOpen) return;
    
    // 1. Instant client-side analysis
    const instantResult = evaluateMissionSquadFit(newTeamDescription, newTeamSelectedAgents, specialistAgents);
    setSquadAlignment(instantResult);

    // 2. Debounced deep server/AI alignment analysis if mission has substance
    if (!newTeamDescription.trim() || newTeamDescription.trim().length < 5) return;

    const timer = setTimeout(async () => {
      setIsAnalyzingSquad(true);
      try {
        const res = await fetch('/api/agents/analyze-mission', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mission: newTeamDescription,
            selectedSlugs: newTeamSelectedAgents
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.success) {
            setSquadAlignment({
              mismatched: data.mismatched || instantResult.mismatched,
              recommended: data.recommended || instantResult.recommended,
              aligned: data.aligned || instantResult.aligned
            });
          }
        }
      } catch (_) {
        // Fallback already active via instantResult
      } finally {
        setIsAnalyzingSquad(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [isCreateTeamOpen, newTeamDescription, newTeamSelectedAgents, specialistAgents]);

  const executeCreateTeam = (overrideSlugs = null) => {
    const rawSlugs = overrideSlugs || newTeamSelectedAgents;
    const selectedSlugs = rawSlugs.filter(s => s !== 'ruxt');

    if (!newTeamTitle.trim()) {
      showNotification('Please enter a team title', 'error');
      return;
    }
    if (!newTeamDescription.trim()) {
      showNotification('Mission / Objective is strictly required to assemble a squad', 'error');
      return;
    }
    if (selectedSlugs.length === 0) {
      showNotification('Please select at least 1 specialist for the team', 'error');
      return;
    }

    const team = {
      id: 'team-' + Date.now(),
      title: newTeamTitle.trim(),
      description: newTeamDescription.trim(),
      agentSlugs: selectedSlugs,
      createdAt: new Date().toISOString()
    };

    setCustomTeams(prev => [team, ...prev]);
    setExpandedTeams(prev => ({ ...prev, [team.id]: true }));
    showNotification(`✓ Team "${team.title}" created with ${selectedSlugs.length} specialists!`);
    setNewTeamTitle('');
    setNewTeamDescription('');
    setNewTeamSelectedAgents(['julian-vance']);
    setSquadAlignment({ mismatched: [], recommended: [], aligned: [] });
    setShowMismatchConfirmModal(false);
    setIsCreateTeamOpen(false);
  };

  const handleCreateTeam = (e) => {
    if (e) e.preventDefault();
    if (!newTeamTitle.trim()) {
      showNotification('Please enter a team title', 'error');
      return;
    }
    if (!newTeamDescription.trim()) {
      showNotification('Mission / Objective is required to assemble a squad', 'error');
      return;
    }
    if (newTeamSelectedAgents.length === 0) {
      showNotification('Please select at least 1 agent for the team', 'error');
      return;
    }

    // Immediately evaluate alignment synchronously to guarantee zero bypass
    const checkFit = evaluateMissionSquadFit(newTeamDescription, newTeamSelectedAgents, specialistAgents);
    if (checkFit.mismatched && checkFit.mismatched.length > 0) {
      setSquadAlignment(checkFit);
      setShowMismatchConfirmModal(true);
      showNotification(`⚠️ Squad Alignment Notice: ${checkFit.mismatched.length} specialist(s) do not match this mission`, 'warning');
      return;
    }

    executeCreateTeam();
  };

  const promptDeleteTeam = (team, e) => {
    if (e) e.stopPropagation();
    setTeamToDelete(team);
  };

  const confirmDeleteTeam = () => {
    if (!teamToDelete) return;
    const deletedTitle = teamToDelete.title;
    setCustomTeams(prev => prev.filter(t => t.id !== teamToDelete.id));
    showNotification(`Squad "${deletedTitle}" deleted`);
    setTeamToDelete(null);
  };

  const handleDeleteTeam = (teamId, e) => {
    if (e) e.stopPropagation();
    const team = customTeams.find(t => t.id === teamId);
    if (team) {
      setTeamToDelete(team);
    } else {
      setCustomTeams(prev => prev.filter(t => t.id !== teamId));
      showNotification('Team removed');
    }
  };

  const handleStartTeamChat = (team) => {
    const leadSlug = team.agentSlugs.includes('ruxt') ? 'ruxt' : team.agentSlugs[0];
    handleCreateSession(leadSlug, `[Squad: ${team.title}] Active Dispatch`);
    setActiveTab('chat');
    showNotification(`Started dispatch session with ${team.title}`);
  };

  const openSettings = (category = 'overview') => {
    setSettingsCategory(category);
    setIsSettingsOpen(true);
  };

  const wasDesktopRunningRef = useRef(false);
  const activeSessionIdRef = useRef(activeSession?.id);
  useEffect(() => {
    activeSessionIdRef.current = activeSession?.id;
  }, [activeSession?.id]);

  const handleAbortActiveDesktop = async () => {
    try {
      await fetch('/api/desktop/abort-active', { method: 'POST' });
      setIsDesktopRunning(false);
      setActiveDesktopGoal('');
      showNotification('⏹️ Vision Engine aborted by user', 'info');
      if (activeSession?.id && !activeSession.id.startsWith('temp-')) {
        setTimeout(async () => {
          try {
            const msgRes = await fetch(`/api/chat/sessions/${activeSession.id}/messages`);
            const msgData = await msgRes.json();
            if (msgData?.messages) setMessages(msgData.messages);
          } catch (_) {}
        }, 600);
      }
    } catch (err) {
      console.error('Failed to abort desktop task:', err);
    }
  };

  // Poll for Active Desktop / Vision Engine tasks
  useEffect(() => {
    let isMounted = true;
    const pollActiveDesktop = async () => {
      try {
        const res = await fetch('/api/desktop/active-status');
        const data = await res.json();
        if (isMounted) {
          const wasActive = wasDesktopRunningRef.current;
          const isActive = !!data?.active;
          setIsDesktopRunning(isActive);
          wasDesktopRunningRef.current = isActive;

          if (data?.job?.goal) setActiveDesktopGoal(data.job.goal);
          else if (!isActive) setActiveDesktopGoal('');

          // When desktop execution finishes or stops halfway, immediately refresh chat messages
          if (wasActive && !isActive && activeSessionIdRef.current && !activeSessionIdRef.current.startsWith('temp-')) {
            setTimeout(async () => {
              try {
                const msgRes = await fetch(`/api/chat/sessions/${activeSessionIdRef.current}/messages`);
                const msgData = await msgRes.json();
                if (msgData?.messages && isMounted) {
                  setMessages(msgData.messages);
                }
              } catch (_) {}
            }, 600);
          }
        }
      } catch (_) {}
    };
    const interval = setInterval(pollActiveDesktop, 1500);
    pollActiveDesktop();
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Close modals & Emergency Stop on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isDesktopRunning) {
          handleAbortActiveDesktop();
        }
        setIsSettingsOpen(false);
        setIsCreateTeamOpen(false);
        setTeamToDelete(null);
        setSelectedMarketAgent(null);
        setSelectedMockupCode(null);
        setIsWorkspaceDropdownOpen(false);
        setIsProjectDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDesktopRunning]);

  // Synchronize Active Theme Preset & Ergonomics across entire Application
  useEffect(() => {
    const theme = settings.theme_preset || 'light';
    const accent = settings.theme_accent || (theme === 'light' ? 'blue' : 'indigo');
    const density = settings.ui_density || 'comfortable';
    const ligatures = settings.font_ligatures !== 'false';

    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-accent', accent);
    document.documentElement.setAttribute('data-density', density);
    document.documentElement.setAttribute('data-ligatures', ligatures ? 'true' : 'false');

    const LIGHT_THEMES = ['light', 'solarized-light', 'pure-white'];
    const isLightTheme = LIGHT_THEMES.includes(theme);

    if (isLightTheme) {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
  }, [settings.theme_preset, settings.theme_accent, settings.ui_density, settings.font_ligatures]);

  const isLightMode = ['light', 'solarized-light', 'pure-white'].includes(settings.theme_preset || 'light');

  const toggleLightDarkTheme = () => {
    const current = settings.theme_preset || 'light';
    const isCurrentlyLight = ['light', 'solarized-light', 'pure-white'].includes(current);
    const nextTheme = isCurrentlyLight ? 'dark' : 'light';
    handleSaveSetting('theme_preset', nextTheme);
    showNotification(`Switched to ${nextTheme === 'light' ? 'Clean Light' : 'Focus Dark'} mode!`, 'info');
  };

  // Runtime Detection & Diagnostics States
  const [detectedRuntimes, setDetectedRuntimes] = useState([]);
  const [scanningRuntimes, setScanningRuntimes] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState(null);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Background Updater Notification Listener
  useEffect(() => {
    if (window.ruxtDesktop?.onUpdaterEvent) {
      const unsubAvail = window.ruxtDesktop.onUpdaterEvent('updater-update-available', (info) => {
        showNotification(`🎉 New update v${info.version} available! Check Settings > Software Updates.`, 'info');
      });
      const unsubDownloaded = window.ruxtDesktop.onUpdaterEvent('updater-downloaded', (info) => {
        showNotification(`🚀 Update v${info.version} downloaded! Restart to apply.`, 'success');
      });
      return () => {
        if (typeof unsubAvail === 'function') unsubAvail();
        if (typeof unsubDownloaded === 'function') unsubDownloaded();
      };
    }
  }, []);

  // Fetch Marketplace Catalog
  const fetchMarketplaceAgents = async () => {
    try {
      const res = await fetch('/api/marketplace/agents');
      const data = await res.json();
      if (data?.agents) {
        setMarketplaceAgents(data.agents);
      }
    } catch (err) {
      console.error('Failed to load marketplace agents:', err);
    }
  };

  // Scan Host PC for Installed AI Tools
  const scanHostRuntimes = async () => {
    setScanningRuntimes(true);
    try {
      const res = await fetch('/api/settings/detect-runtimes');
      const data = await res.json();
      if (data?.runtimes) {
        setDetectedRuntimes(data.runtimes);
        showNotification('✓ Local PC scan completed! Found AI runtimes.');
      }
    } catch (err) {
      showNotification('✕ Failed to scan local PC', 'error');
    } finally {
      setScanningRuntimes(false);
    }
  };

  const fetchSafeJson = async (url) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null;
    }
  };

  // Initial Data Fetching
  const fetchAllData = async () => {
    try {
      const [agentsRes, tasksRes, sessionsRes, statsRes, settingsRes] = await Promise.all([
        fetchSafeJson('/api/agents'),
        fetchSafeJson('/api/tasks'),
        fetchSafeJson('/api/chat/sessions'),
        fetchSafeJson('/api/workspace'),
        fetchSafeJson('/api/settings')
      ]);

      if (agentsRes?.agents && Array.isArray(agentsRes.agents)) {
        setAgents(agentsRes.agents);
      }
      if (tasksRes?.tasks) setTasks(tasksRes.tasks);
      if (sessionsRes?.sessions && sessionsRes.sessions.length > 0) {
        setSessions(sessionsRes.sessions);
        if (!activeSession) {
          setActiveSession(sessionsRes.sessions[0]);
        }
      } else {
        // Prepare a clean initial conversation draft with RuXt Leader (persists only when first message is sent)
        if (!activeSession) {
          const tempId = 'temp-' + Date.now();
          setActiveSession({
            id: tempId,
            agent_id: 'ruxt',
            title: 'Coordinate with RuXt (Team Leader)',
            created_at: new Date().toISOString()
          });
        }
      }
      if (statsRes?.workspace) setWorkspaceStats(statsRes.workspace);
      if (settingsRes?.settings) {
        setSettings(prev => ({ ...prev, ...settingsRes.settings }));
      }
      
      fetchMarketplaceAgents();
      scanHostRuntimes();
      fetchActiveBoardroom();
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Auto-refresh agents if switching to agent tab and list is empty
  useEffect(() => {
    if (activeTab === 'agents' && agents.length === 0) {
      fetchSafeJson('/api/agents').then(data => {
        if (data?.agents && Array.isArray(data.agents)) {
          setAgents(data.agents);
        }
      });
    }
  }, [activeTab]);

  // Fetch messages when activeSession changes
  useEffect(() => {
    if (!activeSession?.id) return;
    if (activeSession.id.startsWith('temp-')) {
      setMessages([]);
      return;
    }
    fetchSafeJson(`/api/chat/sessions/${activeSession.id}/messages`)
      .then(data => {
        if (data?.messages) setMessages(data.messages);
        else setMessages([]);
      })
      .catch(() => setMessages([]));
  }, [activeSession?.id]);

  // Install Agent from Marketplace
  const handleInstallAgent = async (slug) => {
    setInstallingSlug(slug);
    try {
      const res = await fetch('/api/marketplace/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug })
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`✓ ${data.message || 'Agent hired successfully!'}`);
        await fetchAllData();
      } else {
        showNotification(`✕ Error: ${data.error || 'Failed to hire agent'}`, 'error');
      }
    } catch (err) {
      showNotification(`✕ Connection error: ${err.message}`, 'error');
    } finally {
      setInstallingSlug(null);
    }
  };

  // Uninstall Agent
  const handleUninstallAgent = async (slug) => {
    if (slug === 'ruxt') {
      showNotification('✕ Cannot dismiss RuXt: It is your Team Leader.', 'error');
      return;
    }
    if (!confirm(`Are you sure you want to dismiss and uninstall ${slug}?`)) return;
    try {
      const res = await fetch(`/api/marketplace/uninstall/${slug}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showNotification(`Agent dismissed and uninstalled.`);
        await fetchAllData();
      }
    } catch (err) {
      showNotification(`✕ Error: ${err.message}`, 'error');
    }
  };

  // Import .ruxt Package Handler
  const handleImportRuxtPackage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingPackage(true);
    showNotification(`Importing ${file.name}...`);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const fileBase64 = event.target?.result;
          const res = await fetch('/api/marketplace/import-package', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileBase64,
              fileName: file.name
            })
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Failed to import agent package');
          }

          showNotification(`✓ ${data.message || 'Agent package imported successfully!'}`);
          await fetchAllData();
          await fetchMarketplaceAgents();
        } catch (innerErr) {
          showNotification(`✕ Import failed: ${innerErr.message}`, 'error');
        } finally {
          setIsImportingPackage(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      showNotification(`✕ Error reading package: ${err.message}`, 'error');
      setIsImportingPackage(false);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Open Agent Studio in Edit / Skill Up Mode
  const handleOpenEditAgent = (targetAgent) => {
    setAgentToEdit(targetAgent);
    setIsAgentStudioOpen(true);
  };

  // Voice Speech Recognition Handler
  const toggleVoiceRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showNotification('Speech recognition is not supported in this browser environment', 'error');
      return;
    }

    if (isRecordingVoice) {
      if (window._ruxtSpeechRec) {
        try { window._ruxtSpeechRec.stop(); } catch (_) {}
        window._ruxtSpeechRec = null;
      }
      setIsRecordingVoice(false);
      showNotification('Voice dictation paused');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecordingVoice(true);
        showNotification('🎙️ Listening... Speak into your microphone');
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInputMessage(prev => (prev ? prev + ' ' : '') + transcript);
        }
      };

      recognition.onerror = (err) => {
        console.warn('Speech recognition error:', err);
        setIsRecordingVoice(false);
      };

      recognition.onend = () => {
        setIsRecordingVoice(false);
      };

      window._ruxtSpeechRec = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsRecordingVoice(false);
    }
  };

  const handleFileAttach = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedFiles(prev => [...prev, {
          id: 'file-' + Date.now() + '-' + Math.random(),
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB',
          type: file.type,
          dataUrl: reader.result
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
    showNotification(`✓ ${files.length} file(s) attached`);
  };

  const handlePasteClipboard = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            setAttachedFiles(prev => [...prev, {
              id: 'file-pasted-' + Date.now(),
              name: `screenshot-${new Date().toLocaleTimeString().replace(/:/g, '-')}.png`,
              size: (file.size / 1024).toFixed(1) + ' KB',
              type: file.type,
              dataUrl: reader.result
            }]);
            showNotification('✓ Screenshot attached from clipboard');
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  // Send Chat Message with optional direct text string
  const handleSendMessage = async (e, directText = null) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    let userText = (directText || inputMessage).trim();
    if (attachedFiles.length > 0) {
      const fileSummary = attachedFiles.map(f => `[Attached file: ${f.name} (${f.size})]`).join('\n');
      userText = userText ? `${userText}\n\n${fileSummary}` : fileSummary;
      setAttachedFiles([]);
    }
    if (!userText || !activeSession?.id || loadingMessage) return;

    if (isRecordingVoice && window._ruxtSpeechRec) {
      try { window._ruxtSpeechRec.stop(); } catch (_) {}
      setIsRecordingVoice(false);
    }

    setInputMessage('');
    setLoadingMessage(true);

    let currentSession = activeSession;
    if (currentSession?.id && String(currentSession.id).startsWith('temp-')) {
      try {
        const createRes = await fetch('/api/chat/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: currentSession.title || 'Chat session',
            agent_id: currentSession.agent_id || 'ruxt'
          })
        });
        const createData = await createRes.json();
        if (createData?.session) {
          const persisted = { ...createData.session, agent_id: currentSession.agent_id || 'ruxt' };
          setSessions(prev => [persisted, ...prev.filter(s => s.id !== currentSession.id)]);
          setActiveSession(persisted);
          currentSession = persisted;
        }
      } catch (_) {}
    }

    const tempUserMsg = {
      id: 'temp-' + Date.now(),
      session_id: currentSession.id,
      role: 'user',
      content: userText,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const res = await fetch(`/api/chat/sessions/${currentSession.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: userText,
          providerOverride: settings.active_provider,
          turbo: isTurboEnabled
        })
      });
      const data = await res.json();
      if (data?.assistantMessage) {
        setMessages(prev => [...prev.filter(m => m.id !== tempUserMsg.id), data.userMessage, data.assistantMessage]);
        
        // Auto-open right-side inter-agent consultation popup when team deliberation occurs
        if (data.dispatch) {
          setActiveSubChatPopup(data.dispatch);
        }

        // Update session snippet and count in local state
        const shortSnippet = userText.length > 35 ? userText.slice(0, 35) + '...' : userText;
        setSessions(prev => prev.map(s => {
          if (s.id === currentSession.id) {
            const updatedTitle = (s.title === 'New Conversation' || s.title?.startsWith('Chat with')) ? shortSnippet : s.title;
            return {
              ...s,
              title: updatedTitle,
              last_message: userText,
              message_count: (s.message_count || 0) + 2
            };
          }
          return s;
        }));
      }
    } catch (err) {
      console.error('Send message failed:', err);
    } finally {
      setLoadingMessage(false);
    }
  };

  // Create new session (draft that only saves to DB once a message is sent)
  const handleCreateSession = (agentId = 'ruxt', title = null) => {
    try {
      const targetAgentId = agentId || 'ruxt';
      const agentObj = allKnownAgents.find(a => a.slug === targetAgentId);
      const sessionTitle = title || (targetAgentId === 'ruxt' ? 'Coordinate with RuXt (Team Leader)' : (agentObj ? `Chat with ${agentObj.name}` : `Chat with ${targetAgentId}`));

      const tempId = 'temp-' + Date.now();
      const immediateSession = {
        id: tempId,
        agent_id: targetAgentId,
        title: sessionTitle,
        created_at: new Date().toISOString()
      };

      // Instantly switch session and clear messages for 0ms visual latency
      setActiveSession(immediateSession);
      setMessages([]);
      setActiveTab('chat');
      setSelectedAgentUi(null);
      setExpandedAgentHistories(prev => ({ ...prev, [targetAgentId]: true }));
    } catch (err) {
      console.error('Create session error:', err);
    }
  };

  // Switch session
  const handleSelectSession = (sess) => {
    setActiveSession(sess);
    setMessages([]);
    if (sess?.id && !String(sess.id).startsWith('temp-')) {
      fetchSafeJson(`/api/chat/sessions/${sess.id}/messages`).then(data => {
        if (data?.messages) setMessages(data.messages);
      });
    }
  };

  // Delete session
  const handleDeleteSession = async (sessionId, e) => {
    if (e) e.stopPropagation();
    try {
      if (!String(sessionId).startsWith('temp-')) {
        await fetch(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' });
      }
      setSessions(prev => {
        const remaining = prev.filter(s => s.id !== sessionId);
        if (activeSession?.id === sessionId) {
          const nextActive = remaining.length > 0 ? remaining[0] : {
            id: 'temp-' + Date.now(),
            agent_id: 'ruxt',
            title: 'Coordinate with RuXt (Team Leader)',
            created_at: new Date().toISOString()
          };
          setActiveSession(nextActive);
          setMessages([]);
        }
        return remaining;
      });
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  // Open / Switch to Chat with an Agent or RuXt Leader
  const handleOpenAgentChat = async (agentSlug, title = null) => {
    setActiveTab('chat');
    setSelectedAgentUi(null);
    setExpandedAgentHistories(prev => ({ ...prev, [agentSlug]: true }));

    // Find agent object from allKnownAgents
    const agentObj = allKnownAgents.find(a => a.slug === agentSlug) || {
      slug: agentSlug,
      name: agentSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      role: 'Specialist'
    };

    // If an existing conversation exists for this agent, switch to it immediately!
    const existing = sessions.find(s => s.agent_id === agentSlug);
    if (existing) {
      setActiveSession({
        ...existing,
        agent_id: agentSlug
      });
      setMessages([]);
      fetchSafeJson(`/api/chat/sessions/${existing.id}/messages`).then(data => {
        if (data?.messages) setMessages(data.messages);
      });
      return;
    }

    // Otherwise open a clean draft conversation without creating an empty record in DB
    const sessionTitle = title || (agentSlug === 'ruxt' ? 'Coordinate with RuXt (Team Leader)' : `Chat with ${agentObj.name}`);
    const tempId = 'temp-' + Date.now();
    const immediateSession = {
      id: tempId,
      agent_id: agentSlug,
      title: sessionTitle,
      created_at: new Date().toISOString()
    };

    // INSTANT UI UPDATE: switch to this agent immediately with clean empty messages
    setActiveSession(immediateSession);
    setMessages([]);
  };

  // Fetch Active Board Room Session
  const fetchActiveBoardroom = async () => {
    try {
      const res = await fetch('/api/boardroom/active');
      const data = await res.json();
      if (data?.success && data.session) {
        setBoardroomSession(data.session);
        setBoardroomMessages(data.messages || []);
        setBoardroomTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Fetch active boardroom error:', err);
    }
  };

  // Start / Convene Board Room Meeting
  const handleStartBoardroomMeeting = async (topic, squadName = null) => {
    try {
      setIsExecutingPipeline(true);
      const res = await fetch('/api/boardroom/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          squadName: squadName || 'RuXt Specialist Executive Board',
          sessionId: activeSession?.id || null
        })
      });
      const data = await res.json();
      if (data?.success) {
        setBoardroomSession(data.session);
        setBoardroomMessages(data.messages || []);
        setBoardroomTasks(data.tasks || []);
        setIsBoardRoomOpen(true);
        // Refresh global tasks list
        const tasksRes = await fetchSafeJson('/api/tasks');
        if (tasksRes?.tasks) setTasks(tasksRes.tasks);
        showNotification(`🎯 Board Room reached consensus on: "${topic}"`);
        if (settings.sound_haptics !== 'false') playSound('success');
      }
    } catch (err) {
      console.error('Start boardroom error:', err);
      showNotification('Failed to convene Board Room', 'error');
    } finally {
      setIsExecutingPipeline(false);
    }
  };

  // Execute Next Step in the Boardroom Pipeline
  const handleExecuteNextStep = async () => {
    if (!boardroomSession?.id) return;
    try {
      setIsExecutingPipeline(true);
      const res = await fetch(`/api/boardroom/${boardroomSession.id}/execute-next`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data?.success) {
        if (data.tasks) {
          setBoardroomTasks(data.tasks);
        }
        const tasksRes = await fetchSafeJson('/api/tasks');
        if (tasksRes?.tasks) setTasks(tasksRes.tasks);
        if (data.executedTask) {
          showNotification(`✅ Completed: ${data.executedTask.title}`);
        }
        if (settings.sound_haptics !== 'false') playSound('success');
      }
    } catch (err) {
      console.error('Execute next step error:', err);
    } finally {
      setIsExecutingPipeline(false);
    }
  };

  // Execute All Remaining Steps Sequentially
  const handleExecuteAllSteps = async () => {
    if (!boardroomSession?.id) return;
    try {
      setIsExecutingPipeline(true);
      showNotification('⚡ Auto-executing squad pipeline tasks...');
      const res = await fetch(`/api/boardroom/${boardroomSession.id}/execute-all`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data?.success) {
        if (data.tasks) {
          setBoardroomTasks(data.tasks);
        }
        const tasksRes = await fetchSafeJson('/api/tasks');
        if (tasksRes?.tasks) setTasks(tasksRes.tasks);
        showNotification('🚀 All squad tasks executed to completion!');
        if (settings.sound_haptics !== 'false') playSound('success');
      }
    } catch (err) {
      console.error('Execute all steps error:', err);
    } finally {
      setIsExecutingPipeline(false);
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId) => {
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      setTasks(prev => prev.filter(t => t.id !== taskId));
      setBoardroomTasks(prev => prev.filter(t => t.id !== taskId));
      if (settings.sound_haptics !== 'false') playSound('trash');
    } catch (err) {
      console.error('Delete task error:', err);
    }
  };

  // Create Kanban Task
  const handleCreateKanbanTask = async (taskPayload) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskPayload)
      });
      const data = await res.json();
      if (data?.task) {
        setTasks(prev => [data.task, ...prev]);
        if (taskPayload.boardroom_id) {
          setBoardroomTasks(prev => [...prev, data.task]);
        }
        showNotification('Task added to Kanban pipeline');
        if (settings.sound_haptics !== 'false') playSound('success');
      }
    } catch (err) {
      console.error('Create task error:', err);
    }
  };

  // Open Chat with RuXt Leader directly on the right side
  const handleOpenRuxtChat = () => {
    handleOpenAgentChat('ruxt', 'Coordinate with RuXt (Team Leader)');
  };

  // Add Task
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle,
          agent_id: newTaskAgent || null,
          status: 'pending',
          priority: 'medium'
        })
      });
      const data = await res.json();
      if (data?.task) {
        setTasks(prev => [data.task, ...prev]);
        setNewTaskTitle('');
        setNewTaskAgent('');
        if (settings.sound_haptics !== 'false') playSound('success');
      }
    } catch (err) {
      console.error('Add task error:', err);
    }
  };

  // Update Task Status
  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data?.task) {
        setTasks(prev => prev.map(t => t.id === taskId ? data.task : t));
        if (settings.sound_haptics !== 'false') playSound('toggle');
      }
    } catch (err) {
      console.error('Update task status error:', err);
    }
  };

  // Save Individual Setting
  const handleSaveSetting = async (key, value) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
      const data = await res.json();
      if (data?.success) {
        setSettings(prev => ({ ...prev, [key]: value }));
        showNotification(`✓ ${key} saved successfully!`);
      }
    } catch (err) {
      showNotification(`✕ Failed to save setting`, 'error');
    }
  };

  // Save Batch Settings
  const handleSaveBatch = async (batchObj) => {
    try {
      const res = await fetch('/api/settings/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: batchObj })
      });
      const data = await res.json();
      if (data?.success) {
        setSettings(prev => ({ ...prev, ...batchObj }));
        showNotification('✓ Settings updated successfully!');
      }
    } catch (err) {
      showNotification('✕ Failed to batch save settings', 'error');
    }
  };

  // Test AI Connection
  const handleTestConnection = async (provider) => {
    setTestingConnection(true);
    setConnectionTestResult(null);
    try {
      let apiKey = '';
      let model = settings[`${provider}_model`];
      let hostUrl = settings.ollama_host;
      let baseUrl = settings.custom_base_url;
      let customPath = settings.antigravity_custom_path;

      if (provider === 'gemini') apiKey = settings.gemini_api_key;
      if (provider === 'claude') apiKey = settings.anthropic_api_key;
      if (provider === 'openai') apiKey = settings.openai_api_key;

      const res = await fetch('/api/settings/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model, apiKey, hostUrl, baseUrl, customPath })
      });
      const data = await res.json();
      if (data.success) {
        setConnectionTestResult({ success: true, message: `Connected to ${provider.toUpperCase()} (${data.model || 'ok'})` });
        showNotification(`✓ Verified connection to ${provider}!`);
      } else {
        setConnectionTestResult({ success: false, message: data.error || 'Connection failed' });
        showNotification(`✕ Error: ${data.error}`, 'error');
      }
    } catch (err) {
      setConnectionTestResult({ success: false, message: err.message });
      showNotification(`✕ Connection failed: ${err.message}`, 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  // Combined map of all known agents (DB agents + Default Specialists + Marketplace + RuXt Leader)
  const allKnownAgents = useMemo(() => {
    const map = new Map();
    // 1. RuXt Leader (Customizable via Settings -> General)
    map.set('ruxt', {
      slug: 'ruxt',
      name: settings.team_leader_name || 'RuXt',
      role: settings.team_leader_role || 'Team Leader & Engine Orchestrator',
      email: settings.team_leader_email || 'ruxt.leader@workspace.ai',
      description: settings.team_leader_bio || 'Central orchestrator and leader of RuXt Local Engine. Plans projects, coordinates specialist agents (Frontend, Backend, Tax, Strategy), manages task distribution, and ensures rigorous quality control.',
      skills: settings.team_leader_skills || 'System Orchestration, Team Delegation, Technical Architecture, Code Review, Security Governance',
      avatar: getAgentAvatar('ruxt', settings.team_leader_avatar)
    });
    // 2. Default Specialists with authentic roles and descriptions
    DEFAULT_SPECIALISTS.forEach(a => {
      let desc = 'Dedicated specialist ready to assist with your projects.';
      if (a.slug === 'julian-vance') desc = 'Senior Frontend Web Developer specializing in React, Vite, modern Tailwind CSS architectures, and responsive user interfaces.';
      if (a.slug === 'maya-brooks') desc = 'Chief Financial Analyst. I help model unit economics, forecast cash flows, optimize burn rates, and ensure financial discipline.';
      if (a.slug === 'noah-reed') desc = 'Security & Cloud DevOps Architect specializing in cloud infrastructure, Kubernetes, CI/CD automated deployments, and zero-trust security.';
      if (a.slug.includes('elena-voss')) desc = 'Strategic Game Intelligence & Decision Systems Theorist analyzing complex scenario matrices, game theory, and competitive positioning.';
      if (a.slug === 'marcus-sterling') desc = 'Enterprise Legal Counsel drafting commercial contracts, navigating regulatory compliance, privacy governance, and IP protection.';
      if (a.slug === 'numbers') desc = 'Quantitative Data Analyst extracting high-signal statistical patterns, KPI forecasting, and quantitative analytics.';

      map.set(a.slug, {
        ...a,
        avatar: getAgentAvatar(a.slug, a.avatar),
        description: desc
      });
    });
    // 3. Marketplace Agents
    (marketplaceAgents || []).forEach(a => {
      if (a && a.slug) {
        map.set(a.slug, {
          ...(map.get(a.slug) || {}),
          ...a,
          avatar: getAgentAvatar(a.slug, a.avatar, a.version)
        });
      }
    });
    // 4. DB Installed Agents (highest priority override)
    (agents || []).forEach(a => {
      if (a && a.slug) {
        const existing = map.get(a.slug) || {};
        const resolvedAvatar = a.slug === 'ruxt' 
          ? (settings.team_leader_avatar ? getAgentAvatar('ruxt', settings.team_leader_avatar, a.version) : getAgentAvatar('ruxt', a.avatar, a.version))
          : getAgentAvatar(a.slug, a.avatar, a.version);
        map.set(a.slug, {
          ...existing,
          ...a,
          avatar: resolvedAvatar
        });
      }
    });
    return Array.from(map.values());
  }, [agents, marketplaceAgents, settings]);

  // RuXt Leader Agent Object
  const ruxtLeader = allKnownAgents.find(a => a.slug === 'ruxt') || {
    name: settings.team_leader_name || 'RuXt',
    role: settings.team_leader_role || 'Team Leader & Engine Orchestrator',
    email: settings.team_leader_email || 'ruxt.leader@workspace.ai',
    description: settings.team_leader_bio || 'Central orchestrator and leader of RuXt Local Engine. Plans projects, coordinates specialist agents (Frontend, Backend, Tax, Strategy), manages task distribution, and ensures rigorous quality control.',
    skills: settings.team_leader_skills || 'System Orchestration, Team Delegation, Technical Architecture, Code Review, Security Governance',
    avatar: getAgentAvatar('ruxt', settings.team_leader_avatar),
    slug: 'ruxt'
  };

  // Active Agent for Chat Session (Always reliably resolved to the selected agent!)
  const currentChatAgent = useMemo(() => {
    const slug = activeSession?.agent_id || 'ruxt';
    const found = allKnownAgents.find(a => a.slug === slug || a.id === slug);
    if (found) {
      return {
        ...found,
        avatar: getAgentAvatar(found.slug, found.avatar, found.version)
      };
    }

    return {
      slug,
      name: slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      role: 'Specialist Executive',
      description: 'Dedicated AI specialist ready to assist with your projects.',
      avatar: getAgentAvatar(slug)
    };
  }, [activeSession?.agent_id, allKnownAgents]);

  // RuXt Leader Chat Sessions
  const ruxtSessions = sessions.filter(s => s.agent_id === 'ruxt' || (!s.agent_id && (s.title?.toLowerCase().includes('ruxt') || s.title === 'New Conversation')));

  // Provider display names
  const PROVIDER_NAMES = {
    antigravity: 'Google Antigravity (Local Engine)',
    gemini: 'Google Gemini (Cloud API)',
    claude: 'Anthropic Claude',
    openai: 'OpenAI / Codex',
    ollama: 'Local Ollama (Offline)',
    custom: 'Custom LLM Server'
  };

  return (
    <div className="flex h-screen font-sans overflow-hidden select-none" style={{ backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text-main)' }}>
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border text-xs font-medium shadow-2xl flex items-center gap-2 transition-all ${
          notification.type === 'error'
            ? 'bg-rose-950/90 border-rose-500 text-rose-200'
            : 'bg-slate-900/90 border-emerald-500 text-emerald-200'
        }`}>
          {notification.msg}
        </div>
      )}

      {/* Global Floating Vision Engine Control Pill */}
      {isDesktopRunning && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 bg-slate-950/95 border border-cyan-400/60 rounded-full shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
            </span>
            <span className="text-xs font-bold text-white tracking-wide">
              RuXt Live on PC
            </span>
            {activeDesktopGoal && (
              <span className="text-[11px] text-cyan-300/80 max-w-[200px] truncate hidden md:inline">
                ({activeDesktopGoal})
              </span>
            )}
          </div>
          <div className="h-4 w-px bg-slate-700/80" />
          <button
            onClick={handleAbortActiveDesktop}
            className="px-3 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-500/50 rounded-full text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            title="Emergency Stop: Halt Vision Engine & Screen Control (or press ESC)"
          >
            <span>⏹️</span>
            <span>Stop Vision Engine</span>
            <kbd className="px-1 text-[10px] bg-red-950/90 rounded border border-red-500/40 font-mono">ESC</kbd>
          </button>
        </div>
      )}

      {/* Left Sidebar */}
      <aside className="w-64 sm:w-68 border-r backdrop-blur flex flex-col justify-between transition-colors duration-250 select-none" style={{ backgroundColor: 'var(--theme-sidebar)', borderColor: 'var(--theme-border)' }}>
        <div className="p-3.5 flex-1 overflow-y-auto space-y-3">
          {/* Quick Team Leader Command Card with Expandable History */}
          <div className="rounded-2xl overflow-hidden border border-transparent hover:border-slate-300 dark:hover:border-slate-800 transition">
            <div 
              onClick={() => {
                handleOpenRuxtChat();
                setExpandedAgentHistories(prev => ({ ...prev, ruxt: !prev.ruxt }));
              }}
              className={`p-3 rounded-2xl border transition shadow-xs group cursor-pointer ${
                activeTab === 'chat' && activeSession?.agent_id === 'ruxt'
                  ? 'bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-amber-500/5 dark:from-indigo-950/70 dark:to-slate-900 border-amber-400 dark:border-indigo-400 ring-2 ring-amber-400/30 dark:ring-indigo-500/30 shadow-md shadow-amber-500/10'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-400/60 dark:hover:border-indigo-400/60'
              }`}
              title="Chat with RuXt (Team Leader)"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="relative shrink-0">
                    <img 
                      src={ruxtLeader.avatar || getAgentAvatar('ruxt')} 
                      alt="RuXt Leader" 
                      className="w-9 h-9 rounded-xl object-cover ring-2 ring-amber-400/80 dark:ring-indigo-500/40 bg-slate-100 dark:bg-slate-800"
                      onError={(e) => { e.target.src = getAgentAvatar('ruxt'); }}
                    />
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 text-[9px] flex items-center justify-center text-slate-950 font-bold shadow-xs" title="Team Leader">
                      👑
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-amber-600 dark:group-hover:text-indigo-300 transition truncate">{ruxtLeader.name}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold border border-amber-500/30">LEADER</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{ruxtLeader.role}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {ruxtSessions.length > 0 && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-slate-800/80 text-amber-800 dark:text-amber-300 font-mono font-bold border border-amber-200 dark:border-slate-700">
                      {ruxtSessions.length}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateSession('ruxt', 'RuXt Leader Orchestration');
                      setExpandedAgentHistories(prev => ({ ...prev, ruxt: true }));
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition"
                    title="Start fresh thread with RuXt (+)"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <div className="text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300">
                    {expandedAgentHistories.ruxt !== false ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </div>
                </div>
              </div>
            </div>

            {/* RuXt Leader Chat History List directly under Leader */}
            {expandedAgentHistories.ruxt !== false && ruxtSessions.length > 0 && (
              <div className="pl-3.5 pr-1 py-1 space-y-0.5 border-l-2 border-amber-500/50 ml-4 my-1 rounded-r-xl bg-amber-50/50 dark:bg-slate-950/40 animate-in fade-in duration-150">
                {ruxtSessions.map(sess => {
                  const isSessActive = activeSession?.id === sess.id && activeTab === 'chat';
                  return (
                    <div
                      key={sess.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectSession(sess);
                        setActiveTab('chat');
                        setSelectedAgentUi(null);
                      }}
                      className={`group flex items-center justify-between px-2 py-1 rounded-lg text-xs cursor-pointer transition ${
                        isSessActive
                          ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/30 font-medium shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-amber-100/40 dark:hover:bg-slate-800/50'
                      }`}
                      title={sess.title}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
                        <MessageSquare className="w-2.5 h-2.5 text-amber-500 shrink-0 opacity-80" />
                        <span className="truncate text-[10px] leading-tight">{sess.title}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(sess.id, e);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-500 transition shrink-0"
                        title="Delete thread"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <button
              onClick={() => {
                setActiveTab('chat');
                setSelectedAgentUi(null);
                if (!activeSession) {
                  if (sessions.length > 0) {
                    setActiveSession(sessions[0]);
                  } else {
                    handleOpenRuxtChat();
                  }
                }
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'chat' && !selectedAgentUi
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Team Chat & Dispatch
            </button>

            {/* Collapsible Agents Section (5 specialist agents default, with View More / Less) */}
            <div className="pt-1.5 pb-1">
              <div className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition group">
                <button
                  type="button"
                  onClick={() => setIsAgentsOpen(!isAgentsOpen)}
                  className="flex items-center gap-2 flex-1 text-left"
                >
                  <Bot className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                  <span className="font-bold text-slate-700 dark:text-slate-300">Agents</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 font-mono font-bold">
                    {specialistAgents.length}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 ml-auto mr-1">
                    {isAgentsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAgentToEdit(null);
                    setIsAgentStudioOpen(true);
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-white hover:bg-indigo-50 dark:hover:bg-indigo-600/30 transition"
                  title="Build New Agent (Studio)"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                </button>
              </div>

              {/* Collapsible List */}
              {isAgentsOpen && (
                <div className="mt-1 space-y-0.5 pl-2 animate-in fade-in duration-150">
                  {displayedAgents.map((agent) => {
                    const isCurrent = activeSession?.agent_id === agent.slug;
                    const agentSessions = sessions.filter(s => s.agent_id === agent.slug);
                    const isHistoryExpanded = expandedAgentHistories[agent.slug] !== false;

                    return (
                      <div key={agent.slug} className="rounded-xl overflow-hidden transition">
                        {/* Agent Header Row */}
                        <div
                          onClick={() => {
                            handleOpenAgentChat(agent.slug, `Chat with ${agent.name}`);
                            setExpandedAgentHistories(prev => ({
                              ...prev,
                              [agent.slug]: true
                            }));
                          }}
                          className={`group w-full flex items-center justify-between px-2 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                            isCurrent && activeTab === 'chat'
                              ? 'bg-indigo-600/15 dark:bg-indigo-600/30 text-indigo-900 dark:text-white border border-indigo-400/40 dark:border-indigo-500/40 shadow-xs font-medium'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                          }`}
                          title={`Click to chat with ${agent.name} (${agent.role})`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="relative shrink-0">
                              <img
                                src={agent.avatar || getAgentAvatar(agent.slug)}
                                alt={agent.name}
                                className="w-5 h-5 rounded-md object-cover bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700"
                                onError={(e) => {
                                  if (!e.currentTarget.src.includes('ruxt-logo.png')) {
                                    e.currentTarget.src = '/ruxt-logo.png';
                                  }
                                }}
                              />
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                              <div className="font-semibold text-slate-800 dark:text-white text-[11px] truncate flex items-center gap-1">
                                <span>{agent.name}</span>
                                {agent.uiEntry && (
                                  <span className="text-[8px] px-1 py-0.2 rounded bg-pink-500/20 text-pink-600 dark:text-pink-300 font-bold border border-pink-500/30">
                                    UI
                                  </span>
                                )}
                              </div>
                              <div className="text-[9px] text-slate-500 dark:text-slate-400 truncate leading-none">{agent.role}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {agentSessions.length > 0 && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-indigo-300 font-mono font-medium">
                                {agentSessions.length}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCreateSession(agent.slug, `Chat with ${agent.name}`);
                                setExpandedAgentHistories(prev => ({ ...prev, [agent.slug]: true }));
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition"
                              title={`Start fresh thread with ${agent.name} (+)`}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            {agent.slug !== 'ruxt' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditAgent(agent);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition"
                                title={`Skill Up & edit ${agent.name}`}
                              >
                                <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedAgentHistories(prev => ({ ...prev, [agent.slug]: !prev[agent.slug] }));
                              }}
                              className="p-0.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition"
                              title="Toggle chat history"
                            >
                              {isHistoryExpanded && agentSessions.length > 0 ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Agent Chat History List directly under Agent */}
                        {isHistoryExpanded && agentSessions.length > 0 && (
                          <div className="pl-4 pr-1 py-1 space-y-0.5 border-l-2 border-indigo-400 dark:border-indigo-500/40 ml-4 my-0.5 rounded-r-xl bg-indigo-50/50 dark:bg-slate-950/40 animate-in fade-in duration-150">
                            {agentSessions.map(sess => {
                              const isSessActive = activeSession?.id === sess.id && activeTab === 'chat';
                              return (
                                <div
                                  key={sess.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectSession(sess);
                                    setActiveTab('chat');
                                    setSelectedAgentUi(null);
                                  }}
                                  className={`group flex items-center justify-between px-2 py-1 rounded-lg text-xs cursor-pointer transition ${
                                    isSessActive
                                      ? 'bg-indigo-500/20 text-indigo-900 dark:text-indigo-200 border border-indigo-500/30 font-medium'
                                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-indigo-100/50 dark:hover:bg-slate-800/50'
                                  }`}
                                  title={sess.title}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
                                    <MessageSquare className="w-2.5 h-2.5 text-indigo-500 dark:text-indigo-400 shrink-0 opacity-80" />
                                    <span className="truncate text-[10px] leading-tight">{sess.title}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteSession(sess.id, e);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-500 transition shrink-0"
                                    title="Delete thread"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* View More / Less Button */}
                  {specialistAgents.length > 5 && (
                    <button
                      onClick={() => setShowAllAgents(!showAllAgents)}
                      className="w-full text-center py-1 text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 transition"
                    >
                      {showAllAgents ? '▲ View Less' : `▼ View More (${specialistAgents.length - 5} more)`}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* MY TEAMS Section with '+' Button in front */}
            <div className="pt-1.5 pb-1">
              <div className="flex items-center justify-between px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    MY TEAMS ({customTeams.length})
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCreateTeamOpen(true);
                  }}
                  title="Create New Team (+)"
                  className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-indigo-600 hover:text-white text-slate-600 dark:text-slate-300 flex items-center justify-center transition border border-slate-200 dark:border-slate-700/80 hover:border-indigo-500 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Teams List */}
              <div className="space-y-1 pl-1 mt-1">
                {customTeams.length === 0 ? (
                  <div
                    onClick={() => setIsCreateTeamOpen(true)}
                    className="px-2.5 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 hover:border-indigo-500/50 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-[11px] text-center cursor-pointer transition"
                  >
                    + Click to create your first team
                  </div>
                ) : (
                  customTeams.map(team => {
                    const isExpanded = !!expandedTeams[team.id];
                    const teamSpecialists = (team.agentSlugs || []).filter(s => s !== 'ruxt');
                    return (
                      <div key={team.id} className="rounded-xl overflow-hidden border border-transparent hover:border-slate-200 dark:hover:border-slate-800/80 transition">
                        {/* Team Header Row */}
                        <div
                          onClick={() => toggleExpandTeam(team.id)}
                          className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer transition text-xs ${
                            isExpanded 
                              ? 'bg-indigo-50 dark:bg-slate-800/60 text-indigo-900 dark:text-white border border-indigo-200/80 dark:border-slate-700/60 shadow-xs' 
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                          }`}
                          title={`Click to view agents in ${team.title}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 transition" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 shrink-0 transition" />
                            )}
                            <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" />
                            <span className="font-semibold text-[11px] truncate">{team.title}</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/15 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-mono font-bold border border-indigo-200 dark:border-indigo-500/30">
                              {teamSpecialists.length}
                            </span>
                            <button
                              onClick={(e) => promptDeleteTeam(team, e)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
                              title="Delete squad"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Expanded Agent List for this Team */}
                        {isExpanded && (
                          <div className="pl-3 pr-1 py-1 space-y-1 bg-indigo-50/40 dark:bg-slate-950/50 border-l-2 border-indigo-500/40 ml-3 my-1 rounded-r-xl animate-in fade-in duration-150">
                            {/* Team Dispatch Button (RuXt Leader orchestrates) */}
                            <button
                              onClick={() => handleStartTeamChat(team)}
                              className="w-full flex items-center justify-center gap-1.5 py-1 px-2 mb-1 rounded-lg bg-indigo-100/70 hover:bg-indigo-100 dark:bg-indigo-600/20 dark:hover:bg-indigo-600/35 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 text-[10px] font-semibold transition"
                              title="Initiate group dispatch chat session with RuXt leading this squad"
                            >
                              <MessageSquare className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                              <span>Dispatch with RuXt Leader</span>
                            </button>

                            {/* Specialist Agents in this Team */}
                            {teamSpecialists.map(slug => {
                              const agent = specialistAgents.find(a => a.slug === slug) || { 
                                slug, 
                                name: slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), 
                                role: 'Specialist', 
                                avatar: '/ruxt-logo.png' 
                              };
                              const isCurrent = activeSession?.agent_id === agent.slug;
                              return (
                                <button
                                  key={slug}
                                  onClick={() => handleOpenAgentChat(agent.slug, `Chat with ${agent.name} (${team.title})`)}
                                  className={`w-full flex items-center gap-2 px-2 py-1 rounded-lg text-left transition ${
                                    isCurrent && activeTab === 'chat'
                                      ? 'bg-indigo-600/20 dark:bg-indigo-600/30 text-indigo-950 dark:text-white font-medium'
                                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                  }`}
                                  title={`${agent.name} • ${agent.role}`}
                                >
                                  <div className="relative shrink-0">
                                    <img
                                      src={agent.avatar || getAgentAvatar(agent.slug)}
                                      alt={agent.name}
                                      className="w-4 h-4 rounded-md object-cover bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-300 dark:ring-slate-700"
                                      onError={(e) => {
                                        if (!e.currentTarget.src.includes('ruxt-logo.png')) {
                                          e.currentTarget.src = '/ruxt-logo.png';
                                        }
                                      }}
                                    />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium text-[10px] text-slate-800 dark:text-slate-200 truncate leading-tight">
                                      {agent.name}
                                    </div>
                                    <div className="text-[8px] text-slate-500 truncate leading-tight">{agent.role}</div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <button
              onClick={() => { setActiveTab('tasks'); setSelectedAgentUi(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'tasks' && !selectedAgentUi
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              Orchestrated Tasks
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                {tasks.filter(t => t.status !== 'done').length}
              </span>
            </button>

            <button
              onClick={() => setIsBoardRoomOpen(prev => !prev)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isBoardRoomOpen
                  ? 'bg-gradient-to-r from-amber-500/20 to-indigo-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <span className="flex items-center gap-3">
                <Users className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                Board Room
              </span>
              <span className="flex items-center gap-1.5 text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            </button>
          </nav>
        </div>

        {/* Bottom Actions: Talent Hub + Theme Switcher + Workspace Settings */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800/60 space-y-1.5">
          <button
            onClick={() => { setActiveTab('marketplace'); setSelectedAgentUi(null); }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'marketplace' && !selectedAgentUi
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-transparent hover:border-slate-300 dark:hover:border-slate-700/80'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <ShoppingBag className="w-4 h-4 text-pink-500 dark:text-pink-400" />
              Talent Hub (Market)
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-600 dark:text-pink-300 font-bold border border-pink-500/30">
              NEW
            </span>
          </button>

          <button
            type="button"
            onClick={toggleLightDarkTheme}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all border border-slate-200 dark:border-slate-800/80 shadow-xs cursor-pointer"
            title="Toggle between Clean Light and Focus Dark theme"
          >
            <span className="flex items-center gap-2.5">
              {isLightMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-400" />}
              <span>{isLightMode ? 'Clean Light Theme' : 'Focus Dark Theme'}</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-medium">
              {isLightMode ? '☀️ Light' : '🌙 Dark'}
            </span>
          </button>

          <button
            onClick={() => openSettings('overview')}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all border border-slate-200 dark:border-transparent hover:border-slate-300 dark:hover:border-slate-700/80 shadow-xs"
          >
            <span className="flex items-center gap-2.5">
              <Settings className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              Workspace Settings
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-bold border border-indigo-500/30">
              PRO
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 flex flex-col overflow-hidden transition-colors duration-250" style={{ backgroundColor: 'var(--theme-bg)' }}>
        {activeTab === 'settings' && !selectedAgentUi ? (
          <SettingsView
            settings={settings}
            onSaveSetting={handleSaveSetting}
            onSaveBatch={handleSaveBatch}
            onClose={() => setActiveTab('chat')}
            runtimes={detectedRuntimes}
            onScanRuntimes={scanHostRuntimes}
            scanningRuntimes={scanningRuntimes}
            showNotification={showNotification}
            testingConnection={testingConnection}
            connectionTestResult={connectionTestResult}
            handleTestConnection={handleTestConnection}
            initialCategory={settingsCategory}
            agents={agents}
            tasks={tasks}
            marketplaceAgents={marketplaceAgents}
            onCommandLeader={(prompt) => {
              setActiveTab('chat');
              handleCreateSession('ruxt', prompt || 'Project Planning with RuXt');
            }}
            onNavigateTab={(tab) => {
              setActiveTab(tab);
            }}
          />
        ) : (
          /* Tab Body (Full Canvas) */
          <div className={`flex-1 min-h-0 flex flex-col ${activeTab === 'chat' && !selectedAgentUi ? 'p-0 overflow-hidden' : 'p-6 overflow-y-auto'}`}>
            {/* Agent Custom UI Frame View */}
          {selectedAgentUi ? (
            <div className="h-full flex flex-col bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
              <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-b border-slate-800 text-xs text-slate-300">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
                    <Laptop className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-white truncate">
                    {selectedAgentUi.manifest?.ui?.title || `${selectedAgentUi.name} Interactive Workspace`}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono hidden sm:inline">
                    {selectedAgentUi.uiEntry}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const iframe = document.getElementById('agent-custom-iframe');
                      if (iframe) iframe.src = iframe.src;
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    title="Reload Interface"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setSelectedAgentUi(null)}
                    className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition text-xs shadow-sm shadow-indigo-600/30"
                  >
                    ← Back to Chat
                  </button>
                </div>
              </div>
              <iframe
                id="agent-custom-iframe"
                src={selectedAgentUi.uiEntry}
                title={selectedAgentUi.name}
                className="w-full flex-1 border-0 bg-slate-950"
              />
        </div>
          ) : activeTab === 'marketplace' ? (
            /* ============================================================ */
            /* TALENT HUB (MARKETPLACE) VIEW                                 */
            /* ============================================================ */
            <div className="space-y-6 max-w-6xl mx-auto">
              {/* Banner */}
              <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-950/80 via-purple-950/50 to-slate-900 border border-indigo-500/30 shadow-2xl relative overflow-hidden">
                <div className="relative z-10 max-w-2xl">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                    Human Persona Architecture
              </div>
                  <h3 className="text-2xl font-black text-white mb-2">
                    Hire World-Class Digital Specialists
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed mb-4">
                    Managed and orchestrated by <strong>RuXt</strong>, your central team leader. Every specialist has a distinct human personality, standards, and skill instructions.
                  </p>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setAgentToEdit(null);
                        setIsAgentStudioOpen(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-md shadow-pink-600/30"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Build Custom Agent (Studio)
                    </button>

                    <button
                      type="button"
                      disabled={isImportingPackage}
                      onClick={() => ruxtFileInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white text-xs font-semibold transition flex items-center gap-1.5 border border-slate-700 shadow-md disabled:opacity-50"
                      title="Import and install any .ruxt agent package"
                    >
                      <Upload className="w-3.5 h-3.5 text-indigo-400" />
                      {isImportingPackage ? 'Importing...' : 'Import .ruxt Package'}
                    </button>

                    <a
                      href="/hub"
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Web Hub
                    </a>
                  </div>
            </div>
          </div>

              {/* Search & Category Filter Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={marketplaceSearch}
                    onChange={(e) => setMarketplaceSearch(e.target.value)}
                    placeholder="Search specialists (e.g., RuXt, Frontend, React, Tax, PHP)..."
                    className="w-full bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition shadow-xs"
                  />
            </div>

                <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                  {['all', 'Leadership & Orchestration', 'Engineering', 'Finance & Compliance', 'Strategy & Gaming', 'Custom & Community'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setMarketplaceFilter(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                        marketplaceFilter === cat
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 shadow-xs'
                      }`}
                    >
                      {cat === 'all' ? 'All Roles' : cat}
                    </button>
                  ))}
            </div>
          </div>

              {/* Specialists Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {marketplaceAgents
                  .filter((a) => {
                    const matchCat = marketplaceFilter === 'all' || a.category.toLowerCase().includes(marketplaceFilter.toLowerCase());
                    const q = marketplaceSearch.toLowerCase().trim();
                    const matchQ = !q || a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q) || a.skills?.some(s => s.toLowerCase().includes(q));
                    return matchCat && matchQ;
                  })
                  .map((agent) => (
                    <div
                      key={agent.slug}
                      className={`p-5 rounded-3xl border transition-all flex flex-col justify-between shadow-xs dark:shadow-xl group ${
                        agent.slug === 'ruxt' 
                          ? 'border-amber-500/40 bg-gradient-to-b from-amber-50/80 via-white to-indigo-50/40 dark:from-indigo-950/40 dark:to-slate-900/80 ring-1 ring-amber-500/30' 
                          : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500/40'
                      }`}
                    >
                      <div>
                        {/* Avatar & Persona Badge */}
                        <div className="flex items-start gap-4 mb-3.5">
                          <div className="relative">
                            <img
                              src={agent.avatar}
                              alt={agent.name}
                              onError={(e) => { e.target.src = '/ruxt-logo.png'; }}
                              className={`w-16 h-16 rounded-2xl object-cover shadow-md bg-slate-100 dark:bg-slate-800 ring-2 ${
                                agent.slug === 'ruxt' ? 'ring-amber-400/70' : 'ring-indigo-500/30 group-hover:ring-indigo-500/70'
                              } transition`}
                            />
                            {agent.slug === 'ruxt' ? (
                              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-xs flex items-center justify-center font-bold shadow">
                                👑
                              </span>
                            ) : (
                              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                            )}
                      </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <h4 className="font-bold text-slate-900 dark:text-white text-base truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition flex items-center gap-1.5">
                                {agent.name}
                                {agent.slug === 'ruxt' && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30">LEADER</span>
                                )}
                              </h4>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-semibold whitespace-nowrap">
                                {agent.experience}
                              </span>
                        </div>
                            <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 truncate mt-0.5">
                              {agent.role}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-amber-500 font-medium">
                              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                              <span>{agent.rating}</span>
                              <span className="text-slate-400 dark:text-slate-500">({agent.reviews} reviews)</span>
                        </div>
                      </div>
                    </div>

                        {/* Persona Headline */}
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3 line-clamp-2">
                          "{agent.headline}"
                        </p>

                        {/* Skill Tags */}
                        <div className="flex flex-wrap gap-1.5 mb-5">
                          {agent.skills?.slice(0, 4).map((s) => (
                            <span
                              key={s}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50"
                            >
                              {s}
                            </span>
                          ))}
                          {agent.skills?.length > 4 && (
                            <span className="text-[10px] px-1.5 py-0.5 text-slate-400 dark:text-slate-500">
                              +{agent.skills.length - 4}
                            </span>
                          )}
                    </div>
                  </div>

                      {/* Actions */}
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
                        {agent.isInstalled ? (
                          <div className="flex-1 flex gap-2">
                            <button
                              onClick={() => handleCreateSession(agent.slug, `Coordinate with ${agent.name}`)}
                              className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition text-center shadow-md shadow-indigo-600/20"
                            >
                              {agent.slug === 'ruxt' ? 'Command Leader' : 'Collaborate'}
                            </button>
                            <span className="px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                      </div>
                        ) : (
                          <button
                            onClick={() => handleInstallAgent(agent.slug)}
                            disabled={installingSlug === agent.slug}
                            className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/30"
                          >
                            {installingSlug === agent.slug ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                Hiring Agent...
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3.5 h-3.5" />
                                Hire / 1-Click Install
                              </>
                            )}
                          </button>
                        )}

                        <a
                          href={`/api/marketplace/download/${agent.slug}`}
                          title="Download .ruxt package archive"
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          download
                        >
                          <Download className="w-4 h-4" />
                        </a>

                        <button
                          onClick={() => setSelectedMarketAgent(agent)}
                          title="View Full Profile & Bio"
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition"
                        >
                          Bio
                        </button>

                        {agent.isInstalled && agent.slug !== 'ruxt' && (
                          <button
                            onClick={() => handleOpenEditAgent(agent)}
                            title="Skill Up & Edit Agent"
                            className="p-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition flex items-center justify-center"
                          >
                            <Sparkles className="w-4 h-4 text-amber-400" />
                          </button>
                        )}
                  </div>
                </div>
                  ))}
          </div>
        </div>
          ) : activeTab === 'dashboard' ? (
            /* ============================================================ */
            /* DASHBOARD / OVERVIEW VIEW                                    */
            /* ============================================================ */
            <div className="space-y-6 max-w-6xl mx-auto">
              {/* RuXt Core Leader Command Hub Card */}
              <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-950 via-purple-950/60 to-slate-900 border border-indigo-500/30 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <img 
                      src={ruxtLeader.avatar} 
                      alt="RuXt Leader" 
                      className="w-20 h-20 rounded-2xl object-cover ring-4 ring-amber-400/60 shadow-xl bg-slate-800"
                      onError={(e) => { e.target.src = '/ruxt-logo.png'; }}
                    />
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-500 text-slate-950 text-xs flex items-center justify-center font-bold shadow-lg">
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
                    onClick={() => handleCreateSession('ruxt', 'Project Planning with RuXt')}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <Crown className="w-4 h-4 text-amber-300" />
                    Command Team with RuXt
                  </button>
                  <button
                    onClick={() => setActiveTab('marketplace')}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    Hire Specialists
                  </button>
            </div>
          </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-400">Team Specialists</span>
                    <Users className="w-4 h-4 text-indigo-400" />
              </div>
                  <div className="text-2xl font-bold text-white">{agents.length}</div>
            </div>

                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-400">Available on Hub</span>
                    <ShoppingBag className="w-4 h-4 text-pink-400" />
              </div>
                  <div className="text-2xl font-bold text-white">{marketplaceAgents.length}</div>
            </div>

                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-400">Active Tasks</span>
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
              </div>
                  <div className="text-2xl font-bold text-white">{tasks.length}</div>
            </div>

                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-400">Active Brain</span>
                    <Zap className="w-4 h-4 text-amber-400" />
              </div>
                  <div className="text-xs font-semibold text-white truncate">
                    {PROVIDER_NAMES[settings.active_provider] || 'Gemini'}
              </div>
            </div>
          </div>

              {/* Hired Agents Showcase */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Your Active Specialist Team
                  </h4>
                  <button
                    onClick={() => setActiveTab('marketplace')}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    + Hire More
                  </button>
            </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {agents.map((agent) => (
                    <div
                      key={agent.slug}
                      className={`p-4 rounded-2xl bg-slate-900/50 border transition group ${
                        agent.slug === 'ruxt' ? 'border-amber-500/40 bg-gradient-to-br from-indigo-950/30 to-slate-900' : 'border-slate-800 hover:border-indigo-500/40'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="relative">
                          <img
                            src={agent.avatar}
                            alt={agent.name}
                            onError={(e) => { e.target.src = '/ruxt-logo.png'; }}
                            className={`w-11 h-11 rounded-xl object-cover bg-slate-800 ring-2 ${
                              agent.slug === 'ruxt' ? 'ring-amber-400/80' : 'ring-indigo-500/20'
                            }`}
                          />
                          {agent.slug === 'ruxt' && (
                            <span className="absolute -top-1 -right-1 text-[10px]">👑</span>
                          )}
                    </div>
                        <div>
                          <h5 className="font-semibold text-white group-hover:text-indigo-400 transition text-sm flex items-center gap-1.5">
                            {agent.name}
                            {agent.slug === 'ruxt' && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">LEADER</span>
                            )}
                          </h5>
                          <p className="text-[11px] text-indigo-400 font-medium truncate">{agent.role}</p>
                    </div>
                  </div>
                      <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                        {agent.description}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCreateSession(agent.slug, `Chat with ${agent.name}`)}
                          className="flex-1 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition text-center"
                        >
                          {agent.slug === 'ruxt' ? 'Command' : 'Collaborate'}
                        </button>
                        {agent.uiEntry && (
                          <button
                            onClick={() => setSelectedAgentUi(agent)}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition"
                          >
                            UI
                          </button>
                        )}
                  </div>
                </div>
                  ))}
            </div>
          </div>
        </div>
          ) : activeTab === 'agents' ? (
            /* Agents Studio View */
            <div className="space-y-6 max-w-6xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">Active Specialist Team</h3>
                  <p className="text-xs text-slate-400">Managed and orchestrated by RuXt Local Engine.</p>
            </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchAllData}
                    className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition flex items-center gap-1.5"
                    title="Refresh Agent Team"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Scan & Refresh
                  </button>
                  <button
                    onClick={() => setActiveTab('marketplace')}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition flex items-center gap-1.5"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    Hire New Specialist
                  </button>
            </div>
          </div>

              {agents.length === 0 ? (
                <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800/80 flex flex-col items-center justify-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Users className="w-7 h-7" />
              </div>
                  <div>
                    <h4 className="text-base font-bold text-white">No Specialists Detected Yet</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                      Connecting to RuXt Local Engine... Ensure the backend engine is running on port 1234, or click below to scan installed agents.
                    </p>
              </div>
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={fetchAllData}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition flex items-center gap-2 shadow-md shadow-indigo-600/20"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Scan Local Workspace
                    </button>
                    <button
                      onClick={() => setActiveTab('marketplace')}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5 border border-slate-700/60"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Browse Talent Hub
                    </button>
              </div>
            </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {agents.map((agent) => (
                    <div
                      key={agent.slug}
                      className={`p-5 rounded-3xl bg-slate-900/70 border flex flex-col justify-between transition shadow-lg ${
                        agent.slug === 'ruxt' ? 'border-amber-500/40 bg-gradient-to-b from-indigo-950/40 to-slate-900 ring-1 ring-amber-500/20' : 'border-slate-800 hover:border-indigo-500/50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-3.5 mb-4">
                          <div className="relative">
                            <img
                              src={agent.avatar}
                              alt={agent.name}
                              onError={(e) => { e.target.src = '/ruxt-logo.png'; }}
                              className={`w-14 h-14 rounded-2xl object-cover bg-slate-800 ring-2 ${
                                agent.slug === 'ruxt' ? 'ring-amber-400/80' : 'ring-indigo-500/30'
                              }`}
                            />
                            {agent.slug === 'ruxt' && (
                              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-xs flex items-center justify-center font-bold shadow">
                                👑
                              </span>
                            )}
                      </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-bold text-white text-base truncate">{agent.name}</h4>
                              {agent.slug === 'ruxt' && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">LEADER</span>
                              )}
                        </div>
                            <p className="text-xs font-semibold text-indigo-400 truncate">{agent.role}</p>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono inline-block mt-1">
                              v{agent.version}
                            </span>
                      </div>
                    </div>

                        <p className="text-xs text-slate-300 leading-relaxed mb-4">{agent.description}</p>
                  </div>

                      <div className="pt-4 border-t border-slate-800/80 flex items-center gap-2">
                        <button
                          onClick={() => handleCreateSession(agent.slug, `Chat with ${agent.name}`)}
                          className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
                        >
                          {agent.slug === 'ruxt' ? 'Command Leader' : 'Start Session'}
                        </button>
                        {agent.uiEntry && (
                          <button
                            onClick={() => setSelectedAgentUi(agent)}
                            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition flex items-center gap-1.5"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            UI
                          </button>
                        )}
                        {agent.slug !== 'ruxt' && (
                          <button
                            onClick={() => handleUninstallAgent(agent.slug)}
                            title="Dismiss agent"
                            className="p-2 rounded-xl bg-slate-800/60 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                  </div>
                </div>
                  ))}
            </div>
              )}
        </div>
          ) : activeTab === 'chat' ? (
            /* AI Chat View (Full Canvas - Clean & Borderless) */
            <div className="h-full w-full flex-1 flex flex-row min-h-0 overflow-hidden bg-transparent">
              {/* Main Chat Column */}
              <div className="h-full flex-1 flex flex-col min-h-0 overflow-hidden bg-transparent">
                {/* Chat Top Identity Header (Polished Glass Backdrop) */}
              <div 
                className="px-6 py-3 flex items-center justify-between shrink-0 backdrop-blur-md border-b transition-colors"
                style={{ backgroundColor: 'var(--theme-header)', borderColor: 'var(--theme-border)' }}
              >
                  <div className="flex items-center gap-3">
                    {currentChatAgent ? (
                      <>
                        <div className="relative">
                          <img
                            src={currentChatAgent.avatar || getAgentAvatar(currentChatAgent.slug)}
                            alt={currentChatAgent.name}
                            onError={(e) => {
                              if (!e.currentTarget.src.includes('ruxt-logo.png')) {
                                e.currentTarget.src = '/ruxt-logo.png';
                              }
                            }}
                            className={`w-8 h-8 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 ring-2 ${
                              currentChatAgent.slug === 'ruxt' ? 'ring-amber-400/80' : 'ring-indigo-500/40'
                            }`}
                          />
                          {currentChatAgent.slug === 'ruxt' && (
                            <span className="absolute -top-1 -right-1 text-[9px]">👑</span>
                          )}
                    </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-2">
                            {currentChatAgent.name}
                            {currentChatAgent.slug === 'ruxt' && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30">LEADER</span>
                            )}
                            <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                      </div>
                          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                            {currentChatAgent.role}
                          </span>
                    </div>
                      </>
                    ) : (
                      <>
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-600/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                          <Bot className="w-4 h-4" />
                    </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-xs">General Workspace Assistant</div>
                          <span className="text-[10px] text-slate-500">Autonomous Model</span>
                    </div>
                      </>
                    )}
              </div>

                  {/* Active Brain & New Chat in Chat Header */}
                  <div className="flex items-center gap-2">
                    {isDesktopRunning && (
                      <button
                        onClick={handleAbortActiveDesktop}
                        className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/35 text-red-600 dark:text-red-300 border border-red-500/50 text-[10px] font-bold flex items-center gap-1.5 transition shadow-lg shadow-red-500/20 animate-pulse cursor-pointer"
                        title="Emergency Stop: Halt Vision Engine & Screen Control (ESC)"
                      >
                        <span className="w-2 h-2 rounded-full bg-red-500 dark:bg-red-400 animate-ping" />
                        <span>⏹️ Stop Vision Engine</span>
                        <kbd className="px-1 py-0.2 bg-red-100 dark:bg-red-950/80 rounded border border-red-500/40 text-[9px] font-mono">ESC</kbd>
                      </button>
                    )}
                    <button
                      onClick={() => setIsBoardRoomOpen(prev => !prev)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 transition shadow-xs ${
                        isBoardRoomOpen
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                      title="Open Executive Board Room Panel on the right"
                    >
                      <Users className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                      <span>Board Room</span>
                      {boardroomTasks.length > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                      )}
                    </button>
                    {currentChatAgent?.uiEntry && (
                      <button
                        onClick={() => setSelectedAgentUi(currentChatAgent)}
                        className="px-2.5 py-1 rounded-lg bg-pink-500/20 hover:bg-pink-500/35 text-pink-700 dark:text-pink-300 border border-pink-500/40 text-[10px] font-bold flex items-center gap-1.5 transition shadow-xs animate-pulse cursor-pointer"
                        title={`Open interactive UI for ${currentChatAgent.name}`}
                      >
                        <ExternalLink className="w-3 h-3 text-pink-500 dark:text-pink-400" />
                        <span>Interactive UI</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleCreateSession(activeSession?.agent_id || 'ruxt')}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-600/20 hover:bg-indigo-100 dark:hover:bg-indigo-600/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 text-[10px] font-semibold flex items-center gap-1.5 transition shadow-xs"
                      title="Start a fresh conversation thread with this specialist"
                    >
                      <Plus className="w-3 h-3" />
                      <span>New Chat</span>
                    </button>
                    {currentChatAgent && currentChatAgent.slug !== 'ruxt' && (
                      <button
                        onClick={() => handleOpenEditAgent(currentChatAgent)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                        title={`Skill Up & edit instructions for ${currentChatAgent.name}`}
                      >
                        <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                        <span>Skill Up</span>
                      </button>
                    )}
                    <span 
                      onClick={() => openSettings('models')}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-indigo-500/10 hover:bg-slate-200 dark:hover:bg-indigo-500/25 text-slate-700 dark:text-indigo-300 border border-slate-200 dark:border-indigo-500/20 text-[10px] font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                      title="Manage Active Brain in Settings"
                    >
                      <Zap className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                      {PROVIDER_NAMES[settings.active_provider] || 'Gemini'}
                    </span>
                    {/* Quick Light/Dark Switcher in Header */}
                    <button
                      type="button"
                      onClick={toggleLightDarkTheme}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                      title={isLightMode ? 'Switch to Focus Dark Theme' : 'Switch to Clean Light Theme'}
                    >
                      {isLightMode ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5 text-indigo-400" />}
                      <span className="hidden sm:inline font-mono">{isLightMode ? 'Light' : 'Dark'}</span>
                    </button>
                    {activeSession?.title && (
                      <span 
                        className="text-[10px] text-slate-500 dark:text-slate-400 font-mono hidden md:inline max-w-[130px] lg:max-w-[160px] truncate bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700/80 shadow-xs"
                        title={activeSession.title}
                      >
                        {activeSession.title}
                      </span>
                    )}
                  </div>
            </div>

                {/* Messages Box (Borderless & Centered Max-Width) */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
                  <div className={`max-w-4xl mx-auto w-full ${messages.length === 0 ? 'h-full flex flex-col justify-center' : 'space-y-4'}`}>
                    {messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center px-4 max-w-xl mx-auto py-8 select-text">
                      {/* Agent Avatar with ONLINE badge right at bottom matching reference */}
                      <div className="relative mb-4">
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden ring-4 ring-slate-200 dark:ring-slate-800 shadow-xl bg-white dark:bg-slate-900 mx-auto">
                          <img
                            src={(currentChatAgent ? currentChatAgent.avatar : ruxtLeader.avatar) || getAgentAvatar(currentChatAgent ? currentChatAgent.slug : 'ruxt')}
                            alt={currentChatAgent ? currentChatAgent.name : 'RuXt Assistant'}
                            onError={(e) => {
                              if (!e.currentTarget.src.includes('ruxt-logo.png')) {
                                e.currentTarget.src = '/ruxt-logo.png';
                              }
                            }}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {/* ONLINE badge right at bottom of avatar */}
                        <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/90 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/50 text-[9px] font-extrabold tracking-wider uppercase shadow-xs flex items-center gap-1 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                          ONLINE
                        </div>
                      </div>

                      {/* Agent Title & Persona Subtitle */}
                      <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
                        {currentChatAgent ? currentChatAgent.name : 'RuXt Assistant'}
                      </h2>
                      <p className="text-[11px] font-bold tracking-widest uppercase text-amber-600 dark:text-amber-500/90 mt-1.5 font-mono">
                        {currentChatAgent 
                          ? (currentChatAgent.slug === 'ruxt' ? 'PRIVATE AI CHIEF OF STAFF' : currentChatAgent.role.toUpperCase()) 
                          : 'PRIVATE AI CHIEF OF STAFF'}
                      </p>

                      {/* Description / Quote Paragraph */}
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-lg mt-3.5 opacity-90 font-normal">
                        &ldquo;{currentChatAgent 
                          ? (currentChatAgent.description || 'Hello! I am your private AI partner and Chief of Staff. Ask me anything in any language. I can break down projects, delegate to specialist executives, track tasks, and optimize your business.')
                          : 'Hello! I am your private AI partner and Chief of Staff. Ask me anything in any language. I can break down projects, delegate to specialist executives, track tasks, and optimize your business.'
                        }&rdquo;
                      </p>

                      {/* Red-marked suggestion cards are excluded as requested */}
                    </div>
                  ) : (
                    messages.map((m, mIdx) => {
                      let meta = null;
                      try {
                        meta = m.metadata ? (typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata) : null;
                      } catch (_) {}

                      const isUser = m.role === 'user';
                      const msgAgent = (activeSession?.agent_id && activeSession.agent_id !== 'ruxt')
                        ? (allKnownAgents.find(a => a.slug === activeSession.agent_id) || currentChatAgent || ruxtLeader)
                        : (currentChatAgent || ruxtLeader);
                      const agentAvatar = msgAgent?.avatar || getAgentAvatar(msgAgent?.slug || 'ruxt');
                      const agentName = msgAgent?.name || 'RuXt Assistant';
                      const agentRole = msgAgent?.slug === 'ruxt' ? 'Chief of Staff' : (msgAgent?.role || 'Specialist');

                      if (isUser) {
                        return (
                          <div
                            key={m.id || mIdx}
                            className="group flex flex-col items-end w-full animate-in fade-in duration-200"
                          >
                            <div className="flex items-center gap-2 mb-1 px-1 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(m.content);
                                  showNotification('Message copied to clipboard', 'success');
                                }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
                                title="Copy message"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              {m.created_at && (
                                <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              )}
                              <span className="font-semibold text-slate-600 dark:text-slate-400">You</span>
                            </div>

                            <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 sm:px-5 py-3 bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/20 text-[13px] leading-relaxed whitespace-pre-wrap select-text">
                              {m.content}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={m.id || mIdx}
                          className="group flex items-start gap-3 w-full animate-in fade-in duration-200"
                        >
                          {/* Agent Avatar */}
                          <div className="shrink-0 pt-0.5">
                            <div className="relative">
                              <img
                                src={agentAvatar}
                                alt={agentName}
                                onError={(e) => {
                                  if (!e.currentTarget.src.includes('ruxt-logo.png')) {
                                    e.currentTarget.src = '/ruxt-logo.png';
                                  }
                                }}
                                className="w-8 h-8 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-900 shadow-xs"
                              />
                              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-950" />
                            </div>
                          </div>

                          {/* Agent Message Content */}
                          <div className="flex-1 min-w-0 max-w-[92%] sm:max-w-[85%]">
                            {/* Agent Header Info & Action Controls */}
                            <div className="flex items-center justify-between gap-2 mb-1.5 px-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-bold text-xs text-slate-900 dark:text-white truncate">{agentName}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 font-medium truncate">
                                  {agentRole}
                                </span>
                                {m.created_at && (
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(m.content);
                                  showNotification('Response copied to clipboard', 'success');
                                }}
                                className="opacity-0 group-hover:opacity-100 px-2 py-0.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1 text-[11px] cursor-pointer"
                                title="Copy complete response"
                              >
                                <Copy className="w-3 h-3" />
                                <span className="hidden sm:inline">Copy</span>
                              </button>
                            </div>

                            {/* Message Bubble with Polished Markdown Renderer */}
                            <div className="rounded-2xl rounded-tl-sm p-4 sm:p-5 bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800/90 shadow-md shadow-slate-200/50 dark:shadow-xl backdrop-blur-sm text-[13px] text-slate-800 dark:text-slate-200">
                              <MarkdownRenderer content={m.content} />

                              {/* Autonomous Live Screen Desktop Operator Card */}
                              {meta?.desktopAction && (
                                <DesktopLiveOperatorCard desktopAction={meta.desktopAction} />
                              )}

                            {/* Inter-Agent Delegation & Consultation Banner Trigger */}
                            {meta?.dispatch && (
                              <div className="mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-indigo-50/70 via-sky-50/60 to-indigo-50/70 dark:from-slate-950 dark:via-indigo-950/40 dark:to-slate-950 border border-indigo-200 dark:border-indigo-500/40 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="flex -space-x-2 shrink-0">
                                    <img
                                      src={getAgentAvatar('ruxt')}
                                      alt="RuXt"
                                      className="w-8 h-8 rounded-full ring-2 ring-amber-500/80 bg-slate-100 dark:bg-slate-900 object-cover shadow-sm"
                                    />
                                    <img
                                      src={meta.dispatch.specialistAvatar || getAgentAvatar(meta.dispatch.specialistSlug || 'julian-vance')}
                                      alt={meta.dispatch.specialistName}
                                      className="w-8 h-8 rounded-full ring-2 ring-emerald-500/80 bg-slate-100 dark:bg-slate-900 object-cover shadow-sm"
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                        RuXt ⇄ {meta.dispatch.specialistName}
                                      </span>
                                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/30 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                                        Consensus Reached
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                      {meta.dispatch.decision || 'Specialist consultation & architectural consensus completed.'}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                                  <button
                                    type="button"
                                    onClick={() => setActiveSubChatPopup(meta.dispatch)}
                                    className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-600/30 dark:hover:bg-indigo-600/50 text-indigo-800 dark:text-indigo-200 hover:text-indigo-950 dark:hover:text-white border border-indigo-200 dark:border-indigo-500/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs hover:scale-[1.02]"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                    <span>View Discussion (Right Panel ↗)</span>
                                  </button>

                                  {meta.dispatch.prototypeCode && (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedMockupCode(meta.dispatch.prototypeCode)}
                                      className="px-3 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm hover:scale-[1.02]"
                                      title="Open Live UI Preview"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      <span>Preview</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                            </div>

                            {/* Recommendation Quick-Pill Replies */}
                            {meta?.quickReplies && mIdx === messages.length - 1 && (
                              <div className="mt-2.5 flex flex-wrap gap-2 max-w-[85%]">
                                {meta.quickReplies.map((qr, qrIdx) => (
                                  <button
                                    key={qrIdx}
                                    type="button"
                                    onClick={() => handleSendMessage(null, qr)}
                                    className="px-3.5 py-1.5 rounded-full bg-slate-900/90 hover:bg-indigo-950/90 border border-slate-700 hover:border-indigo-500 text-indigo-300 hover:text-white text-xs font-semibold transition shadow-sm hover:scale-[1.02] flex items-center gap-1.5"
                                  >
                                    <span>✦</span> {qr}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  {loadingMessage && (
                    <div className="flex items-start gap-3 w-full animate-in fade-in duration-200">
                      <div className="shrink-0 pt-0.5">
                        <div className="relative">
                          <img
                            src={(currentChatAgent ? currentChatAgent.avatar : ruxtLeader.avatar) || getAgentAvatar(currentChatAgent ? currentChatAgent.slug : 'ruxt')}
                            alt="AI Agent"
                            onError={(e) => { e.target.src = getAgentAvatar(currentChatAgent ? currentChatAgent.slug : 'ruxt'); }}
                            className="w-8 h-8 rounded-xl object-cover ring-1 ring-slate-700 bg-slate-900 shadow"
                          />
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping absolute -bottom-0.5 -right-0.5" />
                        </div>
                      </div>
                      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl rounded-tl-sm p-4 text-xs text-slate-300 flex items-center gap-2.5 shadow-lg backdrop-blur-sm">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                        <span className="font-medium text-slate-200">
                          {currentChatAgent ? `${currentChatAgent.name} is reasoning & generating response...` : `Reasoning via ${PROVIDER_NAMES[settings.active_provider] || 'AI'}...`}
                        </span>
                      </div>
                    </div>
                  )}
                  </div>
                </div>

                {/* Active Engine Paused / Disconnected Warning Alert */}
                {(() => {
                  const currentStatus = settings[`engine_status_${settings.active_provider || 'antigravity'}`] || 'connected';
                  if (currentStatus === 'paused') {
                    return (
                      <div className="mx-3 mt-2 p-3 rounded-2xl bg-amber-950/40 border border-amber-500/30 flex items-center justify-between text-xs text-amber-200">
                        <div className="flex items-center gap-2">
                          <Pause className="w-4 h-4 text-amber-400 shrink-0" />
                          <span><strong>{PROVIDER_NAMES[settings.active_provider] || 'Selected Engine'}</strong> is currently <strong>PAUSED</strong>.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSaveSetting(`engine_status_${settings.active_provider || 'antigravity'}`, 'connected')}
                          className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition shadow"
                        >
                          Resume Engine
                        </button>
                      </div>
                    );
                  }
                  if (currentStatus === 'disconnected') {
                    return (
                      <div className="mx-3 mt-2 p-3 rounded-2xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-between text-xs text-rose-200">
                        <div className="flex items-center gap-2">
                          <PowerOff className="w-4 h-4 text-rose-400 shrink-0" />
                          <span><strong>{PROVIDER_NAMES[settings.active_provider] || 'Selected Engine'}</strong> is <strong>DISCONNECTED</strong>.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSaveSetting(`engine_status_${settings.active_provider || 'antigravity'}`, 'connected')}
                          className="px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] transition shadow"
                        >
                          Connect Engine
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Input Section Container (Borderless Layout) */}
                <div className="max-w-5xl mx-auto w-full">
                  {/* Floating Modern Input Section (Matching User Reference Image) */}
                  <div className="p-4 sm:p-5 pt-0">
                  <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl p-3.5 backdrop-blur transition-all focus-within:border-indigo-500/60 focus-within:ring-2 focus-within:ring-indigo-500/20">
                    
                    {/* Attached Files Preview Bar (if any) */}
                    {attachedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2.5 pb-2 border-b border-slate-200 dark:border-slate-800/80">
                        {attachedFiles.map(file => (
                          <div key={file.id} className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200">
                            {file.type?.startsWith('image/') ? (
                              <img src={file.dataUrl} alt={file.name} className="w-5 h-5 rounded object-cover" />
                            ) : (
                              <Paperclip className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                            )}
                            <span className="max-w-[140px] truncate text-[11px] font-medium">{file.name}</span>
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">({file.size})</span>
                            <button
                              type="button"
                              onClick={() => setAttachedFiles(prev => prev.filter(f => f.id !== file.id))}
                              className="p-0.5 hover:text-rose-500 text-slate-400 rounded transition"
                              title="Remove file"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Textarea Input matching placeholder "Ask anything, @ to mention, / for actions" */}
                    <textarea
                      rows={2}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      onPaste={handlePasteClipboard}
                      placeholder="Ask anything, @ to mention, / for actions"
                      className="w-full bg-transparent border-0 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm focus:outline-none resize-none leading-relaxed"
                    />

                    {/* Hidden File Picker Input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileAttach}
                      multiple
                      className="hidden"
                    />

                    {/* Bottom Controls Row inside Input Box */}
                    <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-slate-100 dark:border-slate-800/60 flex-wrap gap-2">
                      
                      {/* Left Controls: Plus Attachment Button */}
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        {/* Plus Attachment Button */}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition border border-slate-200 dark:border-slate-700/60 shadow-xs"
                          title="Attach file, document, or screenshot (+)"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Right Controls: Turbo Toggle + Mic Voice Dictation + Circular Green Arrow Send Button */}
                      <div className="flex items-center gap-2">
                        
                        {/* Turbo Toggle Pill */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsTurboEnabled(!isTurboEnabled);
                            showNotification(isTurboEnabled ? 'Turbo mode disabled' : '⚡ Turbo mode enabled: ultra-fast reasoning', 'success');
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition ${
                            isTurboEnabled
                              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/50 shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border-slate-200 dark:border-slate-700/60'
                          }`}
                          title="Toggle Turbo ultra-fast reasoning mode"
                        >
                          <Zap className={`w-3.5 h-3.5 ${isTurboEnabled ? 'text-amber-500 dark:text-amber-400 fill-amber-400' : 'text-slate-400 dark:text-slate-500'}`} />
                          <span>Turbo</span>
                          <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                            isTurboEnabled ? 'bg-amber-500/30 text-amber-800 dark:text-amber-200 font-bold' : 'bg-slate-200 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400'
                          }`}>
                            {isTurboEnabled ? 'ON' : 'OFF'}
                          </span>
                        </button>

                        {/* Voice Microphone Button */}
                        <button
                          type="button"
                          onClick={toggleVoiceRecording}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition border ${
                            isRecordingVoice
                              ? 'bg-rose-600 text-white border-rose-400 animate-pulse shadow-md shadow-rose-600/40'
                              : 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-slate-700/60'
                          }`}
                          title={isRecordingVoice ? 'Listening... Click to stop voice dictation' : 'Voice input (Speech to text)'}
                        >
                          <Mic className="w-4 h-4" />
                        </button>

                        {/* Circular Green Upward Arrow Send Button */}
                        <button
                          type="button"
                          onClick={handleSendMessage}
                          disabled={loadingMessage || (!inputMessage.trim() && attachedFiles.length === 0)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition shadow-md ${
                            loadingMessage || (!inputMessage.trim() && attachedFiles.length === 0)
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700/40'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white dark:bg-emerald-950 dark:hover:bg-emerald-600 dark:text-emerald-400 dark:hover:text-white border border-emerald-500/60 shadow-emerald-500/20 transform hover:scale-105 active:scale-95'
                          }`}
                          title="Send message (Enter)"
                        >
                          {loadingMessage ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                          ) : (
                            <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Caption / Helper Info Below Input Box */}
                  <div className="flex items-center justify-between px-3 mt-2 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400/80" />
                      <span>Voice & text, drag-and-drop & screenshot paste (Ctrl+V)</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-[10px]">
                      <span>Press</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[9px] shadow-xs">
                        Enter
                      </kbd>
                      <span>to send</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

              {/* Right-Side Popup / Drawer for Inter-Agent Sub-Conversation */}
              {activeSubChatPopup && (
                <div 
                  className="w-[360px] sm:w-[420px] lg:w-[460px] h-full border-l backdrop-blur-xl flex flex-col shrink-0 z-20 shadow-2xl animate-in slide-in-from-right duration-200"
                  style={{ backgroundColor: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
                >
                  {/* Header */}
                  <div 
                    className="p-4 border-b flex items-center justify-between shrink-0"
                    style={{ backgroundColor: 'var(--theme-header)', borderColor: 'var(--theme-border)' }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex -space-x-2 shrink-0">
                        <img
                          src={getAgentAvatar('ruxt')}
                          alt="RuXt"
                          className="w-8 h-8 rounded-full ring-2 ring-amber-500/80 bg-slate-100 dark:bg-slate-900 object-cover shadow-sm"
                        />
                        <img
                          src={activeSubChatPopup.specialistAvatar || getAgentAvatar(activeSubChatPopup.specialistSlug || 'julian-vance')}
                          alt={activeSubChatPopup.specialistName}
                          className="w-8 h-8 rounded-full ring-2 ring-emerald-500/80 bg-slate-100 dark:bg-slate-900 object-cover shadow-sm"
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5 truncate">
                          <span>RuXt ⇄ {activeSubChatPopup.specialistName}</span>
                        </h3>
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium truncate block">
                          {activeSubChatPopup.specialistRole || 'Executive Specialist'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setActiveSubChatPopup(null)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title="Close Discussion Panel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Decision Banner Callout */}
                  {activeSubChatPopup.decision && (
                    <div className="m-3 p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-emerald-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 shadow-xs">
                      <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300 text-[11px] mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                        <span>Agreed Decision & Action Plan</span>
                      </div>
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                        {activeSubChatPopup.decision}
                      </p>
                    </div>
                  )}

                  {/* Scrollable Conversation Stream */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center my-1 flex items-center justify-center gap-2">
                      <span className="h-px w-8 bg-slate-200 dark:bg-slate-800" />
                      <span>Inter-Agent Deliberation</span>
                      <span className="h-px w-8 bg-slate-200 dark:bg-slate-800" />
                    </div>

                    {activeSubChatPopup.subChat && activeSubChatPopup.subChat.map((msg, idx) => {
                      const isFromRuxt = msg.from === 'ruxt';
                      const senderAvatar = isFromRuxt 
                        ? getAgentAvatar('ruxt') 
                        : (activeSubChatPopup.specialistAvatar || getAgentAvatar(activeSubChatPopup.specialistSlug || 'julian-vance'));

                      return (
                        <div 
                          key={idx}
                          className={`p-3.5 rounded-2xl border transition ${
                            isFromRuxt
                              ? 'bg-amber-50/60 dark:bg-slate-900/90 border-amber-300 dark:border-amber-500/30 text-slate-800 dark:text-slate-200 shadow-xs'
                              : 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-500/30 text-slate-800 dark:text-slate-200 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <img 
                                src={senderAvatar} 
                                alt={msg.fromName} 
                                className={`w-5 h-5 rounded-md object-cover ring-1 ${isFromRuxt ? 'ring-amber-400' : 'ring-indigo-400'}`} 
                              />
                              <span className={`text-[11px] font-bold ${isFromRuxt ? 'text-amber-700 dark:text-amber-300' : 'text-indigo-700 dark:text-indigo-300'}`}>
                                {msg.fromName}
                              </span>
                            </div>
                            <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                              {msg.time || 'Phase ' + (idx + 1)}
                            </span>
                          </div>

                          <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                            {msg.message}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer with actions */}
                  <div 
                    className="p-3 border-t flex items-center justify-between text-xs"
                    style={{ backgroundColor: 'var(--theme-header)', borderColor: 'var(--theme-border)' }}
                  >
                    <span className="text-[10px] text-slate-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Delivered to Main Chat
                    </span>

                    {activeSubChatPopup.prototypeCode && (
                      <button
                        onClick={() => setSelectedMockupCode(activeSubChatPopup.prototypeCode)}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Live Preview</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'tasks' ? (
            /* Modern Interactive Kanban Pipeline View */
            <div className="h-full flex flex-col p-4 overflow-hidden">
              <KanbanBoard
                tasks={tasks}
                agents={agents}
                boardroomSession={boardroomSession}
                onUpdateTaskStatus={handleUpdateTaskStatus}
                onAddTask={handleCreateKanbanTask}
                onDeleteTask={handleDeleteTask}
                onExecuteNext={handleExecuteNextStep}
                onExecuteAll={handleExecuteAllSteps}
                onOpenBoardRoom={() => setIsBoardRoomOpen(true)}
                isExecuting={isExecutingPipeline}
                getAgentAvatar={getAgentAvatar}
              />
            </div>
          ) : null}
        </div>
        )}
      </main>

      {/* Right-Side Executive Board Room Panel */}
      <BoardRoomPanel
        isOpen={isBoardRoomOpen}
        onClose={() => setIsBoardRoomOpen(false)}
        boardroomSession={boardroomSession}
        boardroomMessages={boardroomMessages}
        boardroomTasks={boardroomTasks}
        onStartMeeting={handleStartBoardroomMeeting}
        onExecuteNext={handleExecuteNextStep}
        onExecuteAll={handleExecuteAllSteps}
        onViewKanban={() => {
          setActiveTab('tasks');
          setSelectedAgentUi(null);
        }}
        isExecuting={isExecutingPipeline}
        getAgentAvatar={getAgentAvatar}
      />

      {/* Specialist Resume Modal */}
      {selectedMarketAgent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedMarketAgent(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            <div className="flex items-center gap-4 mb-5">
              <div className="relative">
                <img
                  src={selectedMarketAgent.avatar}
                  alt={selectedMarketAgent.name}
                  className="w-16 h-16 rounded-2xl object-cover ring-2 ring-indigo-500/40 bg-slate-800"
                  onError={(e) => { e.target.src = '/ruxt-logo.png'; }}
                />
                {selectedMarketAgent.slug === 'ruxt' && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-xs flex items-center justify-center font-bold">
                    👑
                  </span>
                )}
          </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">{selectedMarketAgent.name}</h3>
                  {selectedMarketAgent.slug === 'ruxt' ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/40">
                      LEADER
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-semibold">
                      {selectedMarketAgent.experience}
                    </span>
                  )}
            </div>
                <p className="text-xs font-semibold text-indigo-400">{selectedMarketAgent.role}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{selectedMarketAgent.category}</p>
          </div>
        </div>

            <div className="space-y-4 text-xs">
              <div>
                <h5 className="font-bold text-slate-300 uppercase tracking-wider mb-1">Professional Bio</h5>
                <p className="text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
                  {selectedMarketAgent.bio}
                </p>
          </div>

              <div>
                <h5 className="font-bold text-slate-300 uppercase tracking-wider mb-1.5">Specialized Skills</h5>
                <div className="flex flex-wrap gap-1.5">
                  {selectedMarketAgent.skills?.map((s) => (
                    <span key={s} className="px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {s}
                    </span>
                  ))}
            </div>
          </div>
        </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end gap-3">
              <a
                href={`/api/marketplace/download/${selectedMarketAgent.slug}`}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                download
              >
                Download Package
              </a>
              {!selectedMarketAgent.isInstalled ? (
                <button
                  onClick={() => {
                    handleInstallAgent(selectedMarketAgent.slug);
                    setSelectedMarketAgent(null);
                  }}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition"
                >
                  Hire & Install
                </button>
              ) : (
                <button
                  disabled
                  className="px-5 py-2 rounded-xl bg-slate-800 text-emerald-400 border border-emerald-500/30 text-xs font-semibold"
                >
                  Installed
                </button>
              )}
        </div>
      </div>
    </div>
      )}

      {/* Live Component Mockup Preview Modal */}
      {selectedMockupCode && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-6xl h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <span className="ml-2 text-xs font-bold text-white flex items-center gap-2">
                  <span>🎨</span> CeylonEscape Luxury Tourism Landing Page — Engineered by Julian Vance
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">HTML5 + Tailwind CSS</span>
                <button
                  type="button"
                  onClick={() => setSelectedMockupCode(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                >
                  Close Preview ✕
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-950 overflow-hidden">
              <iframe
                title="Mockup Preview"
                srcDoc={selectedMockupCode}
                className="w-full h-full border-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Workspace Settings Floating Modal Popup */}
      {isSettingsOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 md:p-8 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSettingsOpen(false);
          }}
        >
          <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl shadow-2xl max-w-5xl w-full h-[88vh] max-h-[840px] flex flex-col overflow-hidden ring-1 ring-white/10 relative">
            <SettingsView
              settings={settings}
              onSaveSetting={handleSaveSetting}
              onSaveBatch={handleSaveBatch}
              onClose={() => setIsSettingsOpen(false)}
              runtimes={detectedRuntimes}
              onScanRuntimes={scanHostRuntimes}
              scanningRuntimes={scanningRuntimes}
              showNotification={showNotification}
              testingConnection={testingConnection}
              connectionTestResult={connectionTestResult}
              handleTestConnection={handleTestConnection}
              initialCategory={settingsCategory}
              agents={agents}
              tasks={tasks}
              marketplaceAgents={marketplaceAgents}
              onCommandLeader={(prompt) => {
                setIsSettingsOpen(false);
                handleCreateSession('ruxt', prompt || 'Project Planning with RuXt');
              }}
              onNavigateTab={(tab) => {
                setIsSettingsOpen(false);
                setActiveTab(tab);
              }}
            />
          </div>
        </div>
      )}

      {/* Create New Team Modal Popup */}
      {isCreateTeamOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCreateTeamOpen(false);
          }}
        >
          <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full flex flex-col overflow-hidden ring-1 ring-white/10 relative">
            {/* Mismatch Confirmation Action Dialog Overlay */}
            {showMismatchConfirmModal && (
              <div className="absolute inset-0 z-30 bg-black/90 backdrop-blur-md p-6 flex flex-col justify-center items-center text-center animate-in fade-in zoom-in-95 duration-200">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shadow-lg shadow-amber-500/10">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-white mb-1.5">Mismatched Specialists Detected</h4>
                <p className="text-xs text-slate-300 max-w-sm mb-4 leading-relaxed">
                  <strong className="text-amber-300 font-semibold">{squadAlignment.mismatched.length} specialist(s)</strong> ({squadAlignment.mismatched.map(m => m.name).join(', ')}) do not align with your mission. What action would you like to take?
                </p>
                <div className="flex flex-col gap-2.5 w-full max-w-xs">
                  <button
                    type="button"
                    onClick={() => {
                      const mismatchedSlugs = new Set(squadAlignment.mismatched.map(m => m.slug));
                      const cleaned = newTeamSelectedAgents.filter(s => !mismatchedSlugs.has(s));
                      executeCreateTeam(cleaned);
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition shadow-lg shadow-amber-600/30 flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove Mismatched & Create
                  </button>
                  <button
                    type="button"
                    onClick={() => executeCreateTeam()}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                  >
                    Keep All & Create Squad
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMismatchConfirmModal(false)}
                    className="text-xs text-slate-400 hover:text-white transition py-1"
                  >
                    Cancel & Edit Selection
                  </button>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-800 bg-[#0d1322]/90 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Create New Agent Team</h3>
                  <p className="text-xs text-slate-400">Assemble a cross-functional squad of AI specialists</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateTeamOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateTeam} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Team Title */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  Team Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={newTeamTitle}
                  onChange={(e) => setNewTeamTitle(e.target.value)}
                  placeholder="e.g. Fullstack Engineering Squad, Growth Marketing Team..."
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition shadow-inner"
                  autoFocus
                  required
                />
              </div>

              {/* Mission / Objective (Mandatory) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-200">
                    Mission / Objective <span className="text-rose-400">*</span>
                  </label>
                  {newTeamDescription.trim().length >= 3 && (
                    <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full flex items-center gap-1 transition ${
                      squadAlignment.mismatched.length > 0
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {isAnalyzingSquad ? (
                        <>
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                          Checking Alignment...
                        </>
                      ) : squadAlignment.mismatched.length > 0 ? (
                        <>
                          <AlertCircle className="w-2.5 h-2.5 text-amber-400" />
                          {squadAlignment.mismatched.length} Mismatch Detected
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                          Squad Aligned
                        </>
                      )}
                    </span>
                  )}
                </div>
                <textarea
                  rows={2}
                  value={newTeamDescription}
                  onChange={(e) => setNewTeamDescription(e.target.value)}
                  placeholder="e.g. Build, test, and ship a high-performance React & Tailwind web application with CI/CD."
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition shadow-inner resize-none"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  A specific mission helps evaluate specialist fit and suggest missing squad talent.
                </p>
              </div>

              {/* Mismatched Specialists Action Banner */}
              {squadAlignment.mismatched.length > 0 && (
                <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-amber-300 text-xs font-bold">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Mismatched Specialists ({squadAlignment.mismatched.length})</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveAllMismatched}
                      className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg transition flex items-center gap-1 shadow-sm"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                      Remove All
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-200/80">
                    These selected specialists do not match this mission. Would you like to remove them?
                  </p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                    {squadAlignment.mismatched.map(agent => (
                      <div key={agent.slug} className="p-2 rounded-xl bg-slate-900/90 border border-amber-500/20 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img 
                            src={agent.avatar || '/ruxt-logo.png'} 
                            alt={agent.name}
                            className="w-7 h-7 rounded-lg object-cover ring-1 ring-amber-500/30 shrink-0"
                            onError={(e) => { e.target.src = '/ruxt-logo.png'; }}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{agent.name}</div>
                            <div className="text-[10px] text-amber-300/80 truncate">{agent.reason || agent.role}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSpecialist(agent.slug)}
                          className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 transition shrink-0 flex items-center gap-1"
                          title="Remove from squad"
                        >
                          <X className="w-3 h-3" />
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Available Specialists Action Banner */}
              {squadAlignment.recommended.length > 0 && (
                <div className="p-3 rounded-2xl bg-indigo-950/30 border border-indigo-500/40 space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-indigo-300 text-xs font-bold">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>Recommended Additions ({squadAlignment.recommended.length})</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddAllRecommended}
                      className="px-2 py-0.5 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition flex items-center gap-1 shadow-sm shadow-indigo-600/30"
                    >
                      <UserPlus className="w-2.5 h-2.5" />
                      Add All
                    </button>
                  </div>
                  <p className="text-[11px] text-indigo-200/80">
                    Available specialists who directly match this mission. Would you like to add them?
                  </p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                    {squadAlignment.recommended.map(agent => (
                      <div key={agent.slug} className="p-2 rounded-xl bg-slate-900/90 border border-indigo-500/20 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img 
                            src={agent.avatar || '/ruxt-logo.png'} 
                            alt={agent.name}
                            className="w-7 h-7 rounded-lg object-cover ring-1 ring-indigo-500/30 shrink-0"
                            onError={(e) => { e.target.src = '/ruxt-logo.png'; }}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{agent.name}</div>
                            <div className="text-[10px] text-indigo-300/80 truncate">{agent.reason || agent.role}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddSpecialist(agent.slug)}
                          className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition shrink-0 flex items-center gap-1 shadow-sm shadow-indigo-600/30"
                        >
                          <Plus className="w-3 h-3" />
                          Add to Team
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Agent Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-200">
                    Select Team Specialists <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {newTeamSelectedAgents.length} selected
                  </span>
                </div>

                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {specialistAgents.map((agent) => {
                    const isSelected = newTeamSelectedAgents.includes(agent.slug);
                    const isMismatched = squadAlignment.mismatched.some(m => m.slug === agent.slug);
                    const isRecommended = squadAlignment.recommended.some(r => r.slug === agent.slug);

                    return (
                      <div
                        key={agent.slug}
                        onClick={() => toggleAgentInTeam(agent.slug)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                          isSelected
                            ? isMismatched
                              ? 'bg-amber-950/30 border-amber-500/60 shadow-sm'
                              : 'bg-indigo-950/40 border-indigo-500/60 shadow-sm'
                            : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={agent.avatar || '/ruxt-logo.png'}
                            alt={agent.name}
                            className="w-8 h-8 rounded-xl object-cover bg-slate-800 ring-1 ring-slate-700 shrink-0"
                            onError={(e) => { e.target.src = '/ruxt-logo.png'; }}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-xs text-white truncate">{agent.name}</span>
                              {isSelected && isMismatched && (
                                <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  Mismatch
                                </span>
                              )}
                              {!isSelected && isRecommended && (
                                <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                                  Recommended
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">{agent.role}</div>
                          </div>
                        </div>

                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition shrink-0 ${
                          isSelected
                            ? isMismatched
                              ? 'bg-amber-600 border-amber-500 text-white'
                              : 'bg-indigo-600 border-indigo-500 text-white'
                            : 'border-slate-700 bg-slate-950'
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateTeamOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTeamTitle.trim() || !newTeamDescription.trim() || newTeamSelectedAgents.length === 0}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition shadow-lg shadow-indigo-600/30 flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Squad Confirmation Modal Popup */}
      {teamToDelete && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTeamToDelete(null);
          }}
        >
          <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl shadow-2xl max-w-sm w-full p-6 flex flex-col items-center text-center relative ring-1 ring-white/10 animate-in zoom-in-95 duration-150">
            {/* Close icon button */}
            <button
              onClick={() => setTeamToDelete(null)}
              className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3.5 shadow-lg shadow-rose-500/10">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <h3 className="text-base font-bold text-white mb-1.5">Delete Squad?</h3>
            <p className="text-xs text-slate-300 mb-2 leading-relaxed">
              Are you sure you want to remove squad <strong className="text-white font-semibold">"{teamToDelete.title}"</strong>?
            </p>
            <p className="text-[11px] text-slate-400 mb-5">
              This squad has {(teamToDelete.agentSlugs || []).filter(s => s !== 'ruxt').length} assigned specialist(s). This action cannot be undone.
            </p>

            <div className="flex items-center gap-2.5 w-full">
              <button
                type="button"
                onClick={() => setTeamToDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteTeam}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Squad
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden File Input for Importing .ruxt Packages */}
      <input
        type="file"
        ref={ruxtFileInputRef}
        accept=".ruxt,.🔰,.zip"
        onChange={handleImportRuxtPackage}
        className="hidden"
      />

      {/* Agent Studio Modal (Builder & Exporter) */}
      <AgentStudioModal
        isOpen={isAgentStudioOpen}
        agentToEdit={agentToEdit}
        onClose={() => {
          setIsAgentStudioOpen(false);
          setAgentToEdit(null);
        }}
        showNotification={showNotification}
        onAgentCreated={async (newAgent) => {
          await fetchAllData();
          await fetchMarketplaceAgents();
          if (newAgent?.slug) {
            handleOpenAgentChat(newAgent.slug, `Chat with ${newAgent.name}`);
          }
        }}
      />
    </div>
  );
}
