import { useState, useRef, useEffect } from "react";
import { FLAG_DEFINITIONS, FlagType } from "./FlagEditor";

type Props = {
  onSubmit: (data: { title: string; type: string; file_path?: string; source_url?: string; is_local?: boolean; flags?: string[] }) => void;
  onClose: () => void;
  initialType?: string;
  initialTitle?: string;
  parentItem?: { id: string; title: string; summary?: string | null } | null;
};

const ITEM_TYPES = [
  { value: "pdf", label: "PDF Document" },
  { value: "rich-note", label: "📝 Rich Working Note" },
  { value: "note", label: "Note" },
  { value: "article", label: "Article" },
  { value: "llm-summary", label: "🤖 LLM Summary (AI)" },
  { value: "notebook", label: "📓 NotebookLM Notebook" },
  { value: "video", label: "Video" },
  { value: "link", label: "Web Link" },
  { value: "repo", label: "Code Repository" },
  { value: "idea", label: "Idea" },
  { value: "scratch-pad", label: "Scratch Pad" },
  { value: "latex", label: "LaTeX Document" },
];

export function AddItemDialog({ onSubmit, onClose, initialType = "pdf", initialTitle = "", parentItem }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [type, setType] = useState(initialType);
  const [filePath, setFilePath] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [isLocal, setIsLocal] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState<FlagType | "">("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setType(initialType);
  }, [initialType]);

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  const handleTypeChange = (newType: string) => {
    setType(newType);
    if (!title && parentItem) {
      if (newType === "llm-summary") {
        setTitle(`Summary: ${parentItem.title}`);
      } else if (newType === "notebook") {
        setTitle(`Notebook: ${parentItem.title}`);
      }
    }
  };

  const handleBrowse = () => {
    setUploadError("");
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (res.ok) {
        const data = await res.json();
        setFilePath(data.file_path);
        if (!title) setTitle(file.name);
      } else {
        const text = await res.text();
        setUploadError(`Upload failed (${res.status}): ${text}`);
      }
    } catch (err) {
      setUploadError("Upload failed — is the backend running?");
      console.error("Upload failed:", err);
    }
    setUploading(false);
  };

  const handleSubmit = () => {
    let finalFilePath = filePath.trim();
    let finalSourceUrl = sourceUrl.trim();
    let finalType = type;

    if (finalFilePath.startsWith("http://") || finalFilePath.startsWith("https://")) {
      if (!finalSourceUrl) finalSourceUrl = finalFilePath;
      finalFilePath = "";
    }

    const checkUrl = (finalSourceUrl || finalFilePath).toLowerCase();
    if (checkUrl.endsWith(".pdf") || checkUrl.includes("arxiv.org/pdf/") || checkUrl.includes("arxiv.org/abs/")) {
      if (finalType === "link" || finalType === "article") {
        finalType = "pdf";
      }
    }

    const defaultTitle =
      finalType === "llm-summary" && parentItem
        ? `Summary: ${parentItem.title}`
        : finalType === "notebook" && parentItem
        ? `Notebook: ${parentItem.title}`
        : finalFilePath || finalSourceUrl
        ? (finalFilePath || finalSourceUrl).split(/[/\\]/).pop()?.split("?")[0] || "Untitled"
        : "Untitled";

    const data: { title: string; type: string; file_path?: string; source_url?: string; is_local?: boolean; flags?: string[] } = {
      title: title || defaultTitle,
      type: finalType,
      is_local: isLocal,
      flags: selectedFlag ? [selectedFlag] : [],
    };
    if (finalFilePath) data.file_path = finalFilePath;
    if (finalSourceUrl) data.source_url = finalSourceUrl;
    onSubmit(data);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 border border-gray-600 rounded-lg shadow-xl w-96 p-4">
        <h3 className="text-base font-semibold mb-2">Add item</h3>

        {parentItem ? (
          <div className="bg-blue-950/40 border border-blue-800/60 rounded p-2 text-xs flex items-center gap-2 mb-3">
            <span className="text-blue-400 font-bold uppercase tracking-wider text-[10px] shrink-0">Context Attached:</span>
            <span className="text-gray-200 font-medium truncate" title={parentItem.title}>
              {parentItem.title}
            </span>
          </div>
        ) : (
          <div className="bg-gray-900/50 border border-gray-700/60 rounded p-2 text-xs flex items-center gap-2 mb-3">
            <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px] shrink-0">Context Attached:</span>
            <span className="text-gray-400 italic">None (Root item)</span>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === "llm-summary" && parentItem
                  ? `Summary: ${parentItem.title}`
                  : type === "notebook" && parentItem
                  ? `Notebook: ${parentItem.title}`
                  : "Optional — defaults to title / filename"
              }
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm font-medium"
            >
              {ITEM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Node Scope & Scale Selector */}
          <div className="space-y-1">
            <label className="text-xs text-slate-400 block font-semibold uppercase tracking-wider">
              Node Scope & Scale
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsLocal(true)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition-all ${
                  isLocal
                    ? "border-amber-500 bg-amber-950/60 text-amber-200 font-bold"
                    : "border-slate-700 bg-slate-800/40 text-slate-400 hover:bg-slate-700/60"
                }`}
              >
                <span>📍 Local Note</span>
                <span className="text-[10px] opacity-75">(Tethered)</span>
              </button>

              <button
                type="button"
                onClick={() => setIsLocal(false)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition-all ${
                  !isLocal
                    ? "border-emerald-500 bg-emerald-950/60 text-emerald-200 font-bold"
                    : "border-slate-700 bg-slate-800/40 text-slate-400 hover:bg-slate-700/60"
                }`}
              >
                <span>🚀 Global Item</span>
                <span className="text-[10px] opacity-75">(Full Node)</span>
              </button>
            </div>
          </div>

          {/* Role Flag Assigner (If Global) */}
          {!isLocal && (
            <div className="space-y-1">
              <label className="text-xs text-slate-400 block font-semibold uppercase tracking-wider">
                Assign Role Flag (Optional)
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(FLAG_DEFINITIONS) as FlagType[]).map((flagKey) => {
                  const def = FLAG_DEFINITIONS[flagKey];
                  const isSel = selectedFlag === flagKey;
                  return (
                    <button
                      key={flagKey}
                      type="button"
                      onClick={() => setSelectedFlag(isSel ? "" : flagKey)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs border text-left transition-all ${
                        isSel
                          ? "border-emerald-500 bg-emerald-950/80 text-emerald-200 font-bold"
                          : "border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800"
                      }`}
                    >
                      <span>{def.emoji}</span>
                      <span className="truncate">{def.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {type === "llm-summary" && (
            <div className="bg-purple-950/30 border border-purple-800/50 rounded p-2 text-xs text-purple-300">
              {parentItem ? (
                <>🤖 Will generate an AI summary for parent node <strong>&ldquo;{parentItem.title}&rdquo;</strong> using configured LLM provider.</>
              ) : (
                <>🤖 Generates an AI summary. (Tip: Spawn from a node to summarize node context directly).</>
              )}
            </div>
          )}

          {type === "notebook" && (
            <div className="bg-blue-950/30 border border-blue-800/50 rounded p-2 text-xs text-blue-300">
              {parentItem ? (
                <>📓 Will initialize a NotebookLM notebook instance with context from <strong>&ldquo;{parentItem.title}&rdquo;</strong>.</>
              ) : (
                <>📓 Initializes a standalone NotebookLM notebook instance.</>
              )}
            </div>
          )}

          {type !== "llm-summary" && type !== "notebook" && (
            <>
              <div>
                <label className="text-xs text-gray-400 block mb-1">File</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={filePath}
                    onChange={(e) => setFilePath(e.target.value)}
                    placeholder="C:\path\to\file.pdf"
                    className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
                  />
                  <button
                    onClick={handleBrowse}
                    disabled={uploading}
                    className="px-3 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-50"
                  >
                    {uploading ? "..." : "Browse"}
                  </button>
                </div>
                {uploadError && (
                  <p className="text-xs text-red-400 mt-1">{uploadError}</p>
                )}
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">URL (web)</label>
                <input
                  type="text"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-sm bg-gray-700 hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-3 py-1.5 rounded text-sm bg-blue-600 hover:bg-blue-500 font-semibold"
          >
            {type === "llm-summary" ? "Generate Summary" : type === "notebook" ? "Create Notebook" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
