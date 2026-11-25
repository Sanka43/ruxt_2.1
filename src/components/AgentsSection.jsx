import React, { useState, useMemo, useRef } from 'react';
import { 
  Bot, 
  Search, 
  X, 
  Crown, 
  Sparkles, 
  SlidersHorizontal, 
  Trash2, 
  Eye, 
  RefreshCw, 
  Plus, 
  Upload, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Layers, 
  Code, 
  Tag, 
  Copy, 
  Check, 
  ExternalLink,
  Shield,
  FolderOpen,
  Info,
  Edit3,
  ArrowUpRight
} from 'lucide-react';

function SectionAgentAvatar({ agent }) {
  const [hasError, setHasError] = useState(false);
  const initialLetter = (agent.name || 'A').trim().charAt(0).toUpperCase();

  if (!agent.avatar || hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center relative bg-slate-100 dark:bg-slate-800">
        <span className="text-2xl sm:text-3xl font-bold text-indigo-600/70 dark:text-indigo-400 font-sans select-none">
          {initialLetter}
        </span>
      </div>
    );
  }

  return (
    <img
      src={agent.avatar || `/agent-avatars/${agent.slug}.png`}
      alt={agent.name}
      onError={() => setHasError(true)}
      className="w-full h-full object-cover rounded-xl"
    />
  );
}

