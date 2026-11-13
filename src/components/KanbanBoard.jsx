import React, { useState } from 'react';
import { 
  Plus, 
  Play, 
  FastForward, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Layers, 
  Users, 
  ExternalLink, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Sparkles, 
  FileText,
  X
} from 'lucide-react';

const COLUMNS = [
  { id: 'backlog', title: 'Backlog / Planned', icon: Layers, color: 'text-slate-500 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-800' },
  { id: 'in_progress', title: 'In Progress', icon: Clock, color: 'text-amber-500 dark:text-amber-400', border: 'border-amber-500/30' },
  { id: 'review', title: 'Quality Review', icon: AlertCircle, color: 'text-indigo-500 dark:text-indigo-400', border: 'border-indigo-500/30' },
  { id: 'done', title: 'Completed', icon: CheckCircle2, color: 'text-emerald-500 dark:text-emerald-400', border: 'border-emerald-500/30' }
];

export default function KanbanBoard({
  tasks = [],
  agents = [],
  boardroomSession = null,
  onUpdateTaskStatus,
  onAddTask,
  onDeleteTask,
  onExecuteNext,
  onExecuteAll,
  onOpenBoardRoom,
  isExecuting = false,
  getAgentAvatar
}) {
  const [selectedDeliverable, setSelectedDeliverable] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskAgent, setNewTaskAgent] = useState('ruxt');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskStatus, setNewTaskStatus] = useState('backlog');

  // Normalize task statuses into our 4 columns
  const normalizeStatus = (status) => {
    if (status === 'pending') return 'backlog';
    if (COLUMNS.some(c => c.id === status)) return status;
    return 'backlog';
  };

  const completedCount = tasks.filter(t => normalizeStatus(t.status) === 'done').length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const handleCreateTask = (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    onAddTask({
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim(),
      agent_id: newTaskAgent,
      priority: newTaskPriority,
      status: newTaskStatus,
      boardroom_id: boardroomSession?.id || null
    });
    setNewTaskTitle('');
    setNewTaskDesc('');
    setShowAddModal(false);
  };

  const moveTask = (task, direction) => {
    const colOrder = ['backlog', 'in_progress', 'review', 'done'];
    const currentNorm = normalizeStatus(task.status);
    const currIdx = colOrder.indexOf(currentNorm);
    const newIdx = direction === 'next' ? currIdx + 1 : currIdx - 1;
    if (newIdx >= 0 && newIdx < colOrder.length) {
      onUpdateTaskStatus(task.id, colOrder[newIdx]);
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'urgent':
        return <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30 text-[9px] font-bold uppercase">URGENT</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 text-[9px] font-bold uppercase">HIGH</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 text-[9px] font-bold uppercase">MEDIUM</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[9px] font-semibold uppercase">NORMAL</span>;
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4 max-w-7xl mx-auto w-full px-2 sm:px-4">
      {/* Top Banner & Control Bar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 shadow-sm dark:shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Orchestrated Kanban Pipeline
                {boardroomSession && (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-semibold font-mono">
                    Board Room Linked
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {boardroomSession ? `Active Squad Directive: "${boardroomSession.topic}"` : 'Track, reorder, and execute multi-specialist tasks step-by-step.'}
              </p>
            </div>
          </div>
        </div>

        {/* Global Progress & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Progress Pill */}
          <div className="px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Pipeline Velocity</div>
              <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">{completedCount} / {tasks.length} Done ({progressPercent}%)</div>
            </div>
            <div className="w-16 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 via-amber-400 to-emerald-500 transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Convene Board Room Trigger */}
          <button
            onClick={onOpenBoardRoom}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Open Board Room</span>
          </button>

          {/* Execute Next Step */}
          {boardroomSession && (
            <>
              <button
                onClick={onExecuteNext}
                disabled={isExecuting || completedCount === tasks.length}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition"
              >
                {isExecuting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>Run Next Step</span>
              </button>

              <button
                onClick={onExecuteAll}
                disabled={isExecuting || completedCount === tasks.length}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition"
              >
                <FastForward className="w-3.5 h-3.5 fill-current" />
                <span>Auto-Run All</span>
              </button>
            </>
          )}

          {/* Add Task Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 font-semibold text-xs flex items-center gap-1 transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Kanban Grid */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-4 gap-4 pb-6 overflow-y-auto">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter(t => normalizeStatus(t.status) === col.id);
          const ColIcon = col.icon;

          return (
            <div 
              key={col.id}
              className="flex flex-col rounded-3xl bg-slate-100/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 overflow-hidden shadow-xs dark:shadow-lg transition-colors"
            >
              {/* Column Header */}
              <div className="p-3.5 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-white dark:bg-slate-900/60">
                <div className="flex items-center gap-2">
                  <ColIcon className={`w-4 h-4 ${col.color}`} />
                  <span className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider">{col.title}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-mono font-bold border border-slate-200 dark:border-slate-700">
                  {colTasks.length}
                </span>
              </div>

              {/* Column Task Cards */}
              <div className="flex-1 p-3 space-y-3 overflow-y-auto min-h-[300px]">
                {colTasks.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-800/60 rounded-2xl text-slate-400 dark:text-slate-500 text-xs text-center p-3">
                    <span>No tasks in this stage</span>
                  </div>
                ) : (
                  colTasks.map((t) => {
                    const assignedAgent = agents.find(a => a.slug === t.agent_id) || {
                      name: t.agent_id === 'ruxt' ? 'RuXt Leader' : (t.agent_id || 'Unassigned'),
                      role: t.agent_id === 'ruxt' ? 'Orchestrator' : 'Specialist',
                      slug: t.agent_id || 'ruxt'
                    };

                    const isRunning = col.id === 'in_progress' && isExecuting;

                    return (
                      <div
                        key={t.id}
                        className={`p-3.5 rounded-2xl border transition-all duration-200 group relative ${
                          col.id === 'done'
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-500/20 hover:border-emerald-400 dark:hover:border-emerald-500/40 shadow-xs'
                            : col.id === 'in_progress'
                              ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-500/40 shadow-xs dark:shadow-lg dark:shadow-amber-500/5'
                              : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500/40 shadow-xs'
                        }`}
                      >
                        {/* Card Header: Assignee & Priority */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <img
                              src={getAgentAvatar ? getAgentAvatar(assignedAgent.slug) : `/agent-avatars/${assignedAgent.slug}.png`}
                              alt={assignedAgent.name}
                              className="w-5 h-5 rounded-md object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                              onError={(e) => { e.target.src = '/agent-avatars/ruxt.png'; }}
                            />
                            <div className="truncate max-w-[120px]">
                              <div className="text-[10px] font-bold text-slate-800 dark:text-slate-200 truncate">{assignedAgent.name}</div>
                            </div>
                          </div>
                          {getPriorityBadge(t.priority)}
                        </div>

                        {/* Title & Description */}
                        <h4 className={`text-xs font-semibold leading-snug ${col.id === 'done' ? 'text-slate-500 dark:text-slate-300' : 'text-slate-900 dark:text-white'}`}>
                          {t.title}
                        </h4>
                        {t.description && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-3 leading-relaxed">
                            {t.description}
                          </p>
                        )}

                        {/* Deliverable Badge if present */}
                        {t.deliverable_output && (
                          <button
                            onClick={() => setSelectedDeliverable(t)}
                            className="mt-2.5 w-full py-1.5 px-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center justify-center gap-1.5 transition"
                          >
                            <FileText className="w-3 h-3" />
                            <span>View Specialist Deliverable</span>
                          </button>
                        )}

                        {/* Running Status Animation */}
                        {isRunning && (
                          <div className="mt-2.5 flex items-center gap-2 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Specialist executing task...</span>
                          </div>
                        )}

                        {/* Bottom Actions: Move Left / Right & Delete */}
                        <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-slate-400">
                          <div className="flex items-center gap-1">
                            {col.id !== 'backlog' && (
                              <button
                                onClick={() => moveTask(t, 'prev')}
                                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
                                title="Move to previous stage"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {col.id !== 'done' && (
                              <button
                                onClick={() => moveTask(t, 'next')}
                                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
                                title="Advance to next stage"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <button
                            onClick={() => onDeleteTask(t.id)}
                            className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 transition opacity-0 group-hover:opacity-100"
                            title="Delete task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Deliverable Output Modal */}
      {selectedDeliverable && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[85vh] flex flex-col">
            <button
              onClick={() => setSelectedDeliverable(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{selectedDeliverable.title}</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Deliverable Artifact generated by {selectedDeliverable.agent_id}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed select-text">
              {selectedDeliverable.deliverable_output}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedDeliverable(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-semibold text-xs transition"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Add Task to Kanban Pipeline</h3>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Task Title</label>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. 'Build React Navigation Bar'..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Description</label>
                <textarea
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder="Task requirements and scope..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 h-20 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Assign Specialist</label>
                  <select
                    value={newTaskAgent}
                    onChange={(e) => setNewTaskAgent(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ruxt">RuXt (Team Leader)</option>
                    {agents.filter(a => a.slug !== 'ruxt').map((a) => (
                      <option key={a.slug} value={a.slug}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
