import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { ItemData } from "../../store/useGraphStore";
import { api } from "../../api/client";

type Props = {
  resource: ItemData;
  onUpdate: (id: string, data: Partial<ItemData>) => void;
};

type ViewMode = "edit" | "preview" | "split";

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-100">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic text-slate-200">$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-slate-950 px-1.5 py-0.5 rounded font-mono text-xs text-amber-300">$1</code>')
    .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" class="max-w-full h-auto rounded-lg border border-slate-700 shadow-md my-3" />')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">$1</a>');
}

export function renderMarkdownWithKaTeX(content: string): string {
  if (!content || !content.trim()) return "<p class='text-slate-500 italic'>Empty note content...</p>";

  // 1. Protect & Extract KaTeX block equations $$ ... $$
  const mathBlocks: string[] = [];
  let processed = content.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    try {
      const html = katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
      mathBlocks.push(`<div class="my-4 overflow-x-auto p-3 bg-slate-950/80 rounded-lg border border-slate-800 text-center shadow-inner">${html}</div>`);
      return `___MATH_BLOCK_${mathBlocks.length - 1}___`;
    } catch {
      return math;
    }
  });

  // 2. Protect & Extract inline KaTeX equations $ ... $
  processed = processed.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
    try {
      const html = katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
      mathBlocks.push(`<span class="inline-block px-1 font-mono">${html}</span>`);
      return `___MATH_BLOCK_${mathBlocks.length - 1}___`;
    } catch {
      return math;
    }
  });

  // 3. Protect & Extract code blocks ```...```
  const codeBlocks: string[] = [];
  processed = processed.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, (_, _lang, code) => {
    const escapedCode = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    codeBlocks.push(`<pre class="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto my-3"><code>${escapedCode}</code></pre>`);
    return `___CODE_BLOCK_${codeBlocks.length - 1}___`;
  });

  // 4. Escape HTML tags to prevent XSS
  processed = processed
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Restore code blocks & math blocks
  codeBlocks.forEach((codeHtml, idx) => {
    processed = processed.replace(`___CODE_BLOCK_${idx}___`, codeHtml);
  });
  mathBlocks.forEach((blockHtml, idx) => {
    processed = processed.replace(`___MATH_BLOCK_${idx}___`, blockHtml);
  });

  // Split into lines & process block-level elements
  const lines = processed.split("\n");
  const resultBlocks: string[] = [];
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const text = currentParagraph.join("<br />").trim();
      if (text) {
        resultBlocks.push(`<p class="my-2 leading-relaxed text-slate-200 text-sm">${formatInline(text)}</p>`);
      }
      currentParagraph = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (
      line.startsWith("___MATH_BLOCK_") ||
      line.startsWith("___CODE_BLOCK_") ||
      line.startsWith("<div") ||
      line.startsWith("<pre")
    ) {
      flushParagraph();
      resultBlocks.push(line);
      continue;
    }

    // Headings
    if (/^### (.*$)/.test(line)) {
      flushParagraph();
      const title = line.replace(/^### (.*$)/, "$1");
      resultBlocks.push(`<h3 class="text-base font-bold text-emerald-300 mt-4 mb-2">${formatInline(title)}</h3>`);
      continue;
    }
    if (/^## (.*$)/.test(line)) {
      flushParagraph();
      const title = line.replace(/^## (.*$)/, "$1");
      resultBlocks.push(`<h2 class="text-lg font-bold text-amber-300 mt-5 mb-2 border-b border-slate-800 pb-1">${formatInline(title)}</h2>`);
      continue;
    }
    if (/^# (.*$)/.test(line)) {
      flushParagraph();
      const title = line.replace(/^# (.*$)/, "$1");
      resultBlocks.push(`<h1 class="text-xl font-extrabold text-blue-300 mt-6 mb-3 border-b border-slate-700 pb-1">${formatInline(title)}</h1>`);
      continue;
    }

    // Blockquotes
    if (/^&gt; (.*$)/.test(line)) {
      flushParagraph();
      const quote = line.replace(/^&gt; (.*$)/, "$1");
      resultBlocks.push(`<blockquote class="border-l-4 border-amber-500 pl-3 py-1 my-2 bg-amber-950/20 italic text-slate-300 text-xs">${formatInline(quote)}</blockquote>`);
      continue;
    }

    // Bullet Lists
    if (/^[\-\*] (.*$)/.test(line)) {
      flushParagraph();
      const item = line.replace(/^[\-\*] (.*$)/, "$1");
      resultBlocks.push(`<li class="ml-4 list-disc text-slate-200 my-1">${formatInline(item)}</li>`);
      continue;
    }

    // Empty line -> flush paragraph
    if (line.trim() === "") {
      flushParagraph();
      continue;
    }

    currentParagraph.push(line);
  }

  flushParagraph();
  return resultBlocks.join("");
}

export function RichNoteView({ resource, onUpdate }: Props) {
  const [content, setContent] = useState(resource.summary ?? "");
  const [mode, setMode] = useState<ViewMode>("split");
  const [saving, setSaving] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setContent(resource.summary ?? "");
  }, [resource.id, resource.summary]);

  const saveContent = useCallback(
    async (textToSave: string) => {
      setSaving(true);
      try {
        await api.put(`/items/${resource.id}`, { summary: textToSave || null });
        onUpdate(resource.id, { summary: textToSave || null });
      } catch (err) {
        console.error("Failed to auto-save note:", err);
      } finally {
        setSaving(false);
      }
    },
    [resource.id, onUpdate]
  );

  const handleContentChange = (newVal: string) => {
    setContent(newVal);
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveContent(newVal);
    }, 800);
  };

  const insertText = (prefix: string, suffix = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const replacement = `${prefix}${selected || "text"}${suffix}`;
    const nextVal = content.substring(0, start) + replacement + content.substring(end);
    handleContentChange(nextVal);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selected.length || 4));
    }, 50);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (!blob) continue;
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          if (base64) {
            insertText(`\n![Pasted Image](${base64})\n`);
          }
        };
        reader.readAsDataURL(blob);
        e.preventDefault();
        break;
      }
    }
  };

  const loadSampleNote = () => {
    const sample = `# 🧪 Rich Working Canvas & KaTeX Guide

> Predictive coding networks perform inference through an **iterative energy minimization process**, whose operations are *local in space and time*.

## 1. Mathematical Formulations (KaTeX)

Inline math equation: $E = mc^2$ or variance parameter $\sigma_i^2$.

Block energy functional equation:
$$\\mathcal{E} = \\frac{1}{2} \\sum_{i=1}^{N} \\sigma_i^{-2} (x_i - f(w_i y_i))^2$$

Quadratic formula example:
$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

Matrix notation:
$$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$

## 2. Formatting Options

- **Bold text** with \`**bold**\`
- *Italic text* with \`*italic*\`
- Inline code: \`const rate = 0.01;\`
- Direct clipboard image pasting with \`Ctrl + V\`

### 3. Code Implementation

\`\`\`python
# Gradient descent energy minimization step
def update_state(x, mu, lr=0.01):
    err = x - mu
    return x - lr * err
\`\`\`
`;
    handleContentChange(sample);
    setShowHelp(false);
  };

  const renderedHtml = useMemo(() => {
    return renderMarkdownWithKaTeX(content);
  }, [content]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-slate-950 text-slate-100 overflow-hidden relative">
      {/* Top Toolbar */}
      <div className="bg-slate-900 border-b border-slate-800 p-2 flex items-center justify-between gap-2 flex-wrap shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider px-2 py-0.5 bg-amber-950/60 rounded border border-amber-600/40">
            📝 Rich Working Canvas
          </span>

          {/* Quick Formatting Tools */}
          <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
            <button
              onClick={() => insertText("# ", "")}
              className="px-1.5 py-0.5 text-xs bg-slate-800 hover:bg-slate-700 rounded font-bold"
              title="Heading 1"
            >
              H1
            </button>
            <button
              onClick={() => insertText("## ", "")}
              className="px-1.5 py-0.5 text-xs bg-slate-800 hover:bg-slate-700 rounded font-bold"
              title="Heading 2"
            >
              H2
            </button>
            <button
              onClick={() => insertText("**", "**")}
              className="px-1.5 py-0.5 text-xs bg-slate-800 hover:bg-slate-700 rounded font-bold"
              title="Bold"
            >
              B
            </button>
            <button
              onClick={() => insertText("*", "*")}
              className="px-1.5 py-0.5 text-xs bg-slate-800 hover:bg-slate-700 rounded italic"
              title="Italic"
            >
              I
            </button>
            <button
              onClick={() => insertText("$$ ", " $$")}
              className="px-2 py-0.5 text-xs bg-amber-900/60 hover:bg-amber-800 text-amber-200 border border-amber-600/40 rounded font-mono font-bold"
              title="Insert KaTeX Math Equation"
            >
              $ KaTeX
            </button>
            <button
              onClick={() => insertText("- ", "")}
              className="px-1.5 py-0.5 text-xs bg-slate-800 hover:bg-slate-700 rounded"
              title="Bullet List"
            >
              • List
            </button>
            <button
              onClick={() => insertText("> ", "")}
              className="px-1.5 py-0.5 text-xs bg-slate-800 hover:bg-slate-700 rounded italic"
              title="Blockquote"
            >
              &ldquo; Quote
            </button>
            <button
              onClick={() => insertText("```\n", "\n```")}
              className="px-1.5 py-0.5 text-xs bg-slate-800 hover:bg-slate-700 rounded font-mono"
              title="Code Block"
            >
              &lt;/&gt; Code
            </button>

            {/* Popup Help Window Button */}
            <button
              onClick={() => setShowHelp(true)}
              className="px-2 py-0.5 text-xs bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 border border-indigo-500/40 rounded font-medium flex items-center gap-1 transition-colors"
              title="Formatting & KaTeX Cheatsheet Help"
            >
              ❓ Help & Cheatsheet
            </button>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-2">
          {saving && <span className="text-[11px] text-amber-400 font-mono animate-pulse">Saving...</span>}
          <div className="bg-slate-950 p-0.5 rounded-lg border border-slate-800 flex text-xs">
            <button
              onClick={() => setMode("edit")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                mode === "edit" ? "bg-emerald-600 text-white font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              ✏️ Edit
            </button>
            <button
              onClick={() => setMode("split")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                mode === "split" ? "bg-emerald-600 text-white font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              🔄 Split
            </button>
            <button
              onClick={() => setMode("preview")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                mode === "preview" ? "bg-emerald-600 text-white font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              👁️ Preview
            </button>
          </div>
        </div>
      </div>

      {/* Editor Main Content Area */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Editor Textarea */}
        {(mode === "edit" || mode === "split") && (
          <div className={`flex-1 flex flex-col p-4 bg-slate-950 overflow-hidden ${mode === "split" ? "border-r border-slate-800" : ""}`}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              onPaste={handlePaste}
              placeholder="Type markdown, rich notes, equations ($E=mc^2$), code, or paste images directly from Gemini..."
              className="flex-1 w-full bg-transparent text-slate-100 text-sm font-mono focus:outline-none resize-none leading-relaxed placeholder-slate-600"
            />
          </div>
        )}

        {/* KaTeX & Markdown Rendered Canvas Preview */}
        {(mode === "preview" || mode === "split") && (
          <div className="flex-1 p-6 bg-slate-900/80 overflow-y-auto min-h-0 select-text">
            <div
              className="prose prose-invert max-w-none space-y-2 text-slate-200"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </div>
        )}
      </div>

      {/* Help & Cheatsheet Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden text-slate-100">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <span className="text-xl">📖</span>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Rich Note Canvas & KaTeX Help</h3>
                  <p className="text-xs text-slate-400">Guide to rich text markdown, KaTeX math expressions, and mixed usage</p>
                </div>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="text-slate-400 hover:text-white font-bold p-1 rounded hover:bg-slate-800 text-lg"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-200">
              {/* 1. Official Cheatsheet Link */}
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-bold text-amber-400 text-base">📐 KaTeX Mathematical Expressions</span>
                  <a
                    href="https://katex.org/docs/supported.html"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-lg hover:bg-blue-600/50 font-medium text-xs transition-all"
                  >
                    🔗 Official KaTeX Functions Cheatsheet ↗
                  </a>
                </div>
                <p className="text-xs text-slate-400">
                  KaTeX is a fast math typesetting library. Wrap equations in single <code>$ ... $</code> for inline math or double <code>$$ ... $$</code> for centered block equations.
                </p>
              </div>

              {/* 2. KaTeX Math Syntax Examples */}
              <div>
                <h4 className="font-bold text-emerald-400 mb-2 border-b border-slate-800 pb-1">⚡ KaTeX Syntax Examples</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1">
                    <div className="text-slate-400">Inline Math:</div>
                    <code className="text-amber-300 block">$E = mc^2$</code>
                    <code className="text-amber-300 block">{"$\\sigma_i^2$"}</code>
                  </div>
                  <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1">
                    <div className="text-slate-400">Fractions & Roots:</div>
                    <code className="text-amber-300 block">{"$\\frac{a}{b}$"}</code>
                    <code className="text-amber-300 block">{"$\\sqrt{b^2 - 4ac}$"}</code>
                  </div>
                  <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1">
                    <div className="text-slate-400">Summation & Integrals:</div>
                    <code className="text-amber-300 block">{"$$\\sum_{i=1}^N x_i$$"}</code>
                    <code className="text-amber-300 block">{"$$\\int_0^\\infty e^{-x} dx$$"}</code>
                  </div>
                  <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1">
                    <div className="text-slate-400">Greek Letters & Symbols:</div>
                    <code className="text-amber-300 block">{"$\\alpha, \\beta, \\theta, \\mathcal{E}$"}</code>
                    <code className="text-amber-300 block">{"$\\rightarrow, \\cdot, \\infty$"}</code>
                  </div>
                </div>
              </div>

              {/* 3. Rich Text & Markdown Options */}
              <div>
                <h4 className="font-bold text-blue-400 mb-2 border-b border-slate-800 pb-1">✍️ Rich Text & Formatting Options</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1">
                    <span className="font-bold text-slate-300">Headings:</span>
                    <pre className="text-emerald-300 font-mono"># Title (H1)&#10;## Section (H2)&#10;### Sub-section (H3)</pre>
                  </div>
                  <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1">
                    <span className="font-bold text-slate-300">Styling & Quotes:</span>
                    <pre className="text-emerald-300 font-mono">**Bold text**&#10;*Italic text*&#10;&gt; Quoted paper excerpt</pre>
                  </div>
                  <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1">
                    <span className="font-bold text-slate-300">Lists & Links:</span>
                    <pre className="text-emerald-300 font-mono">- Bullet point 1&#10;- Bullet point 2&#10;[Link Text](https://example.com)</pre>
                  </div>
                  <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1">
                    <span className="font-bold text-slate-300">Code & Images:</span>
                    <pre className="text-emerald-300 font-mono">\`inline code\`&#10;\`\`\`python&#10;print("Hello")&#10;\`\`\`&#10;Ctrl + V to paste clipboard images</pre>
                  </div>
                </div>
              </div>

              {/* 4. Mixed Master Example & Load Sample Action */}
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-400">🔀 Mixed Formatting Example</span>
                  <button
                    onClick={loadSampleNote}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium text-xs shadow flex items-center gap-1 transition-all"
                  >
                    📋 Insert Sample Note into Canvas
                  </button>
                </div>
                <pre className="bg-slate-900 p-3 rounded border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap">
{`# 🧪 Predictive Coding Energy Minimization

> Predictive coding networks perform inference through an **iterative energy minimization process**.

Inline Math: Variance parameter is $\\sigma_i^2$.

Display Block Equation:
$$\\mathcal{E} = \\frac{1}{2} \\sum_{i=1}^{N} \\sigma_i^{-2} (x_i - f(w_i y_i))^2$$

\`\`\`python
# Gradient update calculation
def update(x, mu): return x - 0.01 * (x - mu)
\`\`\``}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                onClick={() => setShowHelp(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

