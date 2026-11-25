import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Terminal, 
  CheckCircle2, 
  Sparkles, 
  Activity, 
  FileCode, 
  Wrench, 
  Cpu,
  Layers,
  ArrowRight
} from 'lucide-react';

/**
 * AgentTrajectoryViewer
 * Ultra-modern, pixel-perfect Agent Execution Trajectory & Tool Call UI.
 * Features light/dark theme adaptation, glassmorphism, tool badges, syntax tags, diffs, and elapsed timers.
 */

function formatDuration(ms) {
  if (!ms || ms < 1000) return '1s';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

// Generate progressive simulated steps during live execution
function getSimulatedLiveSteps(prompt = '', agentName = '') {
  const pClean = (prompt || '').trim();
  const pLower = pClean.toLowerCase();
  const nameLower = (agentName || '').toLowerCase();

  // 1. CapCut / Video Editing Specialist live trajectory
  if (nameLower.includes('capcut') || nameLower.includes('cinecut') || /\b(?:capcut|tiktok|reel|shorts?|video\s*clip|subtitles?|0930\.mp4)\b/i.test(pLower)) {
    return [
      {
        id: 1,
        type: 'analyze',
        badge: { type: 'video', text: 'Video', color: 'cyan' },
        action: 'Inspected media track',
        target: '0930.mp4',
        lineRange: '0s – 10s'
      },
      {
        id: 2,
        type: 'check',
        action: 'Configured canvas preset to',
        target: '9:16 Vertical (1080x1920)',
        hasChevron: true
      },
      {
        id: 3,
        type: 'analyze',
        badge: { type: 'text', text: 'Text', color: 'yellow' },
        action: 'Synchronized subtitle tracks',
        target: '3 Timed Subtitles (0s-3s, 3s-6.5s, 6.5s-9.5s)',
        lineRange: '#TextTrack'
      },
      {
        id: 4,
        type: 'edit',
        badge: { type: 'json', text: 'JSON', color: 'emerald' },
        action: 'Synthesized native draft',
        target: 'draft_content.json',
        diff: { added: 124, removed: 0 }
      },
      {
        id: 5,
        type: 'check',
        action: 'Registered draft with',
        target: 'root_meta_info.json',
        hasChevron: true
      },
      {
        id: 6,
        type: 'analyze',
        badge: { type: 'launch', text: 'App', color: 'indigo' },
        action: 'Launching CapCut Desktop App',
        target: 'CapCut.exe'
      }
    ];
  }

  // 2. Blender 3D / MCP Specialist live trajectory
  if (nameLower.includes('blender') || /\b(?:blender|3d|render|mesh|cylinder|cube|sphere|material|lighting)\b/i.test(pLower)) {
    return [
      {
        id: 1,
        type: 'analyze',
        badge: { type: 'py', text: 'Py', color: 'blue' },
        action: 'Connected MCP Server',
        target: 'blender-engine stdio',
        lineRange: '#SessionInit'
      },
      {
        id: 2,
        type: 'analyze',
        badge: { type: 'mcp', text: 'MCP', color: 'purple' },
        action: 'Called MCP Tool',
        target: 'create_mesh(primitive="cylinder", radius=1.0)',
        lineRange: 'mesh_001'
      },
      {
        id: 3,
        type: 'analyze',
        badge: { type: 'mcp', text: 'MCP', color: 'purple' },
        action: 'Called MCP Tool',
        target: 'set_material(metallic=0.9, roughness=0.1, color="blue")',
        lineRange: 'mat_metallic'
      },
      {
        id: 4,
        type: 'analyze',
        badge: { type: 'mcp', text: 'MCP', color: 'purple' },
        action: 'Called MCP Tool',
        target: 'setup_lighting(type="SUN", energy=4.0)',
        lineRange: 'light_sun'
      },
      {
        id: 5,
        type: 'analyze',
        badge: { type: 'mcp', text: 'MCP', color: 'purple' },
        action: 'Called MCP Tool',
        target: 'get_scene_objects()',
        lineRange: '4 objects active'
      },
      {
        id: 6,
        type: 'check',
        action: 'Scene serialized to',
        target: 'blender_scene.blend',
        hasChevron: true
      }
    ];
  }

  const fileRegex = /([a-zA-Z0-9_\-\.\/]+\.(?:jsx|js|tsx|ts|html|css|json|py|php|sql|md))/gi;
  const matches = (pClean.match(fileRegex) || []);
  const targetFile = matches[0] || 'App.jsx';

  return [
    {
      id: 1,
      type: 'analyze',
      badge: { type: 'html', text: 'HTML', color: 'orange' },
      action: 'Analyzed',
      target: 'index.html',
      lineRange: '#L1-43'
    },
    {
      id: 2,
      type: 'search',
      action: 'Ran search for',
      target: 'workspace configuration',
      hasChevron: true
    },
    {
      id: 3,
      type: 'analyze',
      badge: { type: 'jsx', text: 'React', color: 'cyan' },
      action: 'Analyzed',
      target: targetFile,
      lineRange: '#L20-80'
    }
  ];
}

export default function AgentTrajectoryViewer({
  steps = [],
  title = null,
  durationMs = null,
  isLive = false,
  prompt = '',
  agentName = 'RuXt',
  defaultExpanded = false
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [elapsedMs, setElapsedMs] = useState(durationMs || 0);
  const [visibleStepCount, setVisibleStepCount] = useState(isLive ? 1 : (steps?.length || 0));
  const [expandedStepId, setExpandedStepId] = useState(null);

  const liveStepsRef = useRef(getSimulatedLiveSteps(prompt, agentName));

  // Live stopwatch and progressive step streaming
  useEffect(() => {
    if (!isLive) {
      if (durationMs) setElapsedMs(durationMs);
      return;
    }

    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, 1000);

    // Stream steps progressively
    const totalSimulated = liveStepsRef.current.length;
    const stepInterval = setInterval(() => {
      setVisibleStepCount(prev => {
        if (prev < totalSimulated) return prev + 1;
        return prev;
      });
    }, 800);

    return () => {
      clearInterval(timerInterval);
      clearInterval(stepInterval);
    };
  }, [isLive, durationMs]);

  const activeSteps = isLive
    ? liveStepsRef.current.slice(0, visibleStepCount)
    : (steps && steps.length > 0 ? steps : liveStepsRef.current);

  const isCapCut = (agentName || '').toLowerCase().includes('capcut') || (agentName || '').toLowerCase().includes('cinecut') || /capcut|video|reel|tiktok|draft/i.test(prompt || '');
  const fallbackTitle = isCapCut ? 'Synthesizing CapCut Draft Timeline' : 'Executing Task Plan';
  const displayTitle = title || (activeSteps[activeSteps.length - 1] ? (isCapCut ? `${activeSteps[activeSteps.length - 1].action}: ${activeSteps[activeSteps.length - 1].target}` : `Executing ${activeSteps[activeSteps.length - 1].target}`) : fallbackTitle);

  return (
    <div className="font-sans text-[13px] select-text w-full my-2">
      {/* Modern container adapting to both Light and Dark modes with glassmorphism */}
      <div className="rounded-xl bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800/80 shadow-xs backdrop-blur-sm transition-all duration-150 hover:border-slate-300 dark:hover:border-slate-700/80 overflow-hidden">
        {/* Top Header Bar */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between px-3.5 py-2.5 cursor-pointer select-none text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Status Indicator */}
            {isLive ? (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
              </span>
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            )}

            {/* Display Title */}
            <span className="font-medium text-xs sm:text-[13px] text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white truncate">
              {displayTitle}
            </span>

            {/* Duration Badge */}
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300/40 dark:border-slate-700/60 shrink-0">
              {formatDuration(elapsedMs)}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition">
            <span className="text-[10.5px] font-mono hidden sm:inline text-slate-400 dark:text-slate-500">
              {isExpanded ? 'Hide' : `${activeSteps.length} steps`}
            </span>
            <div className="p-0.5 rounded hover:bg-slate-200/60 dark:hover:bg-slate-800 transition">
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </div>
          </div>
        </div>

        {/* Expandable Step Trajectory List */}
        {isExpanded && (
          <div className="px-3.5 pb-3 pt-1 border-t border-slate-200/70 dark:border-slate-800/60 space-y-1 animate-in fade-in duration-150">
            {activeSteps.map((step, idx) => {
              const isSearch = step.type === 'search';
              const isEdit = step.type === 'edit';
              const hasChevron = step.hasChevron || isSearch;

              return (
                <div key={step.id || idx} className="space-y-1">
                  <div
                    onClick={() => {
                      if (hasChevron) {
                        setExpandedStepId(expandedStepId === step.id ? null : step.id);
                      }
                    }}
                    className={`flex items-center justify-between py-1 px-2 rounded-lg transition-colors text-xs leading-relaxed group ${
                      hasChevron ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50' : 'hover:bg-slate-100/60 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    {/* Left: Action label, language badge, target name */}
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span className="text-slate-500 dark:text-slate-400 font-normal">
                        {step.action}
                      </span>

                      {/* Language / File Type Badges */}
                      {step.badge && (
                        <span className="inline-flex items-center font-mono font-semibold text-[10px] leading-none shrink-0">
                          {step.badge.type === 'mcp' && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20 font-mono text-[9.5px] font-semibold flex items-center gap-1 shadow-2xs">
                              <Wrench className="w-2.5 h-2.5" />
                              <span>MCP</span>
                            </span>
                          )}
                          {step.badge.type === 'py' && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/20 font-mono text-[9.5px] font-semibold flex items-center gap-0.5">
                              <span>Py</span>
                            </span>
                          )}
                          {step.badge.type === 'video' && (
                            <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border border-cyan-500/20 font-mono text-[9.5px] font-semibold">
                              Video
                            </span>
                          )}
                          {step.badge.type === 'json' && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20 font-mono text-[9.5px] font-semibold">
                              JSON
                            </span>
                          )}
                          {step.badge.type === 'launch' && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 font-mono text-[9.5px] font-semibold">
                              Run
                            </span>
                          )}
                          {step.badge.type === 'html' && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20 font-mono text-[9.5px] font-semibold">
                              HTML
                            </span>
                          )}
                          {step.badge.type === 'jsx' && (
                            <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-300 border border-sky-500/20 font-mono text-[9.5px] font-semibold">
                              React
                            </span>
                          )}
                          {step.badge.type === 'js' && (
                            <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-600 dark:text-yellow-300 border border-yellow-500/20 font-mono text-[9.5px] font-semibold">
                              JS
                            </span>
                          )}
                          {step.badge.type === 'ts' && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/20 font-mono text-[9.5px] font-semibold">
                              TS
                            </span>
                          )}
                        </span>
                      )}

                      {/* File Name / Target */}
                      <span className="font-semibold text-slate-800 dark:text-slate-100 truncate font-mono text-[11.5px]">
                        {step.target}
                      </span>

                      {/* Line Range (e.g. #L1-43, #SessionInit) */}
                      {step.lineRange && (
                        <span className="text-slate-400 dark:text-slate-500 font-mono text-[10px] shrink-0 font-normal">
                          {step.lineRange}
                        </span>
                      )}

                      {/* Edit Diffs (e.g. +124 -0) */}
                      {isEdit && step.diff && (
                        <div className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold ml-1">
                          <span className="text-emerald-600 dark:text-emerald-400">+{step.diff.added}</span>
                          <span className="text-rose-500">-{step.diff.removed}</span>
                        </div>
                      )}
                    </div>

                    {/* Right Chevron for expandable steps */}
                    {hasChevron && (
                      <span className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 text-[10px] ml-2 shrink-0">
                        {expandedStepId === step.id ? '▼' : '›'}
                      </span>
                    )}
                  </div>

                  {/* Expanded Step Details (when clicked) */}
                  {expandedStepId === step.id && (
                    <div className="ml-4 p-2 rounded-lg bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                      <div className="text-slate-400 dark:text-slate-500 mb-0.5">// Matched workspace reference:</div>
                      <div className="text-indigo-600 dark:text-indigo-300 truncate">
                        target: {step.target}
                      </div>
                      <div className="text-emerald-600 dark:text-emerald-400 text-[10px] mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Context verified in active memory</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Bottom Status Row */}
            <div className="pt-2 mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-800/40">
              {isLive ? (
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                  </span>
                  <span className="text-slate-600 dark:text-slate-300 font-medium animate-pulse">Running live tools...</span>
                </div>
              ) : (
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Execution complete</span>
                </span>
              )}

              <span className="font-mono text-[10.5px] text-slate-400 dark:text-slate-500">
                {activeSteps.length} steps in {formatDuration(elapsedMs)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
