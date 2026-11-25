import React from 'react';

// 1. Google Gemini (Official 4-point gradient star)
export function GeminiLogo({ className = "w-10 h-10", variant = "full" }) {
  const svg = (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="gemini-star-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1BA1E3" />
          <stop offset="35%" stopColor="#5B7BF5" />
          <stop offset="70%" stopColor="#9B59B6" />
          <stop offset="100%" stopColor="#D946EF" />
        </linearGradient>
      </defs>
      <path
        d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 12 6.627 12 0Z"
        fill="url(#gemini-star-grad)"
      />
    </svg>
  );
  if (variant === "symbol") return svg;
  return (
    <div className={`rounded-2xl bg-gradient-to-br from-[#121b36] to-[#0c1020] flex items-center justify-center p-2 border border-indigo-500/30 shadow-[0_0_15px_rgba(91,123,245,0.2)] shrink-0 ${className}`}>
      {svg}
    </div>
  );
}

// 2. Google Antigravity (Official White Squircle with AG Silhouette)
export function AntigravityLogo({ className = "w-10 h-10", variant = "full" }) {
  const svg = (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M50 15 C30 15 18 40 18 70 C24 60 34 50 50 50 C66 50 76 60 82 70 C82 40 70 15 50 15 Z" fill="#0f172a" />
      <path d="M50 55 C38 55 30 65 24 75 C32 82 42 85 50 85 C58 85 68 82 76 75 C70 65 62 55 50 55 Z" fill="#0f172a" />
    </svg>
  );
  if (variant === "symbol") return svg;
  return (
    <div className={`rounded-2xl bg-white flex items-center justify-center p-1.5 shadow-sm border border-slate-200/80 shrink-0 ${className}`}>
      {svg}
    </div>
  );
}

