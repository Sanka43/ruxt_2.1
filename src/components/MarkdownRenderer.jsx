import React, { useMemo } from 'react';
import { marked } from 'marked';

// Configure marked with GFM and custom code block styling
marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    code({ text, lang }) {
      const language = (lang || 'code').toLowerCase();
      const encoded = encodeURIComponent(text);
      return `
        <div class="my-3.5 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-md">
          <div class="flex items-center justify-between px-3.5 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[11px] font-mono text-slate-400">
            <span class="font-bold text-indigo-400 uppercase tracking-wider text-[10px]">${language}</span>
            <button type="button" data-copy-code="${encoded}" class="px-2 py-0.5 rounded text-[10px] font-sans font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer">
              Copy Code
            </button>
          </div>
          <pre class="p-3.5 overflow-x-auto text-[12px] font-mono text-emerald-300/90 leading-relaxed font-normal"><code>${text}</code></pre>
        </div>
      `;
    }
  }
});

export default function MarkdownRenderer({ content, className = '' }) {
  const htmlContent = useMemo(() => {
    if (!content) return '';
    try {
      return marked.parse(content);
    } catch (err) {
      console.error('Error parsing markdown:', err);
      return String(content);
    }
  }, [content]);

  const handleContainerClick = (e) => {
    const copyBtn = e.target.closest('[data-copy-code]');
    if (copyBtn) {
      e.stopPropagation();
      const code = copyBtn.getAttribute('data-copy-code');
      if (code) {
        navigator.clipboard.writeText(decodeURIComponent(code));
        const prevText = copyBtn.innerText;
        copyBtn.innerText = 'Copied!';
        copyBtn.classList.add('text-emerald-400', 'bg-emerald-950/60');
        setTimeout(() => {
          copyBtn.innerText = prevText;
          copyBtn.classList.remove('text-emerald-400', 'bg-emerald-950/60');
        }, 2000);
      }
    }
  };

  return (
    <div
      onClick={handleContainerClick}
      className={`ruxt-markdown select-text leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}
