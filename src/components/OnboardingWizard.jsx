import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles, KeyRound, ShieldCheck, CheckCircle2, AlertCircle, ExternalLink,
  Loader2, ArrowRight, ArrowLeft, Eye, EyeOff, Cpu, Lock
} from 'lucide-react';
import {
  PROVIDERS, getProvider, shouldShowOnboarding,
  checkApiKey, buildTestPayload, buildSettingsPayload, interpretTestResult
} from '../lib/onboarding.js';

const STEPS = ['Welcome', 'Connect AI', 'Stay in control'];

async function getJson(url) {
  try {
    const res = await fetch(url);
    return await res.json();
  } catch (_) {
    return null;
  }
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  return { ok: res.ok, data };
}

/** Decides whether to show the wizard (first run only) and lets Settings re-open it. */
export default function OnboardingGate() {
  const [open, setOpen] = useState(false);
  const [desktopOk, setDesktopOk] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [settingsRes, workspaceRes, statusRes] = await Promise.all([
        getJson('/api/settings'),
        getJson('/api/workspace'),
        getJson('/api/status')
      ]);
      if (cancelled) return;
      if (statusRes && statusRes.desktopAutomation === false) setDesktopOk(false);
      if (shouldShowOnboarding({ settings: settingsRes?.settings, workspace: workspaceRes?.workspace })) {
        setOpen(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const reopen = () => setOpen(true);
    window.addEventListener('ruxt:open-onboarding', reopen);
    return () => window.removeEventListener('ruxt:open-onboarding', reopen);
  }, []);

  if (!open) return null;
  return <OnboardingWizard desktopOk={desktopOk} onClose={() => setOpen(false)} />;
}

