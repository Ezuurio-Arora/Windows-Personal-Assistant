import React, { useMemo, useState } from 'react';
import { marked } from 'marked';
import { Copy, Check } from 'lucide-react';

// Configure marked options
marked.setOptions({
  gfm: true,
  breaks: true
});

// Ensure all links open externally with secure attributes
marked.use({
  renderer: {
    link(arg1, title, text) {
      let href, linkTitle, linkText;
      if (typeof arg1 === 'object' && arg1 !== null) {
        href = arg1.href;
        linkTitle = arg1.title;
        linkText = arg1.text;
      } else {
        href = arg1;
        linkTitle = title;
        linkText = text;
      }
      const titleAttr = linkTitle ? ` title="${linkTitle}"` : '';
      return `<a href="${href}" target="_blank" rel="noopener noreferrer"${titleAttr}>${linkText}</a>`;
    }
  }
});

export function MarkdownContent({ content = '', isError = false }) {
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Parse markdown to HTML and split by code blocks for custom interactive code blocks
  const parts = useMemo(() => {
    if (!content) return [];

    // Split markdown by code fences ```[lang]\n[code]```
    const regex = /```([a-zA-Z0-9_\-\.]*)\n([\s\S]*?)```/g;
    const pieces = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      // Preceding text before code block
      if (match.index > lastIndex) {
        const textBefore = content.substring(lastIndex, match.index);
        pieces.push({
          type: 'html',
          content: marked.parse(textBefore)
        });
      }

      // Code block
      pieces.push({
        type: 'code',
        language: match[1] || 'text',
        code: match[2].trimEnd()
      });

      lastIndex = regex.lastIndex;
    }

    // Remaining text after last code block
    if (lastIndex < content.length) {
      const textAfter = content.substring(lastIndex);
      pieces.push({
        type: 'html',
        content: marked.parse(textAfter)
      });
    }

    return pieces;
  }, [content]);

  const handleCopyCode = async (codeText, index) => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const handleLinkClick = (e) => {
    const anchor = e.target.closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
      e.preventDefault();
      // Route through backend open-url to guarantee opening in native desktop Chrome
      fetch('/api/open-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: href })
      }).catch((err) => {
        console.warn('Backend open-url failed, falling back to window.open', err);
        window.open(href, '_blank', 'noopener,noreferrer');
      });
    }
  };

  if (isError) {
    return (
      <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs sm:text-sm font-mono leading-relaxed">
        {content}
      </div>
    );
  }

  return (
    <div 
      className="markdown-body space-y-3 text-gemini-text/95 leading-relaxed text-sm sm:text-base font-sans break-words"
      onClick={handleLinkClick}
    >
      {parts.map((part, idx) => {
        if (part.type === 'code') {
          const isCopied = copiedIndex === idx;
          return (
            <div
              key={idx}
              className="my-3 rounded-2xl overflow-hidden border border-gemini-elevated bg-[#18191A] shadow-lg group"
            >
              <div className="flex items-center justify-between px-4 py-2 bg-[#202124] border-b border-gemini-elevated/70 text-xs text-gemini-muted font-mono">
                <span className="uppercase tracking-wider font-semibold text-[11px] text-gemini-sparkle1">
                  {part.language}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(part.code, idx)}
                  className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg hover:bg-gemini-hover hover:text-gemini-text transition-colors text-gemini-muted"
                  title="Copy code"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 text-[11px] font-sans">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-sans">Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 overflow-x-auto text-xs sm:text-sm font-mono text-gray-200 leading-normal selection:bg-gemini-blue/30">
                <code>{part.code}</code>
              </pre>
            </div>
          );
        }

        return (
          <div
            key={idx}
            className="prose-gemini space-y-2.5"
            dangerouslySetInnerHTML={{ __html: part.content }}
          />
        );
      })}
    </div>
  );
}