// 3. Anthropic Claude (Official Terracotta Sunburst Ray Logo)
export function ClaudeLogo({ className = "w-10 h-10", variant = "full" }) {
  const svg = (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-[#D97757]">
      <path d="M13.8 2.2c-.4-.7-1.4-.7-1.8 0l-1.3 2.5c-.3.5-.8.8-1.4.7L6.6 4.9c-.8-.1-1.5.5-1.4 1.3l.3 2.8c.1.6-.2 1.2-.7 1.5L2.4 12c-.7.4-.7 1.4 0 1.8l2.4 1.5c.5.3.8.9.7 1.5l-.3 2.8c-.1.8.6 1.4 1.4 1.3l2.7-.5c.6-.1 1.1.2 1.4.7l1.3 2.5c.4.7 1.4.7 1.8 0l1.3-2.5c.3-.5.8-.8 1.4-.7l2.7.5c.8.1 1.5-.5 1.4-1.3l-.3-2.8c-.1-.6.2-1.2.7-1.5l2.4-1.5c.7-.4.7-1.4 0-1.8l-2.4-1.5c-.5-.3-.8-.9-.7-1.5l.3-2.8c.1-.8-.6-1.4-1.4-1.3l-2.7.5c-.6.1-1.1-.2-1.4-.7L13.8 2.2z" />
    </svg>
  );
  if (variant === "symbol") return svg;
  return (
    <div className={`rounded-2xl bg-[#1e1514] flex items-center justify-center p-2.5 border border-[#D97757]/30 shadow-[0_0_15px_rgba(217,119,87,0.2)] shrink-0 ${className}`}>
      {svg}
    </div>
  );
}

// 4. OpenAI / ChatGPT / Codex (Official Rosette Knot Vortex)
export function OpenAILogo({ className = "w-10 h-10", variant = "full" }) {
  const svg = (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-white">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 8.784a4.472 4.472 0 0 1 2.36-1.973V12.7a.79.79 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 8.784zm16.597 3.855l-5.833-3.387L15.119 8.1a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.674 8.1v-5.682a.79.79 0 0 0-.409-.67zm2.01-4.15l-.14-.082-4.79-2.766a.79.79 0 0 0-.786 0L9.308 9.01V6.678a.08.08 0 0 1 .033-.062L14.25 3.84a4.499 4.499 0 0 1 6.69 4.65zm-8.86 4.218l-2.3-1.328 2.3-1.328 2.3 1.328z"/>
    </svg>
  );
  if (variant === "symbol") return svg;
  return (
    <div className={`rounded-2xl bg-[#10a37f] flex items-center justify-center p-2.5 shadow-[0_0_15px_rgba(16,163,127,0.3)] border border-emerald-400/40 shrink-0 ${className}`}>
      {svg}
    </div>
  );
}

// 5. Cursor AI (Official 3D Isometric Cube)
export function CursorLogo({ className = "w-10 h-10", variant = "full" }) {
  const svg = (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Top Face */}
      <path d="M12 2.5L21 7.7L12 12.9L3 7.7L12 2.5Z" fill="#FFFFFF" />
      {/* Left Face */}
      <path d="M3 7.7L12 12.9V21.5L3 16.3V7.7Z" fill="#A1A1AA" />
      {/* Right Face */}
      <path d="M12 12.9L21 7.7V16.3L12 21.5V12.9Z" fill="#3F3F46" />
      {/* Accent perspective lines */}
      <path d="M12 2.5V12.9M3 7.7L12 12.9L21 7.7" stroke="#09090B" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  if (variant === "symbol") return svg;
  return (
    <div className={`rounded-2xl bg-black flex items-center justify-center p-2.5 border border-slate-700/80 shadow-[0_0_15px_rgba(255,255,255,0.08)] shrink-0 ${className}`}>
      {svg}
    </div>
  );
}

// 6. xAI / Grok (Official xAI Slash & Angled Chevron Mark)
export function GrokLogo({ className = "w-10 h-10", variant = "full" }) {
  const svg = (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-white">
      {/* Official xAI Grok geometric slash and intersecting angled stroke */}
      <path d="M3.5 21L14.2 3.8C14.6 3.2 15.3 2.8 16.1 2.8H20.5L9.8 20.2C9.4 20.8 8.7 21.2 7.9 21.2H3.5Z" fill="currentColor" />
      <path d="M14.5 12.8L19.8 21.2H15.2L11.5 15.3L14.5 12.8Z" fill="currentColor" fillOpacity="0.85" />
      <path d="M4.2 2.8H8.8L11.8 7.5L8.8 10L4.2 2.8Z" fill="currentColor" fillOpacity="0.85" />
    </svg>
  );
  if (variant === "symbol") return svg;
  return (
    <div className={`rounded-2xl bg-gradient-to-br from-[#121216] to-[#09090c] flex items-center justify-center p-2.5 border border-slate-700/80 shadow-[0_0_15px_rgba(255,255,255,0.05)] shrink-0 ${className}`}>
      {svg}
    </div>
  );
}

// 7. Kimi / Moonshot AI (Official Kimi Cobalt Waveform 'K')
export function KimiLogo({ className = "w-10 h-10", variant = "full" }) {
  const svg = (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M6.5 5H9V19H6.5V5Z" fill="white" />
      <path d="M9 12.5L14.8 5.5H17.8L11.5 12.5L18.2 19H15.2L9 13V12.5Z" fill="white" />
      <circle cx="17.2" cy="6.2" r="1.6" fill="#38BDF8" />
    </svg>
  );
  if (variant === "symbol") return svg;
  return (
    <div className={`rounded-2xl bg-gradient-to-br from-[#0066FF] to-[#0047BA] flex items-center justify-center p-2 border border-blue-400/40 shadow-[0_0_15px_rgba(0,102,255,0.3)] shrink-0 ${className}`}>
      {svg}
    </div>
  );
}

// 8. Droid (Factory / Factory.ai Official Cybernetic Droid)
export function DroidLogo({ className = "w-10 h-10", variant = "full" }) {
  const svg = (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="droid-visor-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#FBBF24" />
        </linearGradient>
      </defs>
      {/* Robot Head Frame */}
      <rect x="3.5" y="6" width="17" height="13.5" rx="3.5" fill="#18181B" stroke="#F59E0B" strokeWidth="1.8" />
      {/* Visor Screen */}
      <rect x="6.5" y="9.5" width="11" height="3.2" rx="1.6" fill="url(#droid-visor-grad)" />
      {/* Top Antenna */}
      <path d="M12 2V6" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="2" r="1.5" fill="#F59E0B" />
      {/* Cheeks / Sensor Ports */}
      <circle cx="7" cy="15.5" r="1.1" fill="#71717A" />
      <circle cx="17" cy="15.5" r="1.1" fill="#71717A" />
    </svg>
  );
  if (variant === "symbol") return svg;
  return (
    <div className={`rounded-2xl bg-[#14120e] flex items-center justify-center p-2 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.2)] shrink-0 ${className}`}>
      {svg}
    </div>
  );
}

// 9. GitHub Copilot (Official Jetpack Robot Face)
export function CopilotBrandLogo({ className = "w-10 h-10", variant = "full" }) {
  const svg = (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-white">
      <path d="M12 2c-4.97 0-9 2.92-9 6.52 0 1.95 1.18 3.71 3.08 4.88-.13.56-.47 1.7-1.08 2.6-.14.21-.02.49.23.53 1.63.26 3.4-.41 4.58-1.39.71.18 1.45.28 2.19.28 4.97 0 9-2.92 9-6.52S16.97 3 12 3zm-3.2 8.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm6.4 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
    </svg>
  );
  if (variant === "symbol") return svg;
  return (
    <div className={`rounded-2xl bg-gradient-to-br from-[#6e40c9] to-[#8957e5] flex items-center justify-center p-2.5 border border-purple-400/40 shadow-[0_0_15px_rgba(137,87,229,0.3)] shrink-0 ${className}`}>
      {svg}
    </div>
  );
}

// 10. Command Code / Cohere Command (Official Cohere Coral Cellular Emblem)
export function CommandCodeLogo({ className = "w-10 h-10", variant = "full" }) {
  const svg = (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Coral Red Shape */}
      <path d="M12 2C7.5 2 3.8 5.7 3.8 10.2C3.8 12.8 5 15.1 6.9 16.6C7.5 15.8 8.4 15.2 9.4 14.9C9 13.9 8.8 12.8 8.8 11.6C8.8 8.8 11.1 6.5 13.9 6.5C14.7 6.5 15.5 6.7 16.2 7.1C16.8 5.4 17.8 4 19.1 3C17.1 2.4 14.6 2 12 2Z" fill="#FF7759" />
      {/* Dark Forest Shape */}
      <path d="M19.8 7.3C18.3 8.3 17.3 10.1 17.3 12.1C17.3 15.6 20.1 18.4 23.6 18.4C23.7 18.4 23.9 18.4 24 18.4C23.8 15.1 22.2 12.1 19.8 10V7.3Z" fill="#39594C" />
      {/* Sandy Gold Shape */}
      <path d="M10.8 18.8C10.8 20.6 12.2 22 14 22C15.8 22 17.2 20.6 17.2 18.8C17.2 17 15.8 15.6 14 15.6C12.2 15.6 10.8 17 10.8 18.8Z" fill="#E5C378" />
    </svg>
  );
  if (variant === "symbol") return svg;
  return (
    <div className={`rounded-2xl bg-[#1a1715] flex items-center justify-center p-2.5 border border-orange-500/30 shadow-[0_0_15px_rgba(255,119,89,0.18)] shrink-0 ${className}`}>
      {svg}
    </div>
  );
}

