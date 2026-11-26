import React, { useEffect, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

// Shows the oldest tool call that is waiting for a yes/no. The chat request stays open while it waits,
// so this polls on its own instead of relying on the chat response.
export default function ToolApprovalPrompt() {
  const [pending, setPending] = useState([]);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch('/api/tool-approvals');
        if (res.ok && alive) setPending((await res.json()).pending || []);
      } catch (_) { /* server restarting: try again on the next tick */ }
      if (alive) timer.current = setTimeout(poll, 1500);
    };
    poll();
    return () => { alive = false; clearTimeout(timer.current); };
  }, []);

  const current = pending[0];
  if (!current) return null;

  const answer = async (decision) => {
    setBusy(true);
    try {
      await fetch(`/api/tool-approvals/${current.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision })
      });
      setPending((list) => list.filter((p) => p.id !== current.id));
    } finally {
      setBusy(false);
    }
  };

  const remembered = current.policy === 'first-use';
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-xl border border-amber-500/40 bg-zinc-900 p-5 text-zinc-100 shadow-2xl">
        <div className="mb-3 flex items-center gap-2 text-amber-400">
          <ShieldAlert size={20} />
          <h2 className="text-base font-semibold">{current.agentName} wants to run a tool</h2>
        </div>
        <p className="mb-2 text-sm text-zinc-300">
          Tool: <code className="rounded bg-zinc-800 px-1.5 py-0.5">{current.tool}</code>
        </p>
        <pre className="mb-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-zinc-950 p-3 text-xs text-zinc-300">
          {JSON.stringify(current.args, null, 2)}
        </pre>
        <p className="mb-4 text-xs text-zinc-400">
          {remembered
            ? 'Allowing this lets this agent use this tool without asking again. You can revoke it later.'
            : 'This tool asks every time it runs.'}
          {pending.length > 1 ? ` (${pending.length - 1} more waiting)` : ''}
        </p>
        <div className="flex justify-end gap-2">
          <button disabled={busy} onClick={() => answer('deny')} className="rounded-lg border border-zinc-600 px-4 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50">Deny</button>
          <button disabled={busy} onClick={() => answer('approve')} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400 disabled:opacity-50">
            {remembered ? 'Allow' : 'Allow once'}
          </button>
        </div>
      </div>
    </div>
  );
}
