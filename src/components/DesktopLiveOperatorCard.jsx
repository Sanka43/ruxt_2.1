import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  CheckCircle2, 
  Loader2, 
  FolderOpen, 
  ExternalLink, 
  Code, 
  Square, 
  Layers, 
  Activity, 
  MousePointer, 
  ChevronRight,
  Eye,
  Copy,
  Check
} from 'lucide-react';

export default function DesktopLiveOperatorCard({ desktopAction }) {
  const [jobState, setJobState] = useState(desktopAction || {});
  const [logs, setLogs] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(10);
  const [status, setStatus] = useState('running');
  const [copied, setCopied] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [visionSnapshot, setVisionSnapshot] = useState(null);
  const [targetCoord, setTargetCoord] = useState(null);
  const [aiThought, setAiThought] = useState('');
  const logEndRef = useRef(null);
  const canvasRef = useRef(null);

  const jobId = jobState?.jobId;
  const steps = jobState?.steps || [
    { id: 1, description: 'Discovering host application and runtime...' },
    { id: 2, description: 'Simulating visible mouse navigation to workspace...' },
    { id: 3, description: 'Synthesizing dynamic automation code...' },
    { id: 4, description: 'Executing task and compiling 3D scene...' },
    { id: 5, description: 'Finalizing deliverables...' }
  ];

  // 1. Subscribe to Live SSE events from backend & sync with Electron Floating HUD Banner
  useEffect(() => {
    if (!jobId) return;

    // Show on-screen floating HUD banner via Electron IPC
    if (window.ruxtDesktop?.showOverlay) {
      window.ruxtDesktop.showOverlay({
        taskName: jobState.taskTitle || 'Desktop Task',
        stepText: steps[0]?.description || 'Initializing...',
        actionIcon: '⚡',
        progress: 10
      });
    }

    const eventSource = new EventSource(`/api/desktop/stream/${jobId}`);

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.type === 'log') {
          setLogs(prev => [...prev.slice(-80), data.text]);
          if (data.text?.includes('[Vision Observation]')) {
            setAiThought(data.text.replace('[Vision Observation]', '').trim());
          }
        } else if (data.type === 'vision_snapshot') {
          if (data.image) setVisionSnapshot(data.image);
        } else if (data.type === 'target_coordinate') {
          setTargetCoord({ x: data.x, y: data.y });
        } else if (data.type === 'step_start') {
          setCurrentStepIndex(data.stepIndex);
          setProgress(data.progress || Math.round(((data.stepIndex + 1) / steps.length) * 100));

          // Sync with Electron Overlay HUD
          if (window.ruxtDesktop?.updateOverlay) {
            window.ruxtDesktop.updateOverlay({
              taskName: jobState.taskTitle,
              stepText: data.description,
              actionIcon: data.actionIcon || '⚙️',
              progress: data.progress
            });
          }
        } else if (data.type === 'step_done') {
          setProgress(data.progress || 100);
        } else if (data.type === 'complete') {
          setStatus('completed');
          setProgress(100);
          eventSource.close();

          // Auto-hide HUD overlay after 3 seconds on success
          if (window.ruxtDesktop?.updateOverlay) {
            window.ruxtDesktop.updateOverlay({
              taskName: jobState.taskTitle,
              stepText: 'Task successfully completed!',
              actionIcon: '✅',
              progress: 100
            });
            setTimeout(() => {
              window.ruxtDesktop?.hideOverlay?.();
            }, 3000);
          }
        } else if (data.type === 'aborted' || data.type === 'error') {
          setStatus('aborted');
          eventSource.close();
          if (window.ruxtDesktop?.hideOverlay) {
            setTimeout(() => window.ruxtDesktop.hideOverlay(), 1500);
          }
        }
      } catch (_) {}
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    // Listen for abort from floating HUD
    const handleAbortFromHUD = () => {
      handleAbort();
    };
    if (window.ruxtDesktop?.onAbort) {
      window.ruxtDesktop.onAbort(handleAbortFromHUD);
    }

    return () => {
      eventSource.close();
    };
  }, [jobId]);

  // Auto scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 2. Interactive 3D Canvas Visualizer (Procedural 3D Car Wireframe)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let angle = 0;

    const render3DCar = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2 + 10;
      const rad = angle * (Math.PI / 180);

      // Rotate coordinates
      const project = (x, y, z) => {
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rx = x * cos - z * sin;
        const rz = x * sin + z * cos + 240;
        const scale = 220 / Math.max(rz, 20);
        return {
          px: cx + rx * scale,
          py: cy - y * scale
        };
      };

      // Car 3D Box vertices
      const chassis = [
        [-60, -15, -30], [60, -15, -30], [60, 5, -30], [-60, 5, -30],
        [-60, -15, 30], [60, -15, 30], [60, 5, 30], [-60, 5, 30]
      ];
      const cabin = [
        [-25, 5, -22], [25, 5, -22], [15, 25, -18], [-20, 25, -18],
        [-25, 5, 22], [25, 5, 22], [15, 25, 18], [-20, 25, 18]
      ];

      // Draw shadow
      ctx.beginPath();
      ctx.ellipse(cx, cy + 28, 75, 24, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fill();

      // Draw wireframe lines
      const drawBox = (pts, color) => {
        const p = pts.map(pt => project(pt[0], pt[1], pt[2]));
        const edges = [
          [0,1],[1,2],[2,3],[3,0],
          [4,5],[5,6],[6,7],[7,4],
          [0,4],[1,5],[2,6],[3,7]
        ];
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.6;
        edges.forEach(([i, j]) => {
          ctx.beginPath();
          ctx.moveTo(p[i].px, p[i].py);
          ctx.lineTo(p[j].px, p[j].py);
          ctx.stroke();
        });
      };

      // Draw chassis and cabin
      drawBox(chassis, '#38bdf8');
      drawBox(cabin, '#06b6d4');

      // Draw Wheels
      const wheels = [
        [-40, -18, -32], [40, -18, -32],
        [-40, -18, 32], [40, -18, 32]
      ];
      wheels.forEach(w => {
        const wp = project(w[0], w[1], w[2]);
        ctx.beginPath();
        ctx.arc(wp.px, wp.py, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981';
        ctx.fill();
        ctx.strokeStyle = '#f8fafc';
        ctx.stroke();
      });

      angle = (angle + 1.2) % 360;
      animationFrameId = requestAnimationFrame(render3DCar);
    };

    render3DCar();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // 3. Action Handlers
  const handleAbort = async () => {
    if (!jobId) return;
    setStatus('aborted');
    try {
      await fetch(`/api/desktop/abort/${jobId}`, { method: 'POST' });
    } catch (_) {}
    if (window.ruxtDesktop?.hideOverlay) {
      window.ruxtDesktop.hideOverlay();
    }
  };

  const handleOpenExplorer = async () => {
    if (!jobState?.jobDir) return;
    try {
      await fetch('/api/desktop/open-explorer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPath: jobState.jobDir })
      });
    } catch (_) {}
  };

  const handleLaunchApp = async () => {
    try {
      await fetch('/api/desktop/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appName: jobState?.appSlug || 'blender' })
      });
    } catch (_) {}
  };

  const copyScript = () => {
    if (jobState?.scriptCode) {
      navigator.clipboard.writeText(jobState.scriptCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="mt-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-cyan-500/30 overflow-hidden shadow-md dark:shadow-2xl backdrop-blur-md">
      {/* Top Banner Header */}
      <div className="p-4 bg-slate-50 dark:bg-gradient-to-r dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-500 dark:text-cyan-400 shadow-md shadow-cyan-500/10">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">
                {jobState?.taskTitle || 'Live Desktop Task Execution'}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                status === 'completed'
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                  : status === 'aborted'
                  ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40'
                  : 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40 animate-pulse'
              }`}>
                {status === 'completed' ? '✓ Completed' : status === 'aborted' ? 'Aborted' : '⚡ Live on Work'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Operating <strong className="text-cyan-600 dark:text-cyan-300">{jobState?.appName || 'Desktop App'}</strong> • Zero Pre-Made Files (100% Dynamic AI Synthesis)
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {status === 'running' && (
            <button
              onClick={handleAbort}
              className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-600 dark:text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
              title="Stop desktop operation"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Stop
            </button>
          )}
          <button
            onClick={() => setShowScriptModal(!showScriptModal)}
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
            title="View dynamically generated script"
          >
            <Code className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
            Script
          </button>
          {jobState?.jobDir && (
            <button
              onClick={handleOpenExplorer}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
              title="Open folder in Windows Explorer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              Files
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-200 dark:bg-slate-950 h-1.5 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left Column: Live Steps Progress */}
        <div className="md:col-span-5 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2 mb-3">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            Autonomous Execution Steps
          </h4>

          <div className="space-y-2">
            {steps.map((st, idx) => {
              const isPast = idx < currentStepIndex || status === 'completed';
              const isCurrent = idx === currentStepIndex && status === 'running';

              return (
                <div 
                  key={st.id || idx}
                  className={`p-2.5 rounded-xl border transition flex items-start gap-2.5 ${
                    isCurrent 
                      ? 'bg-cyan-500/10 border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                      : isPast
                      ? 'bg-slate-950/60 border-slate-800/80 text-slate-300'
                      : 'bg-slate-950/30 border-slate-900 text-slate-500'
                  }`}
                >
                  <div className="mt-0.5">
                    {isPast ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : isCurrent ? (
                      <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-500 shrink-0">
                        {idx + 1}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold leading-tight ${isCurrent ? 'text-cyan-200' : isPast ? 'text-slate-200' : 'text-slate-500'}`}>
                      {st.description}
                    </p>
                    {isCurrent && (
                      <span className="inline-block mt-1 text-[10px] text-cyan-400 font-medium">
                        Active on screen...
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Live Vision Screen Viewport or Document / Turntable Preview */}
        <div className="md:col-span-7 flex flex-col gap-3">
          {visionSnapshot || jobState?.previewType === 'vision_stream' ? (
            /* Real-time Vision Screen Monitor Viewport */
            <div className="relative rounded-xl bg-slate-950 border border-cyan-500/35 p-3 flex flex-col overflow-hidden shadow-lg shadow-cyan-950/20">
              <div className="flex items-center justify-between text-slate-400 mb-2 border-b border-slate-800/80 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#38bdf8]" />
                  <span className="text-[11px] font-bold text-white tracking-wide flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    Live Computer Vision Screen Monitor
                  </span>
                </div>
                <span className="text-[10px] text-cyan-300 font-semibold bg-cyan-500/15 px-2 py-0.5 rounded border border-cyan-500/30">
                  Real-time Display Feed
                </span>
              </div>

              {visionSnapshot ? (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-slate-800 bg-black flex items-center justify-center">
                  <img 
                    src={visionSnapshot} 
                    alt="Active Desktop Screen" 
                    className="w-full h-full object-contain"
                  />
                  {targetCoord && (
                    <div 
                      className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full border-2 border-rose-500 bg-rose-500/20 animate-ping flex items-center justify-center pointer-events-none"
                      style={{
                        left: `${Math.min(95, Math.max(5, (targetCoord.x / 1536) * 100))}%`,
                        top: `${Math.min(95, Math.max(5, (targetCoord.y / 864) * 100))}%`
                      }}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full aspect-video rounded-lg border border-dashed border-slate-800 bg-slate-900/40 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
                  <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                  <span>Capturing real-time screen display for AI Vision...</span>
                </div>
              )}

              {aiThought && (
                <div className="mt-2 text-[11px] bg-cyan-950/40 border border-cyan-800/50 rounded-lg p-2 text-cyan-200 flex items-start gap-1.5">
                  <span className="text-sm">🧠</span>
                  <div>
                    <strong className="text-cyan-400">AI Vision Reasoning:</strong> {aiThought}
                  </div>
                </div>
              )}
            </div>
          ) : jobState?.appSlug === 'notepad' || jobState?.previewType === 'text' ? (
            /* Live Notepad Document Preview */
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 flex flex-col font-mono text-xs shadow-inner">
              <div className="flex items-center justify-between text-slate-400 mb-2 border-b border-slate-800/80 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-bold text-white tracking-wide">
                    📄 Document Content ({jobState?.scriptFilename || 'document.txt'})
                  </span>
                </div>
                <span className="text-[10px] text-emerald-300 font-semibold bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30">
                  Live Document
                </span>
              </div>

              <div className="max-h-36 overflow-y-auto whitespace-pre-wrap text-emerald-200/90 leading-relaxed bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-[11px]">
                {jobState?.scriptCode || "Drafting document content..."}
              </div>

              <div className="w-full flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 mt-2 pt-1.5">
                <span>App: <strong className="text-white">{jobState?.appName || 'Text Editor'}</strong></span>
                <button 
                  onClick={handleLaunchApp}
                  className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 transition"
                >
                  Open App <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            /* 3D WebGL Turntable Preview */
            <div className="relative rounded-xl bg-slate-950 border border-slate-800 p-2 flex flex-col items-center justify-center overflow-hidden">
              <div className="absolute top-2 left-3 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider z-10">
                <Eye className="w-3 h-3 text-cyan-400" />
                <span>Interactive 3D Viewport Turntable</span>
              </div>

              <canvas 
                ref={canvasRef} 
                width={340} 
                height={140}
                className="max-w-full cursor-grab active:cursor-grabbing"
              />

              <div className="w-full flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-1.5 px-2">
                <span>Model: <strong className="text-white">{jobState?.appName} 3D Asset</strong></span>
                <button 
                  onClick={handleLaunchApp}
                  className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 transition"
                >
                  Open in {jobState?.appName || 'App'} <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Live Terminal Output Stream */}
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 flex-1 flex flex-col font-mono text-[11px]">
            <div className="flex items-center justify-between text-slate-400 mb-2 border-b border-slate-800/60 pb-1.5">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                Live Execution Console
              </span>
              <span className="text-[10px] text-slate-500">
                {logs.length} events logged
              </span>
            </div>

            <div className="max-h-32 overflow-y-auto space-y-1 text-slate-300 pr-1">
              {logs.length === 0 ? (
                <p className="text-slate-600 italic">Connecting to desktop operator stream...</p>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="leading-relaxed">
                    <span className="text-cyan-400 mr-1.5">❯</span>
                    <span>{log}</span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </div>

      {/* Script Modal */}
      {showScriptModal && jobState?.scriptCode && (
        <div className="border-t border-slate-800 p-4 bg-slate-950/95">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Code className="w-3.5 h-3.5 text-cyan-400" />
              Dynamically Generated Script ({jobState?.scriptFilename || 'task.py'})
            </span>
            <button
              onClick={copyScript}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium flex items-center gap-1 transition"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy Code'}
            </button>
          </div>
          <pre className="max-h-48 overflow-y-auto p-3 rounded-lg bg-slate-900 text-cyan-200 text-xs font-mono border border-slate-800">
            {jobState.scriptCode}
          </pre>
        </div>
      )}
    </div>
  );
}