// 11. Ollama (Official Llama Mascot Silhouette)
export function OllamaLogo({ className = "w-10 h-10", variant = "full" }) {
  const svg = (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-white">
      <path d="M9 3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v2.5a.5.5 0 0 0 .5.5H13a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v4.2c0 .4.2.8.6 1 1.2.6 1.9 1.8 1.9 3.2 0 1.9-1.6 3.5-3.5 3.5h-1a1 1 0 0 0-1 1v2.6a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-2.6a1 1 0 0 0-1-1H9a3.5 3.5 0 0 1-3.5-3.5c0-1.4.7-2.6 1.9-3.2.4-.2.6-.6.6-1V3zm2.5 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm4 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
    </svg>
  );
  if (variant === "symbol") return svg;
  return (
    <div className={`rounded-2xl bg-black flex items-center justify-center p-2.5 border border-slate-700/80 shadow-[0_0_15px_rgba(255,255,255,0.06)] shrink-0 ${className}`}>
      {svg}
    </div>
  );
}

// 12. DeepSeek (Official Leaping Whale Logo)
export function DeepSeekLogo({ className = "w-10 h-10", variant = "full" }) {
  const svg = (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M4 14C4 9.58 7.58 6 12 6C15.86 6 19.08 8.74 19.82 12.39C20.35 12.14 21.06 12.21 21.53 12.68C22.12 13.27 22.12 14.22 21.53 14.81L19.41 16.93C18.63 17.71 17.37 17.71 16.59 16.93C15.81 16.15 15.81 14.89 16.59 14.11L17.29 13.41C16.8 11.45 15.04 10 12.94 10C10.73 10 8.94 11.79 8.94 14C8.94 14.9 9.24 15.73 9.75 16.4L7.54 18.61C5.35 17.65 4 15.52 4 14Z" fill="#1E88E5" />
      <circle cx="11.5" cy="8.5" r="1" fill="#0D47A1" />
    </svg>
  );
  if (variant === "symbol") return svg;
  return (
    <div className={`rounded-2xl bg-gradient-to-br from-[#0b1c36] to-[#071324] flex items-center justify-center p-2.5 border border-sky-500/30 shadow-[0_0_15px_rgba(30,136,229,0.25)] shrink-0 ${className}`}>
      {svg}
    </div>
  );
}

