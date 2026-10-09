import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { api } from "../../api/client";

type ItemData = {
  id: string;
  title: string;
  type: string;
  summary?: string | null;
  source_url?: string | null;
  file_path?: string | null;
};

type Props = {
  resource: ItemData;
  onUpdate?: (id: string, patch: Partial<ItemData>) => void;
};

type Message = {
  sender: "user" | "notebooklm";
  text: string;
};

type CloudNotebook = {
  id: string;
  title: string;
  created_at?: string;
  modified_at?: string;
  url: string;
};

type CategorizedNotebooks = {
  app_created: CloudNotebook[];
  other_account: CloudNotebook[];
};

type NotebookSource = {
  index?: number;
  id?: string;
  title?: string;
  type?: string;
  status?: string;
  url?: string;
};

export function NotebookView({ resource, onUpdate }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Collapsible panels state
  const [showSyncBanner, setShowSyncBanner] = useState(false);
  const [showAddResource, setShowAddResource] = useState(false);
  const [showPicker, setShowPicker] = useState(!resource.source_url);

  // Notebook Manager / Picker state
  const [notebooks, setNotebooks] = useState<CategorizedNotebooks | null>(null);
  const [loadingNotebooks, setLoadingNotebooks] = useState(false);
  const [selectedExistingId, setSelectedExistingId] = useState<string | null>(null);
  const [linkingLoading, setLinkingLoading] = useState(false);
  const [linkingStatusMsg, setLinkingStatusMsg] = useState("");

  // Add resource form & sources list state
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceContent, setResourceContent] = useState("");
  const [isAddingResource, setIsAddingResource] = useState(false);
  const [addStatus, setAddStatus] = useState<string | null>(null);
  const [notebookSources, setNotebookSources] = useState<NotebookSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);

  // Collapsible lists state inside picker
  const [expandAppCreated, setExpandAppCreated] = useState(true);
  const [expandOtherAccount, setExpandOtherAccount] = useState(true);

  // Extract active Notebook ID
  const notebookId = resource.source_url?.split("/notebook/")[1] || null;


  // 1. Fetch & sync active chat history directly from cloud/backend
  const [fetchingHistory, setFetchingHistory] = useState(false);

  const fetchHistory = async () => {
    if (!resource.id) return;
    setFetchingHistory(true);
    try {
      const res = await api.get<{ history: Message[]; source?: string }>(`/llm/notebooks/${resource.id}/history`);
      if (res.history && res.history.length > 0) {
        setMessages(res.history);
      } else {
        setMessages([
          {
            sender: "notebooklm",
            text: `Welcome to NotebookLM for **"${resource.title}"**. Ask questions or attach resources below.`,
          },
        ]);
      }
    } catch (err) {
      console.error("Failed to load active chat history:", err);
    } finally {
      setFetchingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [resource.id, resource.source_url]);

  // Update picker visibility when source_url changes
  useEffect(() => {
    if (!resource.source_url) {
      setShowPicker(true);
    }
  }, [resource.source_url]);

  // 2. Load list of account notebooks
  const fetchNotebookList = async () => {
    setLoadingNotebooks(true);
    try {
      const data = await api.get<CategorizedNotebooks>("/llm/notebooks/list");
      setNotebooks(data);
    } catch (e) {
      console.error("Failed to fetch categorized notebooks:", e);
    } finally {
      setLoadingNotebooks(false);
    }
  };

  useEffect(() => {
    if (showPicker) {
      fetchNotebookList();
    }
  }, [showPicker]);

  // 3. Fetch notebook cloud sources
  const fetchSources = async () => {
    if (!resource.id || !notebookId) return;
    setLoadingSources(true);
    try {
      const res = await api.get<{ notebook_id: string; sources: NotebookSource[] }>(
        `/llm/notebooks/${resource.id}/sources`
      );
      setNotebookSources(res.sources || []);
    } catch (err) {
      console.error("Failed to load notebook sources:", err);
    } finally {
      setLoadingSources(false);
    }
  };

  useEffect(() => {
    if (showAddResource && notebookId) {
      fetchSources();
    }
  }, [showAddResource, notebookId, resource.id]);

  // 4. Handle Link or Create Notebook
  const handleLinkOrCreate = async (action: "create_new" | "attach_existing") => {
    if (action === "attach_existing" && !selectedExistingId) return;
    setLinkingLoading(true);
    setLinkingStatusMsg(
      action === "create_new"
        ? "✨ Creating cloud NotebookLM notebook & attaching parent resource..."
        : "🔗 Attaching parent resource to selected notebook..."
    );

    try {
      const updatedItem = await api.post<ItemData>("/llm/notebooks/link-or-create", {
        item_id: resource.id,
        action,
        notebook_id: selectedExistingId || undefined,
        custom_title: resource.title,
      });

      if (onUpdate) {
        onUpdate(resource.id, {
          source_url: updatedItem.source_url,
          summary: updatedItem.summary,
        });
      }
      setShowPicker(false);
      await fetchHistory();
    } catch (e: any) {
      alert("Notebook setup failed: " + String(e));
    } finally {
      setLinkingLoading(false);
      setLinkingStatusMsg("");
    }
  };

  // 5. Handle Chat Message
  const handleSendMessage = async () => {
    if (!chatInput.trim() || isSending) return;
    const userMsg = chatInput.trim();
    setChatInput("");

    setMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    setIsSending(true);

    try {
      const res = await api.post<{ reply: string; history: Message[] }>("/llm/notebooks/chat", {
        item_id: resource.id,
        message: userMsg,
      });
      if (res.history && res.history.length > 0) {
        setMessages(res.history);
      } else {
        setMessages((prev) => [...prev, { sender: "notebooklm", text: res.reply }]);
      }
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { sender: "notebooklm", text: `⚠️ **Error communicating with NotebookLM**: ${e?.message || e}` },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  // 6. Handle Add Manual Resource
  const handleAddResource = async () => {
    if (!resourceContent.trim() || isAddingResource || !notebookId) return;
    setIsAddingResource(true);
    setAddStatus("Adding resource to NotebookLM...");

    try {
      const title = resourceTitle.trim() || "Attached Note";
      await api.post("/llm/notebooks/add-resource", {
        notebook_id: notebookId,
        title,
        content: resourceContent.trim(),
      });
      setAddStatus(`Successfully added "${title}" to notebook!`);
      setResourceTitle("");
      setResourceContent("");
      await fetchSources();
    } catch (e: any) {
      setAddStatus(`Failed to add resource: ${e}`);
    } finally {
      setIsAddingResource(false);
    }
  };


  return (
    <div className="flex-1 flex flex-col h-full bg-gray-900 text-gray-100 p-4 gap-3 overflow-hidden">
      {/* Loading & Waiting Animation Overlay */}
      {linkingLoading && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-gray-850 border border-purple-600/80 p-6 rounded-xl shadow-2xl flex flex-col items-center gap-4 text-center max-w-sm">
            <div className="relative flex h-10 w-10">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-10 w-10 bg-purple-600 flex items-center justify-center text-white text-lg">
                📓
              </span>
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-purple-200">Processing NotebookLM</h4>
              <p className="text-xs text-gray-300 leading-relaxed font-mono">{linkingStatusMsg}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header & Control Panel Bar */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="bg-purple-800 text-purple-200 text-xs px-2.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">
            NotebookLM
          </span>
          <h2 className="text-sm font-bold text-gray-100 truncate" title={resource.title}>
            {resource.title}
          </h2>
          {notebookId && (
            <span className="text-[11px] text-purple-300/80 font-mono hidden sm:inline">
              ({notebookId})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {notebookId && (
            <button
              onClick={fetchHistory}
              disabled={fetchingHistory}
              className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-200 text-xs rounded font-medium transition-colors flex items-center gap-1"
              title="Download active chat state from Google NotebookLM"
            >
              {fetchingHistory ? (
                <>
                  <span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  Syncing...
                </>
              ) : (
                "Sync Chat 🔄"
              )}
            </button>
          )}
          <button
            onClick={() => setShowPicker(!showPicker)}
            className={`px-2.5 py-1 text-xs rounded font-medium border transition-colors ${
              showPicker
                ? "bg-purple-950 border-purple-600 text-purple-200 font-bold"
                : "bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-300"
            }`}
          >
            {showPicker ? "Close Picker ✕" : notebookId ? "⚙ Notebook Settings" : "🔗 Connect Notebook"}
          </button>
          <button
            onClick={() => setShowAddResource(!showAddResource)}
            className={`px-2.5 py-1 text-xs rounded font-medium border transition-colors ${
              showAddResource
                ? "bg-blue-950 border-blue-600 text-blue-200 font-bold"
                : "bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-300"
            }`}
          >
            {showAddResource ? "Hide Source Form ✕" : "+ Add Source"}
          </button>
          <button
            onClick={() => setShowSyncBanner(!showSyncBanner)}
            className="text-gray-400 hover:text-gray-200 px-1.5 py-1 text-xs rounded"
            title="Toggle Google Account Sync Bar"
          >
            {showSyncBanner ? "▲" : "▼ Sync Info"}
          </button>
          {resource.source_url && (
            <a
              href={resource.source_url}
              target="_blank"
              rel="noreferrer"
              className="bg-purple-700 hover:bg-purple-600 text-white text-xs px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1"
            >
              Open Cloud Notebook ↗
            </a>
          )}
        </div>
      </div>

      {/* Optional Collapsible Google Account Sync Banner */}
      {showSyncBanner && (
        <div className="bg-blue-950/40 border border-blue-800/40 rounded-lg p-3 text-xs text-blue-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex flex-col gap-0.5">
            <div className="font-semibold text-blue-300 flex items-center gap-1.5">
              <span>🔐</span> Google NotebookLM Account Sync
            </div>
            <p className="text-[11px] text-gray-300">
              Target your preferred Google Account credentials to store and sync cloud notebooks directly.
            </p>
          </div>
          <a
            href="https://notebooklm.google.com"
            target="_blank"
            rel="noreferrer"
            className="shrink-0 bg-blue-700 hover:bg-blue-600 text-white text-xs px-3 py-1.5 rounded font-medium transition-colors"
          >
            Sign in to Google NotebookLM ↗
          </a>
        </div>
      )}

      {/* Notebook Selector & Manager Card (Collapsible) */}
      {showPicker && (
        <div className="bg-gray-800 border border-purple-700/60 rounded-lg p-4 space-y-4 shrink-0 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-gray-700 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-base">📓</span>
              <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wide">
                NotebookLM Account Selector & Creator
              </h3>
            </div>
            <button
              onClick={() => handleLinkOrCreate("create_new")}
              disabled={linkingLoading}
              className="px-3 py-1.5 bg-purple-700 hover:bg-purple-600 text-white rounded text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <span>✨ Create New Notebook</span>
            </button>
          </div>

          <p className="text-xs text-gray-300 leading-relaxed">
            Choose whether to <strong>create a brand new cloud notebook</strong> or <strong>attach this resource to an existing notebook</strong> in your Google Account.
          </p>

          {loadingNotebooks ? (
            <div className="text-xs text-gray-400 py-4 flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              Loading notebooks from your Google Account...
            </div>
          ) : notebooks ? (
            <div className="space-y-3">
              {/* Category 1: Notebooks created by ResearchTree */}
              <div className="border border-gray-700 rounded-lg overflow-hidden bg-gray-900/60">
                <button
                  type="button"
                  onClick={() => setExpandAppCreated(!expandAppCreated)}
                  className="w-full px-3 py-2 bg-purple-950/50 hover:bg-purple-900/40 text-left text-xs font-bold text-purple-200 flex items-center justify-between border-b border-gray-700/60"
                >
                  <span className="flex items-center gap-2">
                    <span>📁 Created by ResearchTree</span>
                    <span className="bg-purple-800 text-purple-100 text-[10px] px-1.5 py-0.2 rounded font-mono">
                      {notebooks.app_created.length}
                    </span>
                  </span>
                  <span>{expandAppCreated ? "▼" : "▶"}</span>
                </button>
                {expandAppCreated && (
                  <div className="p-2 space-y-1.5">
                    {notebooks.app_created.length === 0 ? (
                      <p className="text-[11px] text-gray-500 italic p-2">No app-created notebooks found yet.</p>
                    ) : (
                      notebooks.app_created.map((nb) => (
                        <label
                          key={nb.id}
                          className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer border transition-colors ${
                            selectedExistingId === nb.id
                              ? "bg-purple-950/60 border-purple-500 text-purple-200 font-semibold"
                              : "bg-gray-900/40 border-gray-800 text-gray-300 hover:bg-gray-800/60"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <input
                              type="radio"
                              name="notebook_select"
                              checked={selectedExistingId === nb.id}
                              onChange={() => setSelectedExistingId(nb.id)}
                            />
                            <span className="truncate" title={nb.title}>
                              {nb.title}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-500 font-mono shrink-0">{nb.id.slice(0, 8)}...</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Category 2: Other cloud notebooks in Google Account */}
              <div className="border border-gray-700 rounded-lg overflow-hidden bg-gray-900/60">
                <button
                  type="button"
                  onClick={() => setExpandOtherAccount(!expandOtherAccount)}
                  className="w-full px-3 py-2 bg-gray-800/80 hover:bg-gray-750 text-left text-xs font-bold text-gray-300 flex items-center justify-between border-b border-gray-700/60"
                >
                  <span className="flex items-center gap-2">
                    <span>🌐 Other Google Account Notebooks</span>
                    <span className="bg-gray-700 text-gray-300 text-[10px] px-1.5 py-0.2 rounded font-mono">
                      {notebooks.other_account.length}
                    </span>
                  </span>
                  <span>{expandOtherAccount ? "▼" : "▶"}</span>
                </button>
                {expandOtherAccount && (
                  <div className="p-2 space-y-1.5">
                    {notebooks.other_account.length === 0 ? (
                      <p className="text-[11px] text-gray-500 italic p-2">No other cloud notebooks found.</p>
                    ) : (
                      notebooks.other_account.map((nb) => (
                        <label
                          key={nb.id}
                          className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer border transition-colors ${
                            selectedExistingId === nb.id
                              ? "bg-purple-950/60 border-purple-500 text-purple-200 font-semibold"
                              : "bg-gray-900/40 border-gray-800 text-gray-300 hover:bg-gray-800/60"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <input
                              type="radio"
                              name="notebook_select"
                              checked={selectedExistingId === nb.id}
                              onChange={() => setSelectedExistingId(nb.id)}
                            />
                            <span className="truncate" title={nb.title}>
                              {nb.title || "(Untitled Notebook)"}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-500 font-mono shrink-0">{nb.id.slice(0, 8)}...</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Confirm Link Existing Button */}
              {selectedExistingId && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => handleLinkOrCreate("attach_existing")}
                    disabled={linkingLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded shadow transition-colors flex items-center gap-1.5"
                  >
                    <span>🔗 Attach Resource & Link Selected Notebook</span>
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Add Resource & Sources Panel (Collapsible) */}
      {showAddResource && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 flex flex-col gap-3 shrink-0 max-h-96 overflow-y-auto">
          {/* Current Resources List */}
          <div className="border border-gray-700/80 bg-gray-900/60 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wide flex items-center gap-1.5">
                <span>📚 Current Notebook Sources</span>
                <span className="bg-purple-800 text-purple-100 text-[10px] px-1.5 py-0.2 rounded font-mono">
                  {notebookSources.length}
                </span>
              </h4>
              <button
                type="button"
                onClick={fetchSources}
                disabled={loadingSources || !notebookId}
                className="text-[11px] text-purple-300 hover:text-purple-200 transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                {loadingSources ? (
                  <>
                    <span className="w-2.5 h-2.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                    Fetching...
                  </>
                ) : (
                  "Refresh 🔄"
                )}
              </button>
            </div>

            {loadingSources ? (
              <div className="text-xs text-gray-400 py-2 flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                Fetching notebook resources from Google Cloud...
              </div>
            ) : notebookSources.length === 0 ? (
              <div className="text-xs text-gray-500 italic py-1">
                No sources added to this cloud notebook yet.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {notebookSources.map((src, i) => (
                  <div
                    key={src.id || i}
                    className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded px-2.5 py-1.5 text-xs text-gray-200"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-gray-500 font-mono text-[10px]">#{src.index ?? i + 1}</span>
                      <span className="font-medium truncate" title={src.title}>
                        {src.title || "Untitled Source"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {src.type && (
                        <span className="bg-gray-800 text-gray-400 text-[10px] px-2 py-0.5 rounded font-mono border border-gray-700 uppercase">
                          {src.type}
                        </span>
                      )}
                      {src.status && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                            src.status === "ready"
                              ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/80"
                              : "bg-amber-950/80 text-amber-300 border border-amber-800/80"
                          }`}
                        >
                          {src.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Source Form */}
          <div className="border-t border-gray-700 pt-3 flex flex-col gap-2">
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wide">
              Add Additional Source to NotebookLM
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Source Title</label>
                <input
                  type="text"
                  value={resourceTitle}
                  onChange={(e) => setResourceTitle(e.target.value)}
                  placeholder="e.g. Additional Notes"
                  className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-100"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Source Content</label>
                <input
                  type="text"
                  value={resourceContent}
                  onChange={(e) => setResourceContent(e.target.value)}
                  placeholder="Paste text content or notes..."
                  className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-100"
                />
              </div>
            </div>
            {addStatus && (
              <div className="text-xs text-purple-300 bg-purple-950/40 p-2 rounded border border-purple-800/50">
                {addStatus}
              </div>
            )}
            <button
              onClick={handleAddResource}
              disabled={isAddingResource || !resourceContent.trim() || !notebookId}
              className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-xs px-4 py-1.5 rounded self-end font-semibold transition-colors"
            >
              {isAddingResource ? "Adding Source..." : "Add to NotebookLM"}
            </button>
          </div>
        </div>
      )}


      {/* Main Chat Component (Dominant UI Real Estate) */}
      <div className="flex-1 min-h-0 bg-gray-800 border border-gray-700 rounded-lg p-3 flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-700 pb-2 mb-2">
          <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wide flex items-center gap-2">
            <span>💬 Interactive NotebookLM Assistant</span>
            {notebookId ? (
              <span className="text-emerald-400 font-mono text-[11px] font-normal">
                ● Active ({notebookId.slice(0, 8)}...)
              </span>
            ) : (
              <span className="text-amber-400 font-mono text-[11px] font-normal">
                ⚠️ Unlinked (Select notebook above)
              </span>
            )}
          </h3>
        </div>

        {/* Message Log with Markdown Viewer */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-3 bg-gray-950/70 rounded border border-gray-800 mb-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[88%] rounded-lg p-3 text-xs leading-relaxed shadow ${
                m.sender === "user"
                  ? "bg-blue-700 text-white self-end"
                  : "bg-gray-850 text-gray-100 border border-gray-700 self-start"
              }`}
            >
              <div className="font-bold text-[10px] opacity-70 mb-1 uppercase tracking-wider">
                {m.sender === "user" ? "You" : "NotebookLM Assistant"}
              </div>
              {m.sender === "user" ? (
                <div className="whitespace-pre-wrap">{m.text}</div>
              ) : (
                <div className="prose prose-invert max-w-none text-xs leading-relaxed space-y-1.5 text-gray-100 font-sans">
                  <ReactMarkdown>{m.text}</ReactMarkdown>
                </div>
              )}
            </div>
          ))}

          {isSending && (
            <div className="text-xs text-purple-300 italic self-start flex items-center gap-2 p-3 bg-gray-850 border border-purple-800/50 rounded-lg animate-pulse">
              <span className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-ping" />
              NotebookLM is reasoning and generating response...
            </div>
          )}
        </div>

        {/* Chat Input Bar */}
        <div className="flex gap-2 shrink-0">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder={
              notebookId
                ? "Ask your NotebookLM notebook a question..."
                : "Please select or create a notebook above first..."
            }
            disabled={!notebookId || isSending}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3.5 py-2 text-xs text-gray-100 focus:outline-none focus:border-purple-500 disabled:opacity-50"
          />
          <button
            onClick={handleSendMessage}
            disabled={isSending || !chatInput.trim() || !notebookId}
            className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-xs px-5 py-2 rounded-lg font-bold transition-colors shrink-0"
          >
            {isSending ? "Thinking..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