export function OnboardingWizard({ desktopOk = true, onClose }) {
  const [step, setStep] = useState(0);
  const [providerId, setProviderId] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [test, setTest] = useState({ state: 'idle', message: '' }); // idle | testing | ok | error
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const primaryRef = useRef(null);

  const provider = getProvider(providerId);
  const keyCheck = checkApiKey(provider, apiKey);

  useEffect(() => { primaryRef.current?.focus(); }, [step]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pickProvider = (id) => {
    setProviderId(id);
    setApiKey('');
    setTest({ state: 'idle', message: '' });
  };

  const runTest = async () => {
    setTest({ state: 'testing', message: '' });
    try {
      const { ok, data } = await postJson('/api/settings/test-connection', buildTestPayload(provider, apiKey));
      const result = interpretTestResult(provider, ok ? data : { success: false, error: data?.error });
      setTest({ state: result.ok ? 'ok' : 'error', message: result.message });
    } catch (err) {
      setTest({ state: 'error', message: err.message || 'Could not reach the RuXt engine.' });
    }
  };

  const markDone = async () => {
    await postJson('/api/settings', { key: 'onboarding_completed', value: 'true' });
  };

  const skip = async () => {
    try { await markDone(); } catch (_) {}
    onClose();
  };

  const finish = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const { ok, data } = await postJson('/api/settings/batch', { settings: buildSettingsPayload(provider, apiKey) });
      if (!ok || !data?.success) throw new Error(data?.error || 'Could not save your settings.');
      // Reload so every part of the app picks up the new provider and key
      window.location.reload();
    } catch (err) {
      setSaveError(err.message);
      setSaving(false);
    }
  };

  const canLeaveConnectStep = keyCheck.ok;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="w-full max-w-lg rounded-2xl bg-[#0d1322] border border-slate-800 shadow-2xl shadow-black/60 text-slate-100 overflow-hidden"
      >
        {/* Progress */}
        <div className="px-6 pt-5 flex items-center gap-2" aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
          {STEPS.map((name, i) => (
            <div key={name} className="flex-1">
              <div className={`h-1 rounded-full transition-colors ${i <= step ? 'bg-indigo-500' : 'bg-slate-700'}`} />
              <div className={`mt-1.5 text-[10px] font-semibold uppercase tracking-wider ${i === step ? 'text-indigo-300' : 'text-slate-500'}`}>
                {name}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-5">
          {step === 0 && (
            <div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 id="onboarding-title" className="text-xl font-bold mb-1.5">Welcome to RuXt AI Studio</h2>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                Your team of AI specialists, running on your own PC. Setup takes about a minute.
              </p>
              <ul className="space-y-2.5 text-sm">
                <li className="flex gap-3"><Cpu className="w-4 h-4 mt-0.5 text-indigo-300 shrink-0" /><span><strong>Local first.</strong> Chats, agents and settings stay on this computer.</span></li>
                <li className="flex gap-3"><Lock className="w-4 h-4 mt-0.5 text-indigo-300 shrink-0" /><span><strong>Your keys stay private.</strong> API keys are encrypted on disk and never shown in full.</span></li>
                <li className="flex gap-3"><ShieldCheck className="w-4 h-4 mt-0.5 text-indigo-300 shrink-0" /><span><strong>You approve risky actions</strong> before the AI deletes, buys or runs commands.</span></li>
              </ul>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <KeyRound className="w-5 h-5 text-indigo-300" />
                <h2 id="onboarding-title" className="text-xl font-bold">Connect an AI</h2>
              </div>
              <p className="text-sm text-slate-300 mb-3">Choose where the AI thinking happens. You can change this later in Settings.</p>

              <div className="space-y-2 mb-3" role="radiogroup" aria-label="AI provider">
                {PROVIDERS.map((p) => {
                  const selected = p.id === providerId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => pickProvider(p.id)}
                      className={`w-full text-left rounded-xl border px-3.5 py-2.5 transition flex items-center gap-3 ${
                        selected ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-500 bg-slate-900/40'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full border-2 shrink-0 ${selected ? 'border-indigo-400 bg-indigo-400' : 'border-slate-500'}`} />
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          {p.label}
                          {p.badge && <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">{p.badge}</span>}
                        </span>
                        <span className="block text-xs text-slate-400">{p.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {provider.needsKey && (
                <div className="mb-2">
                  <label htmlFor="onboarding-key" className="text-xs font-semibold text-slate-300 flex items-center justify-between mb-1">
                    <span>{provider.label} API key</span>
                    <a href={provider.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-300 hover:text-indigo-200">
                      Get a key <ExternalLink className="w-3 h-3" />
                    </a>
                  </label>
                  <div className="relative">
                    <input
                      id="onboarding-key"
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => { setApiKey(e.target.value); setTest({ state: 'idle', message: '' }); }}
                      placeholder={`${provider.keyPrefix}…`}
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 focus:border-indigo-500 outline-none px-3 py-2 pr-10 text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((v) => !v)}
                      aria-label={showKey ? 'Hide key' : 'Show key'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {apiKey && keyCheck.warning && (
                    <p className={`mt-1 text-xs ${keyCheck.ok ? 'text-amber-300' : 'text-rose-300'}`}>{keyCheck.warning}</p>
                  )}
                </div>
              )}

              <div className="min-h-[2.25rem]" aria-live="polite">
                {test.state === 'testing' && (
                  <p className="text-xs text-slate-300 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Testing connection…</p>
                )}
                {test.state === 'ok' && (
                  <p className="text-xs text-emerald-300 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> {test.message}</p>
                )}
                {test.state === 'error' && (
                  <p className="text-xs text-rose-300 flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> <span>{test.message} You can still continue and fix it later in Settings.</span></p>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 mb-4">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 id="onboarding-title" className="text-xl font-bold mb-1.5">You stay in control</h2>
              <ul className="space-y-2.5 text-sm text-slate-300 mb-1">
                <li><strong className="text-slate-100">Approve or deny.</strong> When the AI wants to do something hard to undo (delete, pay, run commands), it pauses and asks you first.</li>
                <li><strong className="text-slate-100">Stop any time.</strong> Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-xs">Esc</kbd> or the Stop button while the AI is working on your screen.</li>
                <li><strong className="text-slate-100">Nothing leaves silently.</strong> Dangerous commands such as formatting a drive are always blocked.</li>
              </ul>
              {!desktopOk && (
                <p className="mt-3 text-xs rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 px-3 py-2">
                  Screen control works on Windows only. Chat, agents and the boardroom work on every system.
                </p>
              )}
              {saveError && (
                <p className="mt-3 text-xs rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-200 px-3 py-2" role="alert">{saveError}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-1 flex items-center justify-between gap-3">
          <div>
            {step === 0 ? (
              <button type="button" onClick={skip} className="text-xs text-slate-400 hover:text-slate-200 transition">Skip setup</button>
            ) : (
              <button type="button" onClick={() => setStep(step - 1)} disabled={saving} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition disabled:opacity-50">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === 0 && (
              <button ref={primaryRef} type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-bold transition">
                Get started <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === 1 && (
              <>
                <button type="button" onClick={runTest} disabled={!keyCheck.ok || test.state === 'testing'} className="px-3 py-2 rounded-xl border border-slate-600 hover:border-slate-400 text-sm font-semibold transition disabled:opacity-40">
                  Test connection
                </button>
                <button
                  ref={primaryRef}
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!canLeaveConnectStep || test.state === 'testing'}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-bold transition disabled:opacity-40"
                >
                  {test.state === 'error' ? 'Continue anyway' : 'Continue'} <ArrowRight className="w-4 h-4" />
                </button>
              </>
            )}

            {step === 2 && (
              <button ref={primaryRef} type="button" onClick={finish} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-bold transition disabled:opacity-60">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <>Finish setup <CheckCircle2 className="w-4 h-4" /></>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
