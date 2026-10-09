import { useState, useEffect } from "react";
import { api } from "../api/client";
import { useSettingsStore, type NodeShape, type ColorScheme } from "../store/useSettingsStore";
import { ChessBoardSettingsPanel } from "./ChessBoardSettingsPanel";

type Props = {
  onClose: () => void;
};

interface SettingsBackend {
  llm_provider: string;
  ollama_url: string;
  ollama_model: string;
  openai_api_key_set: boolean;
  openai_model: string;
  anthropic_api_key_set: boolean;
  anthropic_model: string;
  notebooklm_cookie?: string;
}

interface VerifyResult {
  status: "ok" | "warning" | "error";
  message: string;
  available_models?: string[];
  instructions?: string;
  package_installed?: boolean;
  authenticated?: boolean;
  account_email?: string | null;
  active_profile?: string;
  profiles?: NotebookLMProfile[];
  has_cookie?: boolean;
}

interface NotebookLMProfile {
  name: string;
  account: string;
  active: boolean;
  status: string;
}

interface NotebookLMStatus {
  authenticated: boolean;
  account_email: string | null;
  active_profile: string;
  profiles: NotebookLMProfile[];
  raw_output?: string;
}

export function SettingsDialog({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"llm" | "notebooklm" | "chessboard" | "graph">("llm");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Backend LLM settings state
  const [provider, setProvider] = useState("ollama");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("llama3.1:latest");
  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o-mini");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [anthropicModel, setAnthropicModel] = useState("claude-3-5-sonnet");

  // NotebookLM state
  const [notebooklmCookie, setNotebooklmCookie] = useState("");
  const [installingPackage, setInstallingPackage] = useState(false);
  const [installLog, setInstallLog] = useState<{ status: string; message: string; output?: string } | null>(null);
  const [notebookLMAuthInfo, setNotebookLMAuthInfo] = useState<NotebookLMStatus | null>(null);
  const [newProfileName, setNewProfileName] = useState("");
  const [loggingInProfile, setLoggingInProfile] = useState<string | null>(null);

  const [availableOllamaModels, setAvailableOllamaModels] = useState<string[]>([]);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  // UI Settings Store
  const {
    shapes,
    colorScheme,
    highlightColor,
    floatingTitleBarColor,
    fontFamily,
    setShape,
    setColorScheme,
    setHighlightColor,
    setFloatingTitleBarColor,
    setFontFamily,
  } = useSettingsStore();

  const fetchNotebookLMStatus = async () => {
    try {
      const data = await api.get<NotebookLMStatus>("/settings/notebooklm/status");
      setNotebookLMAuthInfo(data);
    } catch (e) {
      console.error("Failed to fetch NotebookLM status:", e);
    }
  };

  useEffect(() => {
    api.get<SettingsBackend>("/settings")
      .then((data) => {
        setProvider(data.llm_provider || "ollama");
        setOllamaUrl(data.ollama_url || "http://localhost:11434");
        setOllamaModel(data.ollama_model || "llama3.1:latest");
        setOpenaiModel(data.openai_model || "gpt-4o-mini");
        setAnthropicModel(data.anthropic_model || "claude-3-5-sonnet");
        setNotebooklmCookie(data.notebooklm_cookie || "");
      })
      .catch((e) => console.error("Failed to load settings:", e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === "notebooklm") {
      fetchNotebookLMStatus();
    }
  }, [activeTab]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await api.put("/settings", {
        llm_provider: provider,
        ollama_url: ollamaUrl,
        ollama_model: ollamaModel,
        openai_api_key: openaiKey || undefined,
        openai_model: openaiModel,
        anthropic_api_key: anthropicKey || undefined,
        anthropic_model: anthropicModel,
        notebooklm_cookie: notebooklmCookie || undefined,
      });
      onClose();
    } catch (e) {
      alert("Failed to save settings: " + String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleInstallPackage = async () => {
    setInstallingPackage(true);
    setInstallLog(null);
    try {
      const res = await api.post<{ status: string; message: string; output?: string }>("/settings/install-notebooklm-py");
      setInstallLog(res);

      const poll = setInterval(async () => {
        try {
          const statusRes = await api.get<{ status: string; message: string; output?: string }>("/settings/install-status");
          setInstallLog(statusRes);
          if (statusRes.status === "ok" || statusRes.status === "error") {
            clearInterval(poll);
            setInstallingPackage(false);
            await handleVerifyNotebookLM();
            await fetchNotebookLMStatus();
          }
        } catch (err) {
          console.error("Polling install status error:", err);
        }
      }, 1000);
    } catch (e: any) {
      setInstallLog({
        status: "error",
        message: "Failed to trigger package installation: " + String(e),
      });
      setInstallingPackage(false);
    }
  };

  const handleLaunchLogin = async (profileName?: string) => {
    setLoggingInProfile(profileName || "default");
    try {
      await api.post("/settings/notebooklm/login", { profile_name: profileName });
      alert(`Chrome browser login launched for profile '${profileName || "default"}'. Please complete Google Sign-In in the opened Chrome browser window.`);
    } catch (e: any) {
      alert("Failed to launch browser login: " + String(e));
    } finally {
      setLoggingInProfile(null);
      setTimeout(() => fetchNotebookLMStatus(), 3000);
    }
  };

  const handleSwitchProfile = async (profileName: string) => {
    try {
      const res = await api.post<NotebookLMStatus>("/settings/notebooklm/switch-profile", { profile_name: profileName });
      setNotebookLMAuthInfo(res);
    } catch (e: any) {
      alert("Failed to switch profile: " + String(e));
    }
  };

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) return;
    try {
      const res = await api.post<NotebookLMStatus>("/settings/notebooklm/create-profile", { profile_name: newProfileName.trim() });
      setNotebookLMAuthInfo(res);
      setNewProfileName("");
    } catch (e: any) {
      alert("Failed to create profile: " + String(e));
    }
  };

  const handleDeleteProfile = async (profileName: string) => {
    if (!confirm(`Are you sure you want to delete profile '${profileName}'?`)) return;
    try {
      const res = await api.post<NotebookLMStatus>("/settings/notebooklm/delete-profile", { profile_name: profileName });
      setNotebookLMAuthInfo(res);
    } catch (e: any) {
      alert("Failed to delete profile: " + String(e));
    }
  };

  const handleVerifyLLM = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await api.post<VerifyResult>("/settings/verify-llm", {
        provider,
        ollama_url: ollamaUrl,
        ollama_model: ollamaModel,
        openai_api_key: openaiKey || undefined,
        openai_model: openaiModel,
        anthropic_api_key: anthropicKey || undefined,
        anthropic_model: anthropicModel,
      });
      setVerifyResult(res);
      if (res.available_models && res.available_models.length > 0) {
        setAvailableOllamaModels(res.available_models);
      }
    } catch (e: any) {
      setVerifyResult({
        status: "error",
        message: "Failed to verify connection: " + String(e),
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyNotebookLM = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await api.post<VerifyResult>("/settings/verify-notebooklm");
      setVerifyResult(res);
      if (res.profiles) {
        setNotebookLMAuthInfo({
          authenticated: res.authenticated || false,
          account_email: res.account_email || null,
          active_profile: res.active_profile || "default",
          profiles: res.profiles,
        });
      }
    } catch (e: any) {
      setVerifyResult({
        status: "error",
        message: "Failed to verify NotebookLM connection: " + String(e),
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-gray-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between bg-gray-850">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-blue-400">⚙ Settings & Preferences</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white px-2 py-1 rounded text-sm font-semibold"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-700 bg-gray-800/60 px-6 gap-2">
          <button
            onClick={() => { setActiveTab("llm"); setVerifyResult(null); }}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "llm"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            🤖 LLM & AI Providers
          </button>
          <button
            onClick={() => { setActiveTab("notebooklm"); setVerifyResult(null); }}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "notebooklm"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            📓 NotebookLM Integration
          </button>
          <button
            onClick={() => { setActiveTab("chessboard"); setVerifyResult(null); }}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "chessboard"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            ♟️ Board & Sound Effects
          </button>
          <button
            onClick={() => { setActiveTab("graph"); setVerifyResult(null); }}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "graph"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            🎨 Graph & Appearance
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="text-gray-400 text-sm flex items-center justify-center py-10">
              Loading configuration...
            </div>
          )}

          {!loading && activeTab === "chessboard" && (
            <ChessBoardSettingsPanel />
          )}

          {!loading && activeTab === "llm" && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Active Provider
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "ollama", name: "Ollama (Local)", icon: "🦙" },
                    { id: "openai", name: "OpenAI", icon: "🌐" },
                    { id: "anthropic", name: "Anthropic Claude", icon: "🧠" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProvider(p.id)}
                      className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                        provider === p.id
                          ? "border-blue-500 bg-blue-950/40 text-blue-200"
                          : "border-gray-700 bg-gray-800/40 text-gray-400 hover:border-gray-600"
                      }`}
                    >
                      <span className="text-lg">{p.icon}</span>
                      <span className="text-xs font-bold">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {provider === "ollama" && (
                <div className="bg-gray-800/60 p-4 rounded-lg border border-gray-700 space-y-4">
                  <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wide">
                    Ollama Local Server Settings
                  </h4>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Server URL</label>
                    <input
                      type="text"
                      value={ollamaUrl}
                      onChange={(e) => setOllamaUrl(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
                      placeholder="http://localhost:11434"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Target Model</label>
                    <div className="flex gap-2">
                      {availableOllamaModels.length > 0 ? (
                        <select
                          value={ollamaModel}
                          onChange={(e) => setOllamaModel(e.target.value)}
                          className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                        >
                          {availableOllamaModels.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={ollamaModel}
                          onChange={(e) => setOllamaModel(e.target.value)}
                          className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
                          placeholder="llama3.1:latest"
                        />
                      )}
                      <button
                        type="button"
                        onClick={handleVerifyLLM}
                        disabled={verifying}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-xs text-gray-200 rounded border border-gray-600 shrink-0"
                      >
                        {verifying ? "Checking..." : "Fetch Models 🔄"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {provider === "openai" && (
                <div className="bg-gray-800/60 p-4 rounded-lg border border-gray-700 space-y-4">
                  <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wide">
                    OpenAI Cloud API Settings
                  </h4>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">API Key</label>
                    <input
                      type="password"
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
                      placeholder="sk-..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Model Name</label>
                    <input
                      type="text"
                      value={openaiModel}
                      onChange={(e) => setOpenaiModel(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
                      placeholder="gpt-4o-mini"
                    />
                  </div>
                </div>
              )}

              {provider === "anthropic" && (
                <div className="bg-gray-800/60 p-4 rounded-lg border border-gray-700 space-y-4">
                  <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wide">
                    Anthropic Claude Settings
                  </h4>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">API Key</label>
                    <input
                      type="password"
                      value={anthropicKey}
                      onChange={(e) => setAnthropicKey(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
                      placeholder="sk-ant-..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Model Name</label>
                    <input
                      type="text"
                      value={anthropicModel}
                      onChange={(e) => setAnthropicModel(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
                      placeholder="claude-3-5-sonnet"
                    />
                  </div>
                </div>
              )}

              {/* Verify Connection Button */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleVerifyLLM}
                  disabled={verifying}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded text-xs font-semibold transition-colors flex items-center gap-2"
                >
                  {verifying ? "Verifying..." : "⚡ Verify LLM Connection"}
                </button>
              </div>

              {/* Verification Result Banner & Instructions */}
              {verifyResult && (
                <div
                  className={`p-4 rounded-lg text-xs space-y-2 border ${
                    verifyResult.status === "ok"
                      ? "bg-green-950/40 border-green-700 text-green-200"
                      : verifyResult.status === "warning"
                      ? "bg-amber-950/40 border-amber-700 text-amber-200"
                      : "bg-red-950/40 border-red-700 text-red-200"
                  }`}
                >
                  <div className="font-bold text-sm flex items-center gap-2">
                    <span>
                      {verifyResult.status === "ok"
                        ? "✅ Connection Verified!"
                        : verifyResult.status === "warning"
                        ? "⚠️ Model Missing"
                        : "❌ Connection Failed"}
                    </span>
                  </div>
                  <p>{verifyResult.message}</p>
                  {verifyResult.instructions && (
                    <div className="mt-2 pt-2 border-t border-gray-700/50">
                      <span className="font-semibold text-gray-300 block mb-1">Setup Instructions:</span>
                      <pre className="bg-gray-950 p-2.5 rounded font-mono text-[11px] whitespace-pre-wrap text-gray-300 border border-gray-800">
                        {verifyResult.instructions}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!loading && activeTab === "notebooklm" && (
            <div className="space-y-5">
              {/* Step 1: Package Installer */}
              <div className="bg-gray-800/60 p-4 rounded-lg border border-gray-700 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wide flex items-center gap-2">
                    <span>1. Python Package Auto-Installation</span>
                    {verifyResult?.package_installed ? (
                      <span className="bg-emerald-900/80 text-emerald-200 text-[10px] px-2 py-0.5 rounded font-mono">Installed ✅</span>
                    ) : (
                      <span className="bg-amber-900/80 text-amber-200 text-[10px] px-2 py-0.5 rounded font-mono">Not Installed ⚠️</span>
                    )}
                  </h4>
                  <button
                    type="button"
                    onClick={handleInstallPackage}
                    disabled={installingPackage}
                    className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5"
                  >
                    {installingPackage ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Installing notebooklm-py...
                      </>
                    ) : (
                      "📦 Install notebooklm-py in VEnv"
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Automatically runs <code className="bg-gray-900 px-1 py-0.5 rounded text-purple-300">pip install notebooklm-py</code> inside the backend virtual environment.
                </p>

                {installLog && (
                  <div className={`p-3 rounded text-xs border font-mono ${installLog.status === "ok" ? "bg-emerald-950/40 border-emerald-800 text-emerald-200" : "bg-red-950/40 border-red-800 text-red-200"}`}>
                    <div className="font-bold mb-1">{installLog.message}</div>
                    {installLog.output && (
                      <pre className="text-[10px] opacity-80 whitespace-pre-wrap max-h-32 overflow-y-auto bg-gray-950 p-2 rounded">
                        {installLog.output}
                      </pre>
                    )}
                  </div>
                )}
              </div>

              {/* Step 2: Account & Profile Management */}
              <div className="bg-gray-800/60 p-4 rounded-lg border border-gray-700 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wide flex items-center gap-2">
                    <span>2. Google Account & Profile Manager</span>
                  </h4>
                  {notebookLMAuthInfo?.account_email && (
                    <span className="bg-blue-950 border border-blue-700 text-blue-300 text-[11px] px-2.5 py-0.5 rounded-full font-mono">
                      👤 {notebookLMAuthInfo.account_email}
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-400 leading-relaxed">
                  <code className="bg-gray-900 px-1 text-purple-300">notebooklm-py</code> supports managing isolated Google Account profiles. You can target any Google Account without changing your primary Chrome user.
                </p>

                {/* Account Profiles Table */}
                {notebookLMAuthInfo && notebookLMAuthInfo.profiles && notebookLMAuthInfo.profiles.length > 0 && (
                  <div className="border border-gray-700 rounded-lg overflow-hidden bg-gray-900/60">
                    <table className="w-full text-left text-xs text-gray-300">
                      <thead className="bg-gray-800 text-gray-400 uppercase text-[10px]">
                        <tr>
                          <th className="px-3 py-2">Profile</th>
                          <th className="px-3 py-2">Signed-In Account</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800 font-mono text-[11px]">
                        {notebookLMAuthInfo.profiles.map((p) => (
                          <tr key={p.name} className={p.active ? "bg-blue-950/30" : "hover:bg-gray-800/40"}>
                            <td className="px-3 py-2 font-bold text-gray-200 flex items-center gap-1.5">
                              {p.active ? (
                                <span className="text-emerald-400" title="Active Profile">★</span>
                              ) : (
                                <span className="text-gray-600">☆</span>
                              )}
                              {p.name}
                            </td>
                            <td className="px-3 py-2 text-gray-300">{p.account !== "-" ? p.account : <span className="text-gray-500">Not logged in</span>}</td>
                            <td className="px-3 py-2">
                              {p.status.toLowerCase().includes("valid") || p.status.includes("✓") ? (
                                <span className="text-emerald-400">Authenticated</span>
                              ) : (
                                <span className="text-amber-400">{p.status}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right space-x-1.5">
                              {!p.active && (
                                <button
                                  type="button"
                                  onClick={() => handleSwitchProfile(p.name)}
                                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-[10px]"
                                >
                                  Switch
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleLaunchLogin(p.name)}
                                disabled={loggingInProfile === p.name}
                                className="px-2 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded text-[10px]"
                              >
                                {loggingInProfile === p.name ? "Opening..." : "🌐 Google Login"}
                              </button>
                              {p.name !== "default" && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProfile(p.name)}
                                  className="px-2 py-1 bg-red-900/60 hover:bg-red-800 text-red-200 rounded text-[10px]"
                                >
                                  Delete
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Create Profile Form */}
                <div className="flex gap-2 items-center pt-1">
                  <input
                    type="text"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    placeholder="New profile name (e.g. work_account)..."
                    className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleCreateProfile}
                    disabled={!newProfileName.trim()}
                    className="px-3 py-1.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white rounded text-xs font-semibold shrink-0"
                  >
                    + Create Profile
                  </button>
                </div>

                {/* Fallback manual cookie string input */}
                <details className="text-xs bg-gray-900/60 p-3 rounded border border-gray-700/60 text-gray-300 space-y-2">
                  <summary className="font-semibold text-purple-300 cursor-pointer hover:underline">
                    🔑 Manual Cookie String Setup (Alternative to CLI Login)
                  </summary>
                  <div className="space-y-2 pt-2">
                    <textarea
                      value={notebooklmCookie}
                      onChange={(e) => setNotebooklmCookie(e.target.value)}
                      rows={2}
                      placeholder="Paste SID, HSID, SSID cookie values or raw cookie header here..."
                      className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-purple-500"
                    />
                    <p className="text-[11px] text-gray-400">
                      Copy SID, HSID, and SSID cookies from DevTools (F12) → Application → Cookies → notebooklm.google.com.
                    </p>
                  </div>
                </details>
              </div>

              {/* Step 3: Verification & Test */}
              <div className="bg-gray-800/60 p-4 rounded-lg border border-gray-700 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wide">
                    3. Service Verification
                  </h4>
                  <button
                    type="button"
                    onClick={handleVerifyNotebookLM}
                    disabled={verifying}
                    className="px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white rounded text-xs font-semibold transition-colors"
                  >
                    {verifying ? "Checking..." : "⚡ Verify NotebookLM Service"}
                  </button>
                </div>
              </div>

              {verifyResult && (
                <div className="p-4 rounded-lg text-xs space-y-2 border bg-blue-950/40 border-blue-700 text-blue-200">
                  <div className="font-bold text-sm">ℹ NotebookLM Connection Status</div>
                  <p>{verifyResult.message}</p>
                  {verifyResult.instructions && (
                    <pre className="bg-gray-950 p-2.5 rounded font-mono text-[11px] whitespace-pre-wrap text-gray-300 border border-gray-800 mt-2">
                      {verifyResult.instructions}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          {!loading && activeTab === "graph" && (
            <div className="space-y-6">
              {/* Item Shapes */}
              <div className="bg-gray-800/60 p-4 rounded-lg border border-gray-700 space-y-4">
                <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wide">
                  Graph Node Shapes per Item Type
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: "pdf", label: "PDF Documents" },
                    { id: "note", label: "Notes & Summaries" },
                    { id: "latex", label: "LaTeX Equations" },
                    { id: "scratch-pad", label: "ScratchPad Notes" },
                    { id: "notebook", label: "NotebookLM Instances" },
                  ].map((itemType) => (
                    <div key={itemType.id} className="flex flex-col gap-1">
                      <label className="text-xs text-gray-400">{itemType.label}</label>
                      <select
                        value={shapes[itemType.id] || "circle"}
                        onChange={(e) => setShape(itemType.id, e.target.value as NodeShape)}
                        className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                      >
                        <option value="circle">Circle (●)</option>
                        <option value="rounded-rect">Rounded Rectangle (■)</option>
                        <option value="rect">Rectangle (█)</option>
                        <option value="hexagon">Hexagon (⬡)</option>
                        <option value="diamond">Diamond (◆)</option>
                        <option value="octagon">Octagon (🛑)</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Color Scheme */}
              <div className="bg-gray-800/60 p-4 rounded-lg border border-gray-700 space-y-4">
                <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wide">
                  Progression Color Palette
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "classic", name: "Classic (Red → Green)", sample: "hsl(0,70%,45%) → hsl(120,70%,45%)" },
                    { id: "cyber", name: "Neon Cyber (Purple → Cyan)", sample: "hsl(270,85%,55%) → hsl(180,85%,55%)" },
                    { id: "sunset", name: "Sunset (Deep Red → Gold)", sample: "hsl(0,90%,50%) → hsl(45,90%,50%)" },
                    { id: "emerald", name: "Emerald Gradient", sample: "hsl(150,75%,30%) → hsl(150,75%,65%)" },
                  ].map((scheme) => (
                    <button
                      key={scheme.id}
                      type="button"
                      onClick={() => setColorScheme(scheme.id as ColorScheme)}
                      className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                        colorScheme === scheme.id
                          ? "border-blue-500 bg-blue-950/40 text-blue-200"
                          : "border-gray-700 bg-gray-900/40 text-gray-400 hover:border-gray-600"
                      }`}
                    >
                      <span className="text-xs font-bold">{scheme.name}</span>
                      <span className="text-[10px] text-gray-500">{scheme.sample}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Highlight Flash Color */}
              <div className="bg-gray-800/60 p-4 rounded-lg border border-gray-700 space-y-3">
                <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wide">
                  Highlight Ring Color
                </h4>
                <div className="flex gap-3">
                  {[
                    { color: "#eab308", name: "Gold" },
                    { color: "#06b6d4", name: "Cyan" },
                    { color: "#ec4899", name: "Pink" },
                    { color: "#10b981", name: "Emerald" },
                    { color: "#3b82f6", name: "Blue" },
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => setHighlightColor(c.color)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                        highlightColor === c.color
                          ? "border-white bg-gray-700 text-white font-bold"
                          : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600"
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0 border border-gray-600"
                        style={{ backgroundColor: c.color }}
                      />
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Floating Window Title Bar Color */}
              <div className="bg-gray-800/60 p-4 rounded-lg border border-gray-700 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wide flex items-center gap-2">
                    <span>🖼️ Floating Window Title Bar Color</span>
                  </h4>
                  <span className="text-[10px] text-gray-400">Makes floated panes pop out against dark background</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    { color: "#2563eb", name: "Vibrant Blue" },
                    { color: "#7c3aed", name: "Purple Cyber" },
                    { color: "#059669", name: "Emerald Green" },
                    { color: "#e11d48", name: "Rose Crimson" },
                    { color: "#d97706", name: "Amber Gold" },
                    { color: "#0284c7", name: "Sky Cyan" },
                    { color: "#334155", name: "Slate Dark" },
                    { color: "#1e1b4b", name: "Midnight" },
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => setFloatingTitleBarColor(c.color)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                        floatingTitleBarColor.toLowerCase() === c.color.toLowerCase()
                          ? "border-white bg-gray-700 text-white font-bold shadow-md"
                          : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600"
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 border border-gray-600 shadow-sm"
                        style={{ backgroundColor: c.color }}
                      />
                      {c.name}
                    </button>
                  ))}
                </div>

                {/* Custom Hex Color Picker */}
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-xs text-gray-400 font-medium">Custom Color:</span>
                  <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg p-1.5">
                    <input
                      type="color"
                      value={floatingTitleBarColor.startsWith("#") && floatingTitleBarColor.length === 7 ? floatingTitleBarColor : "#2563eb"}
                      onChange={(e) => setFloatingTitleBarColor(e.target.value)}
                      className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={floatingTitleBarColor}
                      onChange={(e) => setFloatingTitleBarColor(e.target.value)}
                      placeholder="#2563eb"
                      className="w-24 bg-transparent border-0 text-xs font-mono text-gray-200 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Live Preview Box */}
                <div className="mt-2 border border-gray-700 rounded-lg overflow-hidden bg-gray-900 shadow-lg text-xs">
                  <div
                    style={{ backgroundColor: floatingTitleBarColor }}
                    className="px-3 py-2 flex items-center justify-between font-semibold text-white transition-colors border-b border-black/20"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2 h-2 rounded-full bg-white opacity-80" />
                      <span className="truncate">Floating Window Title Bar Preview</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[10px]">
                      <span className="px-1.5 py-0.5 bg-black/20 rounded">─</span>
                      <span className="px-1.5 py-0.5 bg-black/20 rounded">□</span>
                      <span className="px-2 py-0.5 bg-blue-700 text-white rounded font-medium">Dock</span>
                    </div>
                  </div>
                  <div className="p-3 text-[11px] text-gray-400 bg-gray-900/90 italic">
                    Floated pane content preview...
                  </div>
                </div>
              </div>

              {/* Font Family */}
              <div className="bg-gray-800/60 p-4 rounded-lg border border-gray-700 space-y-3">
                <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wide">
                  Application & Graph Font Family
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "system", name: "System Sans-Serif", style: "font-sans" },
                    { id: "inter", name: "Inter / Modern", style: "font-sans" },
                    { id: "roboto", name: "Roboto", style: "font-sans" },
                    { id: "code", name: "JetBrains Code / Mono", style: "font-mono" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFontFamily(f.id)}
                      className={`p-3 rounded-lg border text-left text-xs transition-all ${f.style} ${
                        fontFamily === f.id
                          ? "border-blue-500 bg-blue-950/40 text-blue-200 font-bold"
                          : "border-gray-700 bg-gray-900/40 text-gray-400 hover:border-gray-600"
                      }`}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 bg-gray-850 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded text-xs text-gray-300 hover:bg-gray-800 border border-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={saving}
            className="px-5 py-2 rounded text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
