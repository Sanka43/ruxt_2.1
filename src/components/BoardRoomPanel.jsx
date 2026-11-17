import React, { useState, useEffect, useRef } from 'react';
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
  ExternalLink,
  Volume2,
  Radio,
  Zap
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
  onTasksUpdated,
  isExecuting = false,
  getAgentAvatar,
  isLive = false
}) {
  const [newTopic, setNewTopic] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('deliberation'); // 'deliberation' | 'tasks'

  // Live Deliberation Streaming States
  const [isLiveStreaming, setIsLiveStreaming] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState(null);
  const [playbackSpeed, setPlaybackSpeed] = useState('1x'); // '1x', '2x', 'instant'
  const [displayedMessages, setDisplayedMessages] = useState([]);
  const [hasStartedStream, setHasStartedStream] = useState(false);

  const transcriptEndRef = useRef(null);
  const eventSourceRef = useRef(null);

  // Sync displayed messages if not streaming
  useEffect(() => {
    if (!isLiveStreaming) {
      setDisplayedMessages(boardroomMessages);
    }
  }, [boardroomMessages, isLiveStreaming]);

  // Connect to SSE stream when live session begins or on user replay
  const startLiveStream = (sessionId, speed = playbackSpeed) => {
    if (!sessionId) return;

    // Clean up existing stream
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsLiveStreaming(true);
    setCurrentSpeaker(null);
    setDisplayedMessages([]);
    setHasStartedStream(true);

    const sseUrl = `/api/boardroom/stream/${sessionId}?speed=${speed}`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.addEventListener('speaker_turn', (e) => {
      try {
        const data = JSON.parse(e.data);
        setCurrentSpeaker(data);
      } catch (_) {}
    });

    es.addEventListener('message', (e) => {
      try {
        const msg = JSON.parse(e.data);
        setDisplayedMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      } catch (_) {}
    });

    es.addEventListener('consensus', (e) => {
      setCurrentSpeaker(null);
    });

    es.addEventListener('tasks', (e) => {
      try {
        const tasks = JSON.parse(e.data);
        if (onTasksUpdated && Array.isArray(tasks)) {
          onTasksUpdated(tasks);
        }
      } catch (_) {}
    });

    es.addEventListener('done', () => {
      setIsLiveStreaming(false);
      setCurrentSpeaker(null);
      es.close();
      eventSourceRef.current = null;
    });

    es.onerror = () => {
      setIsLiveStreaming(false);
      setCurrentSpeaker(null);
      es.close();
      eventSourceRef.current = null;
      // Fallback to static messages
      setDisplayedMessages(boardroomMessages);
    };
  };

  // Trigger live stream when a new session is convened and flagged as live
  useEffect(() => {
    if (isOpen && boardroomSession?.id && (isLive || boardroomSession.status === 'deliberating') && !hasStartedStream) {
      startLiveStream(boardroomSession.id, playbackSpeed);
    }
  }, [isOpen, boardroomSession?.id, isLive]);

  // Clean up SSE stream on unmount or close
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Auto-scroll to bottom of transcript as messages arrive
  useEffect(() => {
    if (activeTab === 'deliberation' && transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [displayedMessages, currentSpeaker, activeTab]);

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
    setHasStartedStream(false);
  };

  const handleSpeedChange = (newSpeed) => {
    setPlaybackSpeed(newSpeed);
    if (boardroomSession?.id && isLiveStreaming) {
      startLiveStream(boardroomSession.id, newSpeed);
    }
  };

  const handleSkipToConsensus = () => {
    if (boardroomSession?.id) {
      startLiveStream(boardroomSession.id, 'instant');
    }
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
      case 'domain_strategy':
      case 'seo_traffic':
      case 'compliance_audit':
      case 'strategic_analysis':
        return <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[9px] font-bold">DOMAIN ANALYSIS</span>;
      case 'decision':
        return <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-extrabold tracking-wide">CONSENSUS</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9px] font-semibold">DEBATE</span>;
    }
  };

  return (
    <aside 
      className={`fixed top-0 right-0 h-full z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-l border-slate-200 dark:border-slate-800/80 shadow-2xl flex flex-col transition-all duration-300 ${
        isExpanded ? 'w-full md:w-[680px]' : 'w-full md:w-[440px]'
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
              {isLiveStreaming ? (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[9px] font-extrabold tracking-wide animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  LIVE DELIBERATING
                </span>
              ) : (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[9px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Live Multi-Agent Deliberation & Decision Center</p>
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
            <span className="text-slate-600 dark:text-slate-400 truncate max-w-[240px] font-medium" title={boardroomSession.topic}>
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

      {/* Live Stream Controls Toolbar */}
      {boardroomSession && (
        <div className="px-4 py-2 bg-slate-100/60 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2">
            <Radio className={`w-3.5 h-3.5 ${isLiveStreaming ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`} />
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              {isLiveStreaming ? 'Streaming Dialogue Live' : 'Deliberation Complete'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {isLiveStreaming ? (
              <>
                <button
                  type="button"
                  onClick={() => handleSpeedChange(playbackSpeed === '1x' ? '2x' : '1x')}
                  className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold transition ${
                    playbackSpeed === '2x' 
                      ? 'bg-amber-500 text-slate-950 border-amber-500' 
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                  title="Toggle 2x Speed"
                >
                  {playbackSpeed === '2x' ? '2x Fast' : '1x Live'}
                </button>
                <button
                  type="button"
                  onClick={handleSkipToConsensus}
                  className="px-2 py-0.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 text-[10px] font-bold transition flex items-center gap-1"
                  title="Skip directly to Consensus Decision"
                >
                  <Zap className="w-2.5 h-2.5" />
                  Skip
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => startLiveStream(boardroomSession.id, playbackSpeed)}
                className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold transition flex items-center gap-1"
                title="Replay live speaker turns"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                Replay Live
              </button>
            )}
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
          Board Deliberation ({displayedMessages.length})
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

            {/* Live Speaker Spotlight Card */}
            {currentSpeaker && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-indigo-500/15 border-2 border-amber-500/50 shadow-lg shadow-amber-500/10 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <img
                        src={getAgentAvatar ? getAgentAvatar(currentSpeaker.agent_slug) : `/agent-avatars/${currentSpeaker.agent_slug}.png`}
                        alt={currentSpeaker.agent_name}
                        className="w-8 h-8 rounded-xl object-cover ring-2 ring-amber-400 shadow-md"
                        onError={(e) => { e.target.src = '/agent-avatars/ruxt.png'; }}
                      />
                      <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-950 animate-ping" />
                      <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-950" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                          {currentSpeaker.agent_name}
                        </span>
                        {getPhaseBadge(currentSpeaker.phase)}
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-300">
                        {currentSpeaker.agent_role}
                      </p>
                    </div>
                  </div>

                  {/* Audio Equalizer Waves Animation */}
                  <div className="flex items-center gap-1 pr-2">
                    <span className="w-1 h-3 bg-rose-500 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1 h-5 bg-amber-500 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1 h-6 bg-indigo-500 rounded-full animate-bounce [animation-delay:300ms]" />
                    <span className="w-1 h-4 bg-emerald-500 rounded-full animate-bounce [animation-delay:200ms]" />
                  </div>
                </div>

                <div className="text-[11px] font-medium text-amber-800 dark:text-amber-300 flex items-center gap-2 mt-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Deliberating live in the Board Room... ({currentSpeaker.index} / {currentSpeaker.total})</span>
                </div>
              </div>
            )}

            {/* Deliberation Transcript */}
            {displayedMessages.length === 0 && !currentSpeaker ? (
              <div className="text-center py-12 px-4 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto">
                  <Users className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Board Room is on Standby</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                  Enter a project goal above or send a prompt to RuXt Leader in Chat to initiate team dialogue and decision making.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayedMessages.map((msg, idx) => (
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

                    {msg.phase === 'decision' && (
                      <div className="mt-3 pt-2.5 border-t border-amber-500/20 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          Consensus Signed Off & Roadmap Dispatched
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveTab('tasks')}
                          className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                        >
                          View Member Tasks ({boardroomTasks.length}) →
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={transcriptEndRef} />
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