// 13. Mistral AI (Official Stepped Orange 'M' Chevron)
export function MistralLogo({ className = "w-10 h-10", variant = "full" }) {
  const svg = (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect x="3" y="4" width="3.6" height="3.6" fill="#F97316" />
      <rect x="17.4" y="4" width="3.6" height="3.6" fill="#F97316" />
      <rect x="3" y="7.6" width="7.2" height="3.6" fill="#F97316" />
      <rect x="13.8" y="7.6" width="7.2" height="3.6" fill="#F97316" />
      <rect x="3" y="11.2" width="18" height="3.6" fill="#F97316" />
      <rect x="3" y="14.8" width="7.2" height="3.6" fill="#EA580C" />
      <rect x="13.8" y="14.8" width="7.2" height="3.6" fill="#EA580C" />
      <rect x="3" y="18.4" width="3.6" height="3.6" fill="#C2410C" />
      <rect x="17.4" y="18.4" width="3.6" height="3.6" fill="#C2410C" />
    </svg>
  );
  if (variant === "symbol") return svg;
  return (
    <div className={`rounded-2xl bg-[#1f1208] flex items-center justify-center p-2.5 border border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.2)] shrink-0 ${className}`}>
      {svg}
    </div>
  );
}

// 14. OpenRouter (Official Hexagonal Multi-Model Network Hub)
export function OpenRouterLogo({ className = "w-10 h-10", variant = "full" }) {
  const svg = (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" stroke="#6366F1" strokeWidth="1.8" />
      <circle cx="12" cy="7" r="2" fill="#818CF8" />
      <circle cx="7.5" cy="15" r="2" fill="#6366F1" />
      <circle cx="16.5" cy="15" r="2" fill="#4F46E5" />
      <path d="M12 7L7.5 15M12 7L16.5 15M7.5 15H16.5" stroke="#A5B4FC" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
  if (variant === "symbol") return svg;
  return (
    <div className={`rounded-2xl bg-indigo-950/60 flex items-center justify-center p-2.5 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)] shrink-0 ${className}`}>
      {svg}
    </div>
  );
}

// Universal Logo Resolver Helper
export function getProviderLogo(providerId, className = "w-10 h-10", variant = "full") {
  const id = String(providerId || '').toLowerCase();
  
  if (id === 'antigravity') {
    return <AntigravityLogo className={className} variant={variant} />;
  }
  if (id === 'gemini' || id === 'google') {
    return <GeminiLogo className={className} variant={variant} />;
  }
  if (id === 'claude' || id === 'anthropic') {
    return <ClaudeLogo className={className} variant={variant} />;
  }
  if (id === 'openai' || id === 'codex' || id === 'chatgpt') {
    return <OpenAILogo className={className} variant={variant} />;
  }
  if (id === 'cursor') {
    return <CursorLogo className={className} variant={variant} />;
  }
  if (id === 'grok' || id === 'xai') {
    return <GrokLogo className={className} variant={variant} />;
  }
  if (id === 'kimi' || id === 'moonshot') {
    return <KimiLogo className={className} variant={variant} />;
  }
  if (id === 'droid' || id === 'factory') {
    return <DroidLogo className={className} variant={variant} />;
  }
  if (id === 'copilot' || id === 'github') {
    return <CopilotBrandLogo className={className} variant={variant} />;
  }
  if (id === 'commandcode' || id === 'cohere' || id === 'command') {
    return <CommandCodeLogo className={className} variant={variant} />;
  }
  if (id === 'ollama') {
    return <OllamaLogo className={className} variant={variant} />;
  }
  if (id === 'deepseek') {
    return <DeepSeekLogo className={className} variant={variant} />;
  }
  if (id === 'mistral') {
    return <MistralLogo className={className} variant={variant} />;
  }
  if (id === 'openrouter') {
    return <OpenRouterLogo className={className} variant={variant} />;
  }

  // Fallback to Gemini Star
  return <GeminiLogo className={className} variant={variant} />;
}
