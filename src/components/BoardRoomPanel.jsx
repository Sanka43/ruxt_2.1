import React, { useState } from 'react';
import { 
  Users, 
  MessageSquare, 
  CheckCircle2, 
  Play, 
  FastForward, 
  ChevronRight, 
  Sparkles, 
  Shield, 
  Code2, 
  DollarSign, 
  Layers, 
  X,
  Maximize2,
  Minimize2,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

export default function BoardRoomPanel({
  isOpen,
  onClose,
  boardroomSession,
  boardroomMessages = [],
  boardroomTasks = [],
  onStartMeeting,
  onExecuteNext,
  onExecuteAll,
  onViewKanban,
  isExecuting = false,
  getAgentAvatar
}) {
  const [newTopic, setNewTopic] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('deliberation'); // 'deliberation' | 'tasks'

  if (!isOpen) return null;

  const completedCount = boardroomTasks.filter(t => t.status === 'done').length;
  const progressPercent = boardroomTasks.length > 0 
    ? Math.round((completedCount / boardroomTasks.length) * 100) 
    : 0;

  const handleStartSubmit = (e) => {
    e.preventDefault();
    if (!newTopic.trim()) return;
    onStartMeeting(newTopic.trim());
    setNewTopic('');
  };

  const getPhaseBadge = (phase) => {
    switch (phase) {
      case 'opening':
        return <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[9px] font-bold">LEADER OPENING</span>;
      case 'proposal':
        return <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 text-[9px] font-bold">UX PROPOSAL</span>;
      case 'critique':
        return <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 text-[9px] font-bold">SECURITY & CLOUD</span>;
      case 'analysis':
        return <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[9px] font-bold">FINANCIAL ROI</span>;
      case 'decision':
        return <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-extrabold tracking-wide">CONSENSUS</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9px] font-semibold">DEBATE</span>;
    }
  };

  return (
    <aside 
      className={`fixed top-0 right-0 h-full z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-l border-slate-200 dark:border-slate-800/80 shadow-2xl flex flex-col transition-all duration-300 ${
        isExpanded ? 'w-full md:w-[650px]' : 'w-full md:w-[420px]'
      }`}
    >
      {/* Top Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500/20 to-indigo-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-300 shadow-xs">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-wide uppercase">Executive Board Room</h3>
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[9px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                ACTIVE
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Team Deliberation & Decision Center</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title={isExpanded ? 'Collapse width' : 'Expand width'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Close Board Room Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress & Quick Metrics Bar */}
      {boardroomSession && (
        <div className="px-4 py-2.5 bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-slate-600 dark:text-slate-400 truncate max-w-[240px] font-medium">
              🎯 {boardroomSession.topic}
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">
              {completedCount} / {boardroomTasks.length} ({progressPercent}%)
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 via-amber-400 to-emerald-500 transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Tab Selectors */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-xs">
        <button
          onClick={() => setActiveTab('deliberation')}
          className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-2 font-semibold transition ${
            activeTab === 'deliberation'
              ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500 bg-amber-50/50 dark:bg-amber-500/5'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Board Deliberation ({boardroomMessages.length})
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-2 font-semibold transition ${
            activeTab === 'tasks'
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/5'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Member Tasks ({boardroomTasks.length})
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'deliberation' ? (
          <>
            {/* New Topic Quick Trigger */}
            <form onSubmit={handleStartSubmit} className="space-y-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
              <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Convene Team Board Room on New Goal:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder="e.g. 'Build Car Rental Platform with Instant Booking'..."
                  className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                />
                <button
                  type="submit"
                  disabled={!newTopic.trim()}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-slate-950 font-bold text-xs transition shrink-0 shadow-xs"
                >
                  Convene
                </button>
              </div>
            </form>

            {/* Deliberation Transcript */}
            {boardroomMessages.length === 0 ? (
              <div className="text-center py-12 px-4 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto">
                  <Users className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Board Room is on Standby</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                  Enter a project goal above or send a prompt to RuXt Leader to initiate team dialogue and decision making.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {boardroomMessages.map((msg, idx) => (
                  <div 
                    key={msg.id || idx}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      msg.phase === 'decision'
                        ? 'bg-gradient-to-br from-amber-50 via-white to-amber-50/50 dark:from-amber-950/40 dark:via-slate-900 dark:to-amber-950/20 border-amber-300 dark:border-amber-500/50 shadow-sm dark:shadow-lg dark:shadow-amber-500/10'
                        : msg.agent_slug === 'ruxt'
                          ? 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 shadow-xs'
                          : 'bg-slate-50/60 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <img
                          src={getAgentAvatar ? getAgentAvatar(msg.agent_slug) : `/agent-avatars/${msg.agent_slug}.png`}
                          alt={msg.agent_name}
                          className="w-5 h-5 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-slate-700 shrink-0"
                          onError={(e) => { e.target.src = '/agent-avatars/ruxt.png'; }}
                        />
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          {msg.agent_name}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                          ({msg.agent_role})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getPhaseBadge(msg.phase)}
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">{msg.time || ''}</span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-800 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {msg.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Tasks breakdown per member */
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Decomposed Squad Roadmap:
              </span>
              <button
                onClick={onViewKanban}
                className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1"
              >
                Open Full Kanban <ExternalLink className="w-2.5 h-2.5" />
              </button>
            </div>

            {boardroomTasks.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 py-6 text-center">No tasks generated yet. Convene the board first.</p>
            ) : (
              boardroomTasks.map((t, idx) => (
                <div
                  key={t.id || idx}
                  className={`p-3 rounded-2xl border text-xs transition ${
                    t.status === 'done'
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-500/30 text-slate-700 dark:text-slate-300'
                      : t.status === 'in_progress'
                        ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-500/50 text-slate-900 dark:text-white shadow-xs'
                        : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[9px] font-mono text-slate-600 dark:text-slate-400">
                        {idx + 1}
                      </span>
                      <span className={t.status === 'done' ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}>
                        {t.title}
                      </span>
                    </span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      t.status === 'done' 
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                        : t.status === 'in_progress'
                          ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 animate-pulse'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {t.description}
                  </p>

                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 dark:text-slate-500">
                      Assigned: <strong className="text-slate-700 dark:text-slate-300">{t.agent_id}</strong>
                    </span>
                    <span className="font-mono text-amber-600 dark:text-amber-400 font-bold uppercase">
                      {t.priority}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Bottom Sticky Action Bar */}
      {boardroomTasks.length > 0 && (
        <div className="p-3 bg-white/90 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <button
            onClick={onExecuteNext}
            disabled={isExecuting || completedCount === boardroomTasks.length}
            className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition"
          >
            {isExecuting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>Execute Next Step</span>
          </button>

          <button
            onClick={onExecuteAll}
            disabled={isExecuting || completedCount === boardroomTasks.length}
            className="py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition shrink-0"
            title="Auto-execute all pipeline steps to 100% completion"
          >
            <FastForward className="w-3.5 h-3.5 fill-current" />
            <span>Auto-Run All</span>
          </button>

          <button
            onClick={onViewKanban}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
            title="Switch to full Kanban Board"
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>
      )}
    </aside>
  );
}
