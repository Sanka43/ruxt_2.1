import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Sparkles, 
  X, 
  Upload, 
  Download, 
  CheckCircle2, 
  Shield, 
  Layers, 
  Code, 
  Tag, 
  FolderPlus, 
  FileText,
  AlertCircle,
  Plus,
  Trash2,
  Wand2,
  Monitor,
  Eye,
  RefreshCw
} from 'lucide-react';

const UI_TEMPLATES = {
  console: {
    name: 'SQL / API Console',
    title: 'Interactive Query & API Console',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Query Console</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0b0f19; color: #e2e8f0; margin: 0; padding: 24px; }
    h2 { margin-top: 0; color: #818cf8; font-size: 1.2rem; }
    .card { background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
    textarea { width: 100%; box-sizing: border-box; background: #030712; border: 1px solid #374151; color: #38bdf8; font-family: monospace; padding: 12px; border-radius: 8px; font-size: 13px; resize: vertical; }
    button { background: #4f46e5; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.2s; }
    button:hover { background: #4338ca; }
    .output { margin-top: 16px; background: #030712; border: 1px solid #1f2937; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 12px; color: #a5f3fc; min-height: 80px; white-space: pre-wrap; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 9999px; background: #1e1b4b; color: #a5b4fc; font-size: 11px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Live Agent Interface</span>
    <h2>Backend & Query Sandbox</h2>
    <p style="font-size: 12px; color: #94a3b8; margin-bottom: 12px;">Execute live mock SQL queries or test REST endpoints in real time.</p>
    <textarea id="queryInput" rows="4">SELECT id, username, email, created_at 
FROM users 
WHERE status = 'active' 
ORDER BY created_at DESC 
LIMIT 10;</textarea>
    <div style="margin-top: 12px;">
      <button onclick="runQuery()">Execute Query</button>
    </div>
  </div>
  <div class="card">
    <h3 style="font-size: 13px; margin: 0 0 8px 0; color: #94a3b8;">Execution Output & Plan</h3>
    <div id="output" class="output">Ready. Click 'Execute Query' to inspect simulated latency and execution tree.</div>
  </div>
  <script>
    function runQuery() {
      const q = document.getElementById('queryInput').value;
      const out = document.getElementById('output');
      out.textContent = "Executing query...\\nPlanning Time: 0.082 ms\\nExecution Time: 0.412 ms\\n\\nResult: 4 rows returned successfully.\\n[OK] Index Scan on users_status_idx";
    }
  </script>
</body>
</html>`
  },
  metrics: {
    name: 'Metrics Dashboard',
    title: 'Performance & Health Metrics',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>System Metrics</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0b0f19; color: #e2e8f0; margin: 0; padding: 20px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 20px; }
    .stat-card { background: #111827; border: 1px solid #1f2937; border-radius: 14px; padding: 18px; }
    .stat-title { font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.5px; }
    .stat-val { font-size: 28px; font-weight: 800; color: #fff; margin: 8px 0 4px 0; }
    .stat-sub { font-size: 11px; color: #10b981; font-weight: 600; }
    .panel { background: #111827; border: 1px solid #1f2937; border-radius: 14px; padding: 20px; }
    .bar-wrap { background: #1f2937; height: 10px; border-radius: 5px; overflow: hidden; margin-top: 8px; }
    .bar-fill { background: linear-gradient(90deg, #6366f1, #a855f7); height: 100%; width: 78%; }
  </style>
</head>
<body>
  <h2 style="color: #c7d2fe; margin-top: 0; font-size: 1.25rem;">Live System Vitals</h2>
  <div class="grid">
    <div class="stat-card">
      <div class="stat-title">Query Throughput</div>
      <div class="stat-val">4.2k <span style="font-size: 14px; color: #94a3b8;">qps</span></div>
      <div class="stat-sub">+12% from peak</div>
    </div>
    <div class="stat-card">
      <div class="stat-title">P99 Latency</div>
      <div class="stat-val">18 <span style="font-size: 14px; color: #94a3b8;">ms</span></div>
      <div class="stat-sub">Nominal</div>
    </div>
    <div class="stat-card">
      <div class="stat-title">Cache Hit Rate</div>
      <div class="stat-val">96.4%</div>
      <div class="stat-sub">Redis Cluster</div>
    </div>
  </div>
  <div class="panel">
    <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600;">
      <span>Connection Pool Capacity</span>
      <span>78 / 100 active</span>
    </div>
    <div class="bar-wrap">
      <div class="bar-fill"></div>
    </div>
  </div>
</body>
</html>`
  },
  blank: {
    name: 'Blank Canvas',
    title: 'Custom Agent Interface',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Agent Interface</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0b0f19; color: #e2e8f0; margin: 0; padding: 24px; text-align: center; }
    .container { max-width: 600px; margin: 40px auto; background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 32px; }
    h1 { color: #818cf8; font-size: 24px; margin-bottom: 8px; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.5; }
    button { background: #4f46e5; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; }
    button:hover { background: #4338ca; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Custom Agent UI</h1>
    <p>This is your agent's interactive web interface. You can add HTML, CSS, buttons, visualizations, or forms here.</p>
    <button onclick="alert('Hello from Agent UI!')">Click Me</button>
  </div>
</body>
</html>`
  }
};

const PRESET_AVATARS = [
  { id: 'julian', name: 'Julian (Dev)', url: '/agent-avatars/julian-vance.png' },
  { id: 'maya', name: 'Maya (CMS/Fullstack)', url: '/agent-avatars/maya-brooks.png' },
  { id: 'noah', name: 'Noah (Finance/Tax)', url: '/agent-avatars/noah-reed.png' },
  { id: 'elena', name: 'Elena (Strategy/Coach)', url: '/agent-avatars/elena-voss.png' },
  { id: 'marcus', name: 'Marcus (Architect)', url: '/agent-avatars/marcus-sterling.png' },
  { id: 'ruxt', name: 'RuXt (Core)', url: '/agent-avatars/ruxt.png' }
];

const TEMPLATES = [
  {
    name: 'Senior Fullstack Engineer',
    role: 'Senior Fullstack Web Developer',
    headline: 'Fullstack Next.js, Node.js, TypeScript & Database Architect',
    category: 'Engineering',
    bio: 'Experienced fullstack engineer focused on clean architecture, resilient APIs, and high-performance React frontends.',
    skills: ['React', 'Node.js', 'TypeScript', 'Next.js', 'PostgreSQL', 'Tailwind CSS'],
    permissions: ['filesystem:read', 'filesystem:write', 'terminal:exec'],
    persona: `# Senior Fullstack Engineer\n\nYou are a high-level fullstack engineer with deep expertise in modern TypeScript, React, Node.js, and relational database systems.\n\n## Core Principles\n- Write modular, readable, self-documenting code.\n- Emphasize testability, error handling, and performance optimization.\n- Provide clear step-by-step reasoning before providing code blocks.`
  },
  {
    name: 'Growth & SEO Strategist',
    role: 'SEO & Organic Growth Director',
    headline: 'Technical SEO, Keyword Clustering & Content Marketing Strategist',
    category: 'Marketing & SEO',
    bio: 'Specialist in organic search algorithms, topical authority maps, schema markups, and viral conversion funnels.',
    skills: ['SEO Auditing', 'Keyword Research', 'Content Strategy', 'Schema Markup', 'Conversion Optimization'],
    permissions: ['network:http'],
    persona: `# SEO & Growth Director\n\nYou are an analytical Growth and SEO Strategist focused on data-driven organic acquisition and search authority.\n\n## Core Principles\n- Deliver actionable keyword research and content clustering.\n- Prioritize user intent, technical site health, and high conversion copy.\n- Include structured recommendations with estimated search impacts.`
  },
  {
    name: 'Executive Business & Legal Advisor',
    role: 'Corporate Counsel & Deal Strategist',
    headline: 'Contract Review, Compliance, Term Sheets & Risk Assessment',
    category: 'Finance & Compliance',
    bio: 'Pragmatic commercial advisor who reviews agreements, pinpoints liability pitfalls, and structures founder-friendly deals.',
    skills: ['Contract Review', 'Risk Assessment', 'Term Sheets', 'Corporate Governance', 'Compliance'],
    permissions: ['filesystem:read'],
    persona: `# Executive Corporate Counsel\n\nYou are an experienced commercial advisor providing pragmatic legal risk analysis, contract reviews, and transaction structuring advice.\n\n## Core Principles\n- Identify hidden liabilities, ambiguous terms, and unfavorable indemnity clauses.\n- Suggest precise replacement language with explanations.\n- Always highlight practical commercial trade-offs.`
  }
];

export default function AgentStudioModal({
  isOpen,
  onClose,
  onAgentCreated,
  showNotification,
  agentToEdit = null
}) {
  const isEditMode = Boolean(agentToEdit);
  const [activeStep, setActiveStep] = useState('identity'); // 'identity' | 'persona' | 'skills' | 'permissions' | 'ui'
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [role, setRole] = useState('');
  const [headline, setHeadline] = useState('');
  const [category, setCategory] = useState('Engineering');
  const [bio, setBio] = useState('');
  const [persona, setPersona] = useState('');
  const [skills, setSkills] = useState(['Problem Solving', 'Task Execution']);
  const [newSkillInput, setNewSkillInput] = useState('');
  const [permissions, setPermissions] = useState(['filesystem:read']);
  const [hasCustomUi, setHasCustomUi] = useState(false);
  const [uiTitle, setUiTitle] = useState('');
  const [customUiHtml, setCustomUiHtml] = useState(UI_TEMPLATES.console.html);
  const [uiTemplateKey, setUiTemplateKey] = useState('console');
  const [showUiPreview, setShowUiPreview] = useState(false);
  const [selectedAvatarPreset, setSelectedAvatarPreset] = useState('/agent-avatars/julian-vance.png');
  const [existingAvatar, setExistingAvatar] = useState(null);
  const [customAvatarBase64, setCustomAvatarBase64] = useState(null);
  const avatarFileInputRef = useRef(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    const editSlug = agentToEdit?.slug || (typeof agentToEdit === 'string' ? agentToEdit : null);
    if (isOpen && editSlug) {
      setIsLoadingDetails(true);
      fetch(`/api/marketplace/agent-details/${editSlug}`)
        .then(r => r.json())
        .then(data => {
          if (data?.success && data.agent) {
            const a = data.agent;
            setName(a.name || '');
            setSlug(a.slug || '');
            setRole(a.role || '');
            setHeadline(a.headline || '');
            setCategory(a.category || 'Engineering');
            setBio(a.bio || '');
            setPersona(a.persona || '');
            setSkills(Array.isArray(a.skills) && a.skills.length > 0 ? a.skills : ['Problem Solving']);
            setPermissions(Array.isArray(a.permissions) ? a.permissions : ['filesystem:read']);
            setHasCustomUi(Boolean(a.hasCustomUi));
            setUiTitle(a.uiTitle || '');
            if (a.customUiHtml) setCustomUiHtml(a.customUiHtml);
            if (a.avatar) {
              setExistingAvatar(a.avatar);
              setSelectedAvatarPreset(a.avatar);
            }
          }
        })
        .catch(err => {
          console.error('Failed to load agent details for editing:', err);
        })
        .finally(() => {
          setIsLoadingDetails(false);
        });
    } else if (isOpen && !agentToEdit) {
      setName('');
      setSlug('');
      setRole('');
      setHeadline('');
      setCategory('Engineering');
      setBio('');
      setPersona('');
      setSkills(['Problem Solving', 'Task Execution']);
      setPermissions(['filesystem:read']);
      setHasCustomUi(false);
      setUiTitle('');
      setCustomUiHtml(UI_TEMPLATES.console.html);
      setExistingAvatar(null);
      setSelectedAvatarPreset('/agent-avatars/julian-vance.png');
      setCustomAvatarBase64(null);
    }
  }, [isOpen, agentToEdit]);

  if (!isOpen) return null;

  const handleNameChange = (val) => {
    setName(val);
    if (!slug || slug === name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, ''));
    }
  };

  const handleApplyTemplate = (tmpl) => {
    setName(tmpl.name);
    setSlug(tmpl.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-'));
    setRole(tmpl.role);
    setHeadline(tmpl.headline);
    setCategory(tmpl.category);
    setBio(tmpl.bio);
    setSkills(tmpl.skills);
    setPermissions(tmpl.permissions);
    setPersona(tmpl.persona);
  };

  const handleAddSkill = () => {
    if (!newSkillInput.trim()) return;
    if (!skills.includes(newSkillInput.trim())) {
      setSkills([...skills, newSkillInput.trim()]);
    }
    setNewSkillInput('');
  };

  const handleRemoveSkill = (skillToRemove) => {
    setSkills(skills.filter(s => s !== skillToRemove));
  };

  const togglePermission = (perm) => {
    if (permissions.includes(perm)) {
      setPermissions(permissions.filter(p => p !== perm));
    } else {
      setPermissions([...permissions, perm]);
    }
  };

  const handleAvatarFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showNotification?.('Please choose an image file (PNG, JPG, WebP, etc.)', 'error');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      showNotification?.('Image size must be less than 20MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (!dataUrl) return;

      const img = new Image();
      img.onload = () => {
        try {
          // Normalize and resize to a crisp 256x256 square PNG avatar
          const canvas = document.createElement('canvas');
          const size = 256;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');

          // Center-crop to square
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;

          ctx.clearRect(0, 0, size, size);
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

          const optimizedPng = canvas.toDataURL('image/png', 0.95);
          setCustomAvatarBase64(optimizedPng);
          setSelectedAvatarPreset(null);
          showNotification?.('Profile image loaded successfully!', 'success');
        } catch (err) {
          setCustomAvatarBase64(dataUrl);
          setSelectedAvatarPreset(null);
          showNotification?.('Profile image loaded!', 'success');
        }
      };
      img.onerror = () => {
        setCustomAvatarBase64(dataUrl);
        setSelectedAvatarPreset(null);
        showNotification?.('Profile image loaded!', 'success');
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      showNotification?.('Failed to read image file', 'error');
    };
    reader.readAsDataURL(file);

    // Reset value so user can re-select even if it has the same filename
    e.target.value = '';
  };

  const handleBuildAndExport = async (shouldDownload = false) => {
    if (!name.trim()) {
      showNotification?.('Please enter an agent name', 'error');
      return;
    }

    setIsBuilding(true);
    try {
      const endpoint = isEditMode ? '/api/marketplace/update-agent' : '/api/marketplace/build-agent';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          role: role.trim() || 'AI Specialist',
          headline: headline.trim() || role.trim() || 'Specialist',
          category,
          bio: bio.trim(),
          persona: persona.trim(),
          skills,
          permissions,
          avatarPreset: selectedAvatarPreset,
          avatarBase64: customAvatarBase64,
          hasCustomUi,
          uiTitle: uiTitle.trim() || `${name.trim()} Interface`,
          customUiHtml: hasCustomUi ? customUiHtml : null
        })
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (_) {
        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}. If running 'npm run dev', please restart the terminal server.`);
        }
        throw new Error('Unexpected response format from server');
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create agent');
      }

      showNotification?.(`✓ ${data.message || 'Agent created successfully!'}`, 'success');
      
      if (shouldDownload && data.agent?.downloadUrl) {
        const link = document.createElement('a');
        link.href = data.agent.downloadUrl;
        link.setAttribute('download', `${data.agent.slug || 'agent'}.ruxt`);
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          try { document.body.removeChild(link); } catch (_) {}
        }, 200);
      }

      onAgentCreated?.(data.agent);
      onClose();
    } catch (err) {
      console.error('Error creating agent:', err);
      showNotification?.(`✕ ${err.message}`, 'error');
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-indigo-500/30 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-gradient-to-r dark:from-indigo-950/60 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shadow-xs overflow-hidden relative shrink-0 ${
              isEditMode 
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-500 dark:text-amber-400' 
                : 'bg-indigo-50 dark:bg-indigo-600/20 border-indigo-200 dark:border-indigo-500/40 text-indigo-600 dark:text-indigo-400'
            }`}>
              {(customAvatarBase64 || selectedAvatarPreset) ? (
                <img
                  src={customAvatarBase64 || selectedAvatarPreset}
                  alt="Agent Avatar"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : isEditMode ? (
                <Sparkles className="w-5 h-5 text-amber-500 dark:text-amber-400" />
              ) : (
                <Bot className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {isEditMode ? `Skill Up Specialist · ${name || slug}` : 'RuXt Agent Studio'}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                  isEditMode
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 animate-pulse'
                    : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                }`}>
                  {isEditMode ? '⚡ Skill Up Mode' : 'Builder & Exporter'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEditMode 
                  ? 'Upgrade skills, refine system instructions, and enhance interactive capabilities' 
                  : 'Design, customize, and package AI agents to share with any user'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Templates Banner (Only in Create Mode) */}
        {!isEditMode && (
          <div className="px-6 py-3 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1 shrink-0">
              <Wand2 className="w-3.5 h-3.5 text-pink-500 dark:text-pink-400" />
              Quick Presets:
            </span>
            {TEMPLATES.map(tmpl => (
              <button
                key={tmpl.name}
                type="button"
                onClick={() => handleApplyTemplate(tmpl)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-600/30 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-white border border-slate-200 dark:border-slate-700/60 transition text-[11px] whitespace-nowrap"
              >
                {tmpl.name}
              </button>
            ))}
          </div>
        )}

        {/* Step Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 px-6 pt-2 gap-4 overflow-x-auto">
          {[
            { id: 'identity', label: '1. Identity & Avatar', icon: Bot },
            { id: 'persona', label: '2. Persona & Prompt', icon: FileText },
            { id: 'skills', label: '3. Skills & Capabilities', icon: Layers },
            { id: 'permissions', label: '4. Permissions', icon: Shield },
            { id: 'ui', label: '5. Interactive UI', icon: Monitor }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeStep === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveStep(tab.id)}
                className={`flex items-center gap-2 pb-2.5 text-xs font-semibold transition border-b-2 ${
                  isActive 
                    ? 'border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-400' 
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeStep === 'identity' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Agent Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Leo Vance"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Identifier Slug {isEditMode && <span className="text-[10px] text-amber-400 font-normal">(Locked in Edit Mode)</span>}
                  </label>
                  <input
                    type="text"
                    value={slug}
                    disabled={isEditMode}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="e.g. leo-vance"
                    className={`w-full rounded-xl px-3.5 py-2 text-xs transition border ${
                      isEditMode
                        ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Job Role / Title *</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Senior Frontend Web Developer"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Marketing & SEO">Marketing & SEO</option>
                    <option value="Finance & Compliance">Finance & Compliance</option>
                    <option value="Leadership & Orchestration">Leadership & Orchestration</option>
                    <option value="Strategy & Gaming">Strategy & Gaming</option>
                    <option value="Productivity & Automation">Productivity & Automation</option>
                    <option value="Custom & Community">Custom & Community</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Headline / Tagline</label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Specialist in React, Next.js, Tailwind CSS & WCAG Accessibility"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Short Bio</label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell users what makes this agent unique..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              {/* Avatar Chooser */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-300">Agent Avatar</label>
                  <span className="text-[11px] text-slate-400">Select a preset or upload your own PNG/JPG</span>
                </div>

                {/* Hidden Native File Input */}
                <input
                  ref={avatarFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
                  onChange={handleAvatarFileUpload}
                  style={{ display: 'none' }}
                />

                <div className="flex flex-wrap items-center gap-3">
                  {/* Current existing custom avatar if editing an agent */}
                  {existingAvatar && !PRESET_AVATARS.some(p => p.url === existingAvatar) && (
                    <button
                      key="existing-avatar"
                      type="button"
                      onClick={() => {
                        setSelectedAvatarPreset(existingAvatar);
                        setCustomAvatarBase64(null);
                      }}
                      className={`relative rounded-2xl p-1 transition border-2 ${
                        !customAvatarBase64 && selectedAvatarPreset === existingAvatar
                          ? 'border-indigo-500 bg-indigo-500/20 shadow-md shadow-indigo-500/20' 
                          : 'border-slate-800 hover:border-slate-700 bg-slate-950'
                      }`}
                      title="Agent's current avatar"
                    >
                      <img
                        src={existingAvatar}
                        alt="Current Avatar"
                        className="w-12 h-12 rounded-xl object-cover"
                      />
                      <span className="absolute -bottom-1 -right-1 bg-slate-900 border border-slate-700 text-indigo-400 text-[9px] px-1 rounded-md font-mono">
                        Current
                      </span>
                    </button>
                  )}

                  {/* Preset Avatars */}
                  {PRESET_AVATARS.map(avatar => (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => {
                        setSelectedAvatarPreset(avatar.url);
                        setCustomAvatarBase64(null);
                      }}
                      className={`relative rounded-2xl p-1 transition border-2 ${
                        !customAvatarBase64 && selectedAvatarPreset === avatar.url 
                          ? 'border-indigo-500 bg-indigo-500/20 shadow-md shadow-indigo-500/20' 
                          : 'border-slate-800 hover:border-slate-700 bg-slate-950'
                      }`}
                      title={avatar.name}
                    >
                      <img
                        src={avatar.url}
                        alt={avatar.name}
                        className="w-12 h-12 rounded-xl object-cover"
                      />
                    </button>
                  ))}

                  {/* Explicit Upload Button */}
                  <button
                    type="button"
                    onClick={() => avatarFileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-2 flex flex-col items-center justify-center w-28 h-14 transition group cursor-pointer ${
                      customAvatarBase64
                        ? 'border-emerald-500/60 bg-emerald-950/20 text-emerald-400'
                        : 'border-slate-700 hover:border-indigo-500 bg-slate-950/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Upload className="w-4 h-4 mb-0.5 group-hover:scale-110 transition text-indigo-400" />
                    <span className="text-[10px] font-medium">
                      {customAvatarBase64 ? 'Change Photo' : 'Upload PNG'}
                    </span>
                  </button>

                  {/* Custom Uploaded Avatar Badge */}
                  {customAvatarBase64 && (
                    <div className="relative border-2 border-emerald-500 rounded-2xl p-1 bg-emerald-500/20 shadow-md shadow-emerald-500/20">
                      <img
                        src={customAvatarBase64}
                        alt="Custom Avatar Preview"
                        className="w-12 h-12 rounded-xl object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCustomAvatarBase64(null);
                          setSelectedAvatarPreset(existingAvatar || '/agent-avatars/julian-vance.png');
                        }}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow transition"
                        title="Remove uploaded image"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeStep === 'persona' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300">
                  Agent Persona & System Instructions (<code className="text-indigo-400">agent.md</code>)
                </label>
                <span className="text-[11px] text-slate-500">Supports Markdown formatting</span>
              </div>
              <textarea
                rows={12}
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                placeholder="# System Persona Instructions&#10;&#10;You are an expert specialist... Explain how you approach tasks, what tools you expect to use, your style of response, and boundaries."
                className="w-full font-mono bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition leading-relaxed"
              />
            </div>
          )}

          {activeStep === 'skills' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Add Specialist Skills</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSkillInput}
                    onChange={(e) => setNewSkillInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSkill(); }}}
                    placeholder="e.g. Docker Containerization, Tailwind CSS, Financial Modeling..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Skill
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Configured Skills ({skills.length})</label>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 shadow-sm"
                    >
                      <Tag className="w-3 h-3 text-indigo-400" />
                      {skill}
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="text-slate-500 hover:text-rose-400 transition ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeStep === 'permissions' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-white mb-1">Safety & Execution Permissions</h4>
                <p className="text-xs text-slate-400 mb-3">
                  Specify what capabilities this agent requires. Users will be notified of these permissions upon installing the agent.
                </p>
              </div>

              <div className="space-y-2.5">
                {[
                  {
                    id: 'filesystem:read',
                    title: 'Read Workspace Files',
                    desc: 'Allows the agent to inspect project directories and codebases'
                  },
                  {
                    id: 'filesystem:write',
                    title: 'Modify & Create Files',
                    desc: 'Allows the agent to write code patches and generate project deliverables'
                  },
                  {
                    id: 'terminal:exec',
                    title: 'Execute Shell & Terminal Commands',
                    desc: 'Allows running builds, test suites, and git operations'
                  },
                  {
                    id: 'network:http',
                    title: 'Network & API Calls',
                    desc: 'Allows fetching external web references and querying public REST endpoints'
                  },
                  {
                    id: 'desktop:control',
                    title: 'Desktop Computer Use (Live Operator)',
                    desc: 'Allows GUI control via mouse movements and screen captures'
                  }
                ].map(perm => {
                  const isChecked = permissions.includes(perm.id);
                  return (
                    <div
                      key={perm.id}
                      onClick={() => togglePermission(perm.id)}
                      className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                        isChecked 
                          ? 'border-indigo-500/40 bg-indigo-950/20' 
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          {perm.title}
                          <code className="text-[10px] text-slate-500 font-normal">({perm.id})</code>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{perm.desc}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeStep === 'ui' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-white mb-1">Custom Interactive Web UI</h4>
                <p className="text-xs text-slate-400 mb-3">
                  Optionally bundle an interactive web interface (like Elena Voss's chessboard or an API console) inside <code className="text-indigo-400">ui/index.html</code> that users can open while working with this agent.
                </p>
              </div>

              {/* Enable Toggle */}
              <div 
                onClick={() => setHasCustomUi(!hasCustomUi)}
                className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                  hasCustomUi 
                    ? 'border-indigo-500 bg-indigo-950/20 shadow-md' 
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${hasCustomUi ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    <Monitor className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Enable Interactive UI for this Agent</div>
                    <div className="text-[11px] text-slate-400">Packages a dedicated web app rendered in RuXt alongside chat</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={hasCustomUi}
                  onChange={() => {}}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              {hasCustomUi && (
                <div className="space-y-4 pt-2 animate-in fade-in duration-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">UI Window Title</label>
                    <input
                      type="text"
                      value={uiTitle}
                      onChange={(e) => setUiTitle(e.target.value)}
                      placeholder="e.g. API & Query Sandbox"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  {/* UI Starter Templates */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Starter Templates</label>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(UI_TEMPLATES).map(([key, t]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setUiTemplateKey(key);
                            setCustomUiHtml(t.html);
                            if (!uiTitle) setUiTitle(t.title);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                            uiTemplateKey === key
                              ? 'bg-indigo-600 text-white border-indigo-500'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* HTML Code Editor & Live Preview */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                        Interface Code (<code className="text-indigo-400">ui/index.html</code>)
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowUiPreview(!showUiPreview)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1.5 transition"
                      >
                        <Eye className="w-3 h-3 text-indigo-400" />
                        {showUiPreview ? 'Hide Preview' : 'Show Live Preview'}
                      </button>
                    </div>

                    {showUiPreview ? (
                      <div className="rounded-xl overflow-hidden border border-indigo-500/40 bg-slate-950 p-1">
                        <iframe
                          srcDoc={customUiHtml}
                          title="UI Preview"
                          className="w-full h-64 border-0 rounded-lg bg-slate-950"
                        />
                      </div>
                    ) : (
                      <textarea
                        rows={10}
                        value={customUiHtml}
                        onChange={(e) => setCustomUiHtml(e.target.value)}
                        placeholder="<!DOCTYPE html><html>...</html>"
                        className="w-full font-mono bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-indigo-200 focus:outline-none focus:border-indigo-500 transition leading-relaxed"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeStep !== 'identity' && (
              <button
                type="button"
                onClick={() => {
                  const steps = ['identity', 'persona', 'skills', 'permissions', 'ui'];
                  const idx = steps.indexOf(activeStep);
                  if (idx > 0) setActiveStep(steps[idx - 1]);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition"
              >
                Back
              </button>
            )}
            {activeStep !== 'ui' && (
              <button
                type="button"
                onClick={() => {
                  const steps = ['identity', 'persona', 'skills', 'permissions', 'ui'];
                  const idx = steps.indexOf(activeStep);
                  if (idx < steps.length - 1) setActiveStep(steps[idx + 1]);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition"
              >
                Next Step
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={isBuilding || isLoadingDetails}
              onClick={() => handleBuildAndExport(true)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition flex items-center gap-1.5 border border-slate-700/80 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              {isEditMode ? 'Download Updated .ruxt' : 'Build & Download .ruxt'}
            </button>

            <button
              type="button"
              disabled={isBuilding || isLoadingDetails}
              onClick={() => handleBuildAndExport(false)}
              className={`px-4 py-2 rounded-xl text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-md disabled:opacity-50 ${
                isEditMode
                  ? 'bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 shadow-amber-600/30'
                  : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-indigo-600/30'
              }`}
            >
              {isEditMode ? <Sparkles className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {isBuilding 
                ? (isEditMode ? 'Saving Changes...' : 'Creating Agent...') 
                : (isEditMode ? 'Save & Skill Up Agent' : 'Deploy to RuXt')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