export default function AgentsSection({
  agents = [],
  ruxtLeader,
  onEditAgent,
  onUninstallAgent,
  onRefreshAgents,
  onOpenAgentStudio,
  onImportPackage,
  showNotification,
  localSettings = {},
  playSound = () => {},
  onSaveSetting,
  onSaveBatch,
  handleChange
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedAgentSlug, setSelectedAgentSlug] = useState(null);
  const [agentDetails, setAgentDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailsTab, setDetailsTab] = useState('persona'); // 'persona' | 'skills' | 'permissions' | 'manifest'
  const [copiedPersona, setCopiedPersona] = useState(false);
  
  // Leader Rename & Edit Modal state
  const [isRenameLeaderOpen, setIsRenameLeaderOpen] = useState(false);
  const [leaderNameInput, setLeaderNameInput] = useState('');
  const [leaderRoleInput, setLeaderRoleInput] = useState('');
  const [leaderBioInput, setLeaderBioInput] = useState('');
  const [isSavingLeader, setIsSavingLeader] = useState(false);

  // Delete confirmation modal state
  const [agentToDelete, setAgentToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef(null);

  // Extract unique categories from installed agents
  const availableCategories = useMemo(() => {
    const cats = new Set();
    agents.forEach(a => {
      const cat = a.manifest?.category || a.category;
      if (cat) cats.add(cat);
    });
    return Array.from(cats);
  }, [agents]);

  // Filter agents based on search & category
  const filteredAgents = useMemo(() => {
    return agents.filter(agent => {
      const q = searchQuery.toLowerCase().trim();
      const cat = (agent.manifest?.category || agent.category || '').toLowerCase();
      
      const matchesCategory = categoryFilter === 'all' || cat === categoryFilter.toLowerCase();
      if (!matchesCategory) return false;

      if (!q) return true;
      const name = (agent.name || '').toLowerCase();
      const slug = (agent.slug || '').toLowerCase();
      const role = (agent.role || '').toLowerCase();
      const desc = (agent.description || '').toLowerCase();
      const skills = Array.isArray(agent.manifest?.skills) 
        ? agent.manifest.skills.map(s => String(s).toLowerCase()).join(' ')
        : '';

      return name.includes(q) || slug.includes(q) || role.includes(q) || desc.includes(q) || skills.includes(q);
    });
  }, [agents, searchQuery, categoryFilter]);

  const specialistAgents = useMemo(() => {
    return filteredAgents.filter(a => a.slug !== 'ruxt' && !a.isLeader);
  }, [filteredAgents]);

  const leaderAgent = useMemo(() => {
    const fromAgents = agents.find(a => a.slug === 'ruxt' || a.isLeader);
    const base = fromAgents || ruxtLeader || {};
    return {
      ...base,
      slug: 'ruxt',
      name: localSettings?.team_leader_name || ruxtLeader?.name || base.name || 'RuXt',
      role: localSettings?.team_leader_role || ruxtLeader?.role || base.role || 'Team Leader & Engine Orchestrator',
      avatar: localSettings?.team_leader_avatar || ruxtLeader?.avatar || base.avatar || '/agent-avatars/ruxt.png',
      description: localSettings?.team_leader_bio || ruxtLeader?.description || base.description || ''
    };
  }, [agents, ruxtLeader, localSettings]);

  // Open Rename Leader Modal
  const handleOpenRenameLeader = () => {
    if (playSound) playSound('click');
    setLeaderNameInput(localSettings?.team_leader_name || leaderAgent?.name || 'RuXt');
    setLeaderRoleInput(localSettings?.team_leader_role || leaderAgent?.role || 'Team Leader & Engine Orchestrator');
    setLeaderBioInput(localSettings?.team_leader_bio || leaderAgent?.description || '');
    setIsRenameLeaderOpen(true);
  };

  // Save Leader Profile (Name, Role, Bio)
  const handleSaveLeaderProfile = async (e) => {
    if (e) e.preventDefault();
    const newName = leaderNameInput.trim() || 'RuXt';
    const newRole = leaderRoleInput.trim() || 'Team Leader & Engine Orchestrator';
    const newBio = leaderBioInput.trim();

    setIsSavingLeader(true);
    try {
      const payload = {
        team_leader_name: newName,
        team_leader_role: newRole,
        team_leader_bio: newBio
      };

      if (handleChange) {
        handleChange('team_leader_name', newName);
        handleChange('team_leader_role', newRole);
        handleChange('team_leader_bio', newBio);
      }

      if (onSaveBatch) {
        await onSaveBatch(payload);
      } else if (onSaveSetting) {
        await onSaveSetting('team_leader_name', newName);
        if (newRole) await onSaveSetting('team_leader_role', newRole);
        if (newBio) await onSaveSetting('team_leader_bio', newBio);
      } else {
        await fetch('/api/settings/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: payload })
        });
      }

      if (playSound) playSound('success');
      if (showNotification) {
        showNotification(`✓ Team Leader renamed to "${newName}" successfully!`, 'success');
      }
      setIsRenameLeaderOpen(false);
      if (onRefreshAgents) await onRefreshAgents();
    } catch (err) {
      if (showNotification) {
        showNotification(`Failed to save leader: ${err.message}`, 'error');
      }
    } finally {
      setIsSavingLeader(false);
    }
  };

  // Inspect agent details
  const handleInspectAgent = async (agent) => {
    if (localSettings.sound_haptics !== 'false') playSound('click');
    setSelectedAgentSlug(agent.slug);
    setIsDetailsOpen(true);
    setLoadingDetails(true);
    setDetailsTab('persona');
    setCopiedPersona(false);

    try {
      const res = await fetch(`/api/marketplace/agent-details/${agent.slug}`);
      const data = await res.json();
      if (data.success && data.agent) {
        setAgentDetails(data.agent);
      } else {
        // Fallback to agent object
        setAgentDetails({
          slug: agent.slug,
          name: agent.name,
          role: agent.role,
          headline: agent.role,
          category: agent.manifest?.category || 'Specialist',
          bio: agent.description || '',
          persona: agent.manifest?.agent?.persona || '',
          skills: agent.manifest?.skills || agent.manifest?.tags || [],
          permissions: agent.manifest?.permissions || ['filesystem:read'],
          avatar: agent.avatar,
          version: agent.version || '1.0.0',
          hasCustomUi: Boolean(agent.uiEntry),
          manifest: agent.manifest
        });
      }
    } catch (_) {
      setAgentDetails({
        slug: agent.slug,
        name: agent.name,
        role: agent.role,
        headline: agent.role,
        category: agent.manifest?.category || 'Specialist',
        bio: agent.description || '',
        persona: '',
        skills: agent.manifest?.skills || agent.manifest?.tags || [],
        permissions: agent.manifest?.permissions || ['filesystem:read'],
        avatar: agent.avatar,
        version: agent.version || '1.0.0',
        hasCustomUi: Boolean(agent.uiEntry),
        manifest: agent.manifest
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  // Trigger Edit
  const handleEditClick = (agent) => {
    if (localSettings.sound_haptics !== 'false') playSound('click');
    if (agent.slug === 'ruxt' || agent.isLeader) {
      handleOpenRenameLeader();
      return;
    }
    if (onEditAgent) {
      onEditAgent(agent);
    } else if (onOpenAgentStudio) {
      onOpenAgentStudio();
    }
  };

  // Trigger Delete confirmation
  const handleRequestDelete = (agent) => {
    if (localSettings.sound_haptics !== 'false') playSound('click');
    if (agent.slug === 'ruxt' || agent.isLeader) {
      if (showNotification) showNotification('Cannot delete RuXt: Team Leader is protected.', 'error');
      return;
    }
    setAgentToDelete(agent);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!agentToDelete) return;
    setDeleting(true);
    try {
      if (onUninstallAgent) {
        await onUninstallAgent(agentToDelete.slug);
      } else {
        const res = await fetch(`/api/marketplace/uninstall/${agentToDelete.slug}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          if (showNotification) showNotification(`Agent ${agentToDelete.name || agentToDelete.slug} uninstalled.`, 'success');
          if (onRefreshAgents) await onRefreshAgents();
        } else {
          throw new Error(data.error || 'Failed to uninstall agent');
        }
      }

      if (localSettings.sound_haptics !== 'false') playSound('toggle');
      if (selectedAgentSlug === agentToDelete.slug) {
        setIsDetailsOpen(false);
        setAgentDetails(null);
      }
    } catch (err) {
      if (showNotification) showNotification(`Error deleting agent: ${err.message}`, 'error');
    } finally {
      setDeleting(false);
      setAgentToDelete(null);
    }
  };

  // Refresh agents list
  const handleRefreshClick = async () => {
    setRefreshing(true);
    if (localSettings.sound_haptics !== 'false') playSound('click');
    try {
      if (onRefreshAgents) {
        await onRefreshAgents();
      } else {
        await fetch('/api/agents?refresh=true');
      }
      if (showNotification) showNotification('Installed agents refreshed.', 'success');
    } catch (err) {
      if (showNotification) showNotification(`Refresh error: ${err.message}`, 'error');
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  // Copy persona text
  const handleCopyPersona = () => {
    if (!agentDetails?.persona) return;
    navigator.clipboard.writeText(agentDetails.persona);
    setCopiedPersona(true);
    if (localSettings.sound_haptics !== 'false') playSound('success');
    setTimeout(() => setCopiedPersona(false), 2000);
  };

  // Import agent package (.ruxt / .zip)
  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (onImportPackage) {
      onImportPackage(e);
      return;
    }

    setImporting(true);
    if (showNotification) showNotification(`Importing ${file.name}...`);
    if (localSettings.sound_haptics !== 'false') playSound('click');

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

          if (showNotification) showNotification(`✓ ${data.message || 'Agent package imported successfully!'}`, 'success');
          if (localSettings.sound_haptics !== 'false') playSound('success');
          if (onRefreshAgents) await onRefreshAgents();
        } catch (innerErr) {
          if (showNotification) showNotification(`✕ Import failed: ${innerErr.message}`, 'error');
        } finally {
          setImporting(false);
          if (e.target) e.target.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      if (showNotification) showNotification(`✕ Error reading package: ${err.message}`, 'error');
      setImporting(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Bot className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Installed Agents & Fleet
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 text-[11px] font-mono font-semibold">
                  {agents.length} Total
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Inspect system prompts, calibrate skills, update personas, and manage your local autonomous specialist talent.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          <input
            type="file"
            ref={importInputRef}
            onChange={handleFileImport}
            accept=".ruxt,.zip,.🔰"
            className="hidden"
          />

          <button
            type="button"
            onClick={handleRefreshClick}
            disabled={refreshing}
            title="Rescan and refresh agents"
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition flex items-center gap-2 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-500' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (localSettings.sound_haptics !== 'false') playSound('click');
              importInputRef.current?.click();
            }}
            disabled={importing}
            title="Import .ruxt or .zip agent package"
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition flex items-center gap-2 shadow-xs"
          >
            {importing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                <span>Importing...</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5 text-indigo-400" />
                <span>Import Agent</span>
              </>
            )}
          </button>

          {onOpenAgentStudio && (
            <button
              type="button"
              onClick={() => {
                if (localSettings.sound_haptics !== 'false') playSound('click');
                onOpenAgentStudio();
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-md shadow-indigo-600/25 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create Specialist</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agents by name, role, slug, or skill..."
            className="w-full pl-10 pr-9 py-2 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              categoryFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All ({agents.length})
          </button>
          {availableCategories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                categoryFilter.toLowerCase() === cat.toLowerCase()
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* CORE LEADER HERO CARD (RuXt) */}
      {leaderAgent && (!searchQuery || leaderAgent.name.toLowerCase().includes(searchQuery.toLowerCase()) || leaderAgent.role.toLowerCase().includes(searchQuery.toLowerCase())) && (
        <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-950 via-purple-950/50 to-slate-900 border border-amber-500/40 shadow-xl relative overflow-hidden group">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
            <div className="flex items-start sm:items-center gap-4">
              <div className="relative shrink-0">
                <img
                  src={leaderAgent.avatar || '/agent-avatars/ruxt.png'}
                  alt={leaderAgent.name}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-4 ring-amber-400/50 shadow-xl bg-slate-800"
                  onError={(e) => { e.target.src = '/agent-avatars/ruxt.png'; }}
                />
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-500 text-slate-950 text-xs flex items-center justify-center font-bold shadow-lg" title="Core Leader">
                  👑
                </span>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                    <span>{leaderAgent.name}</span>
                    <button
                      type="button"
                      onClick={handleOpenRenameLeader}
                      className="p-1 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800/80 transition cursor-pointer"
                      title={`Rename Leader (${leaderAgent.name})`}
                    >
                      <Edit3 className="w-4 h-4 text-amber-400" />
                    </button>
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold tracking-wider">
                    CORE TEAM LEADER & ORCHESTRATOR
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-mono">
                    v{leaderAgent.version || '2.1.0'}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed max-w-2xl line-clamp-2 sm:line-clamp-none">
                  {leaderAgent.description || 'Central orchestrator of RuXt Local Engine. Coordinates specialist agents, plans multi-stage projects, distributes tasks, and enforces deliverable quality.'}
                </p>

                {/* Key Leader Tags */}
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {[
                    'Team Leadership',
                    'Task Orchestration',
                    'Multi-Agent Workflow',
                    'Quality Assurance'
                  ].map(skill => (
                    <span key={skill} className="px-2 py-0.5 rounded-md bg-slate-900/80 border border-slate-700/80 text-[10px] text-slate-300 font-medium">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Leader Action Controls */}
            <div className="flex items-center gap-2 w-full lg:w-auto justify-end pt-2 lg:pt-0 border-t border-slate-800/80 lg:border-none">
              <button
                type="button"
                onClick={() => handleInspectAgent(leaderAgent)}
                className="px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-2 shadow-xs"
              >
                <Eye className="w-4 h-4 text-indigo-400" />
                <span>Inspect Persona</span>
              </button>

              <button
                type="button"
                onClick={handleOpenRenameLeader}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold transition shadow-md shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
                title="Rename Core Leader"
              >
                <Edit3 className="w-4 h-4 text-slate-950" />
                <span>Rename Leader</span>
              </button>

              <div 
                className="px-3 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-500 text-xs font-medium flex items-center gap-1.5 cursor-not-allowed select-none"
                title="RuXt is the Core Engine Leader and cannot be uninstalled."
              >
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span className="hidden sm:inline">Protected</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* RENAME CORE LEADER MODAL                                 */}
      {/* ======================================================== */}
      {isRenameLeaderOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSavingLeader) setIsRenameLeaderOpen(false);
          }}
        >
          <div className="bg-[#0c101c] border border-amber-500/40 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden relative ring-1 ring-amber-500/20">
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Rename Team Leader
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/30">DEFAULT</span>
                  </h3>
                  <p className="text-xs text-slate-400">Customize the central orchestrator's name and identity.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRenameLeaderOpen(false)}
                disabled={isSavingLeader}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveLeaderProfile} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Leader Call Sign / Display Name <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={leaderNameInput}
                  onChange={(e) => setLeaderNameInput(e.target.value)}
                  placeholder="e.g. RuXt, Jarvis, Athena, Apex..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm font-semibold focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition"
                  required
                  autoFocus
                />
                
                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-500 mr-1">Suggestions:</span>
                  {['RuXt', 'Jarvis', 'Athena', 'Friday', 'Apex', 'Nexus', 'Nova'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setLeaderNameInput(preset)}
                      className={`text-[10px] px-2 py-0.5 rounded-md border transition cursor-pointer ${
                        leaderNameInput === preset
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                          : 'bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Leader Title / Role
                </label>
                <input
                  type="text"
                  value={leaderRoleInput}
                  onChange={(e) => setLeaderRoleInput(e.target.value)}
                  placeholder="e.g. Team Leader & Engine Orchestrator"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs font-medium focus:border-amber-400 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Bio / Responsibilities Overview
                </label>
                <textarea
                  value={leaderBioInput}
                  onChange={(e) => setLeaderBioInput(e.target.value)}
                  rows={3}
                  placeholder="Central orchestrator and leader of RuXt Local Engine. Coordinates specialist agents..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:border-amber-400 focus:outline-none transition resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRenameLeaderOpen(false)}
                  disabled={isSavingLeader}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingLeader}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-lg shadow-amber-500/25 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingLeader ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save & Apply Name</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SPECIALIST AGENTS SECTION HEADER */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            Specialist Talent Fleet ({specialistAgents.length})
          </h3>
          <span className="text-xs text-slate-500">
            Click any agent to inspect instructions, calibrated skills & permissions
          </span>
        </div>

        {/* Empty State */}
        {specialistAgents.length === 0 && (
          <div className="p-10 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center mx-auto text-slate-400">
              <Bot className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-white">No specialist agents found</div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {searchQuery 
                ? `No installed agents match your search "${searchQuery}". Try a different keyword.`
                : 'No specialist agents are currently installed. You can create a new agent or install talent from the Marketplace.'}
            </p>
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline"
              >
                Clear search filter
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (localSettings.sound_haptics !== 'false') playSound('click');
                    importInputRef.current?.click();
                  }}
                  disabled={importing}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Import .ruxt Package</span>
                </button>
                {onOpenAgentStudio && (
                  <button
                    type="button"
                    onClick={() => {
                      if (localSettings.sound_haptics !== 'false') playSound('click');
                      onOpenAgentStudio();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Specialist</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Specialist Agents Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-3.5">
          {specialistAgents.map((agent) => {
            const category = agent.manifest?.category || agent.category || 'Engineering';
            const roleText = (agent.role || category).toUpperCase();
            const subtitle = `${roleText}${agent.uiEntry ? ' • PACKAGE UI' : ''}`;

            return (
              <div
                key={agent.slug}
                onClick={() => handleInspectAgent(agent)}
                className="group relative rounded-2xl p-3 sm:p-3.5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 shadow-2xs hover:shadow-md transition-all duration-150 flex items-stretch gap-3 sm:gap-3.5 cursor-pointer"
              >
                {/* Left: Avatar / Letter Box */}
                <div className="w-16 h-16 sm:w-18 sm:h-18 lg:w-20 lg:h-20 rounded-xl overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center relative select-none border border-slate-200/60 dark:border-slate-700/60">
                  <SectionAgentAvatar agent={agent} />
                </div>

                {/* Right: Content & Action Link */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div>
                    {/* Category / Role Subtitle */}
                    <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate font-semibold">
                      {subtitle}
                    </div>

                    {/* Agent Name */}
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition mt-0.5">
                      {agent.name}
                    </h4>

                    {/* Short Description */}
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                      {agent.description || `Specialist agent workspace for ${agent.name}`}
                    </p>
                  </div>

                  {/* Bottom Bar: Inspect agent ↗ + Quick actions */}
                  <div className="mt-2 pt-1 flex items-center justify-between">
                    <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center gap-0.5 transition">
                      <span>Inspect agent</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition" />
                    </div>

                    <div
                      className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => handleEditClick(agent)}
                        title="Edit in Studio"
                        className="p-1 rounded-md text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRequestDelete(agent)}
                        title="Uninstall Agent"
                        className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* AGENT DETAILS MODAL / DRAWER                             */}
      {/* ======================================================== */}
      {isDetailsOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDetailsOpen(false);
          }}
        >
          <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden ring-1 ring-white/10">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-900/40">
              <div className="flex items-center gap-4">
                <img
                  src={agentDetails?.avatar || `/agent-avatars/${selectedAgentSlug}.png`}
                  alt={agentDetails?.name || selectedAgentSlug}
                  className="w-14 h-14 rounded-2xl object-cover ring-2 ring-indigo-500/40 bg-slate-800 shrink-0"
                  onError={(e) => { e.target.src = '/agent-avatars/ruxt.png'; }}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white tracking-tight">
                      {agentDetails?.name || selectedAgentSlug}
                    </h3>
                    {selectedAgentSlug === 'ruxt' ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                        👑 Core Leader
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-semibold">
                        Specialist
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300">
                      v{agentDetails?.version || '1.0.0'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mt-0.5">
                    {agentDetails?.role || agentDetails?.headline || 'AI Autonomous Specialist'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Identifier: <span className="text-slate-400">{selectedAgentSlug}</span>
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 flex items-center justify-center text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs Navigation */}
            <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-800 bg-slate-900/20">
              <button
                type="button"
                onClick={() => setDetailsTab('persona')}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
                  detailsTab === 'persona'
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>System Persona (agent.md)</span>
              </button>

              <button
                type="button"
                onClick={() => setDetailsTab('skills')}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
                  detailsTab === 'skills'
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Skills & Abilities</span>
              </button>

              <button
                type="button"
                onClick={() => setDetailsTab('permissions')}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
                  detailsTab === 'permissions'
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Permissions & UI</span>
              </button>

              <button
                type="button"
                onClick={() => setDetailsTab('manifest')}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
                  detailsTab === 'manifest'
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>Manifest Raw</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {loadingDetails ? (
                <div className="py-16 text-center space-y-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-500 mx-auto" />
                  <p className="text-xs text-slate-400">Loading agent configuration...</p>
                </div>
              ) : (
                <>
                  {/* TAB 1: Persona */}
                  {detailsTab === 'persona' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                          Core Operational Instructions & System Prompt
                        </span>
                        {agentDetails?.persona && (
                          <button
                            type="button"
                            onClick={handleCopyPersona}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium text-slate-300 transition flex items-center gap-1.5"
                          >
                            {copiedPersona ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                            <span>{copiedPersona ? 'Copied!' : 'Copy Prompt'}</span>
                          </button>
                        )}
                      </div>

                      {agentDetails?.bio && (
                        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                            Bio & Objective
                          </span>
                          {agentDetails.bio}
                        </div>
                      )}

                      <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto selection:bg-indigo-600/40">
                        {agentDetails?.persona || (
                          <span className="text-slate-500 italic">
                            No custom agent.md system persona defined. Default base orchestrator persona will be used.
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: Skills */}
                  {detailsTab === 'skills' && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                          Calibrated Skills & Tool Capabilities
                        </h4>
                        <p className="text-xs text-slate-400">
                          These specialist skill packs are registered to this agent and executed when delegated by the leader.
                        </p>
                      </div>

                      {agentDetails?.skills && agentDetails.skills.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {agentDetails.skills.map((skill, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-2.5"
                            >
                              <div className="w-7 h-7 rounded-lg bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                                <Sparkles className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-white truncate">{String(skill)}</div>
                                <div className="text-[10px] text-slate-500">Autonomous Domain Tool</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-8 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400">
                          No specific skills registered for this agent.
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: Permissions & Custom UI */}
                  {detailsTab === 'permissions' && (
                    <div className="space-y-4">
                      {/* Permissions */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                          Security & System Permissions
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {(agentDetails?.permissions || ['filesystem:read']).map((perm, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-xs text-slate-200 font-mono flex items-center gap-1.5"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{perm}</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Custom UI status */}
                      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">Custom Web UI Interface</span>
                          {agentDetails?.hasCustomUi ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">
                              Enabled (ui/index.html)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px]">
                              Default Chat UI
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">
                          {agentDetails?.hasCustomUi
                            ? `This agent features an interactive companion application (${agentDetails.uiTitle || 'Interactive Interface'}) rendered inside RuXt.`
                            : 'This agent operates in headless / terminal / conversational chat mode without a bespoke HTML entry point.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: Raw Manifest */}
                  {detailsTab === 'manifest' && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                        manifest.json Specification
                      </span>
                      <pre className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 font-mono text-[11px] text-slate-300 leading-relaxed overflow-x-auto max-h-96">
                        {JSON.stringify(agentDetails?.manifest || agentDetails, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between gap-3">
              <div>
                {selectedAgentSlug !== 'ruxt' && (
                  <button
                    type="button"
                    onClick={() => {
                      const ag = agents.find(a => a.slug === selectedAgentSlug);
                      if (ag) handleRequestDelete(ag);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/40 border border-rose-500/30 text-xs font-semibold text-rose-300 transition flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Agent</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDetailsOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 transition"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const ag = agents.find(a => a.slug === selectedAgentSlug) || agentDetails;
                    setIsDetailsOpen(false);
                    if (ag) handleEditClick(ag);
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Edit in Agent Studio</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DELETE CONFIRMATION DIALOG                               */}
      {/* ======================================================== */}
      {agentToDelete && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleting) setAgentToDelete(null);
          }}
        >
          <div className="bg-[#0b0f19] border border-rose-500/40 rounded-3xl shadow-2xl max-w-md w-full p-6 text-center space-y-4 ring-1 ring-rose-500/20">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6 text-rose-400" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Delete Agent "{agentToDelete.name || agentToDelete.slug}"?
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                This will uninstall the specialist agent, remove all local files, persona prompt, and remove them from your active fleet. This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setAgentToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 transition"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition shadow-lg shadow-rose-600/30 flex items-center gap-1.5"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
