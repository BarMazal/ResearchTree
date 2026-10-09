import { useEffect, useState } from "react";
import type { ItemData } from "../../store/useGraphStore";
import { api } from "../../api/client";

export interface AISummaryPayload {
  __ai_summary__: boolean;
  status: "pending" | "done" | "error";
  prompt: string;
  context?: string | null;
  result: string;
  error?: string | null;
}

type Props = {
  resource: ItemData;
  payload: AISummaryPayload;
  onUpdate: (id: string, data: Partial<ItemData>) => void;
};

export function LLMSummaryCard({ resource, payload, onUpdate }: Props) {
  const [prompt, setPrompt] = useState(payload.prompt || "");
  const [status, setStatus] = useState<"pending" | "done" | "error">(payload.status);
  const [result, setResult] = useState(payload.result || "");
  const [errorMsg, setErrorMsg] = useState(payload.error || "");
  const [submitting, setSubmitting] = useState(false);

  // Sync state when props change
  useEffect(() => {
    setPrompt(payload.prompt || "");
    setStatus(payload.status);
    setResult(payload.result || "");
    setErrorMsg(payload.error || "");
  }, [payload.prompt, payload.status, payload.result, payload.error, resource.id]);

  // Polling mechanism while status === "pending"
  useEffect(() => {
    if (status !== "pending") return;

    const interval = setInterval(async () => {
      try {
        const item = await api.get<ItemData>(`/items/${resource.id}`);
        if (!item.summary) return;

        try {
          const parsed: AISummaryPayload = JSON.parse(item.summary);
          if (parsed && parsed.__ai_summary__) {
            setStatus(parsed.status);
            setResult(parsed.result || "");
            setErrorMsg(parsed.error || "");
            onUpdate(resource.id, { summary: item.summary });
          }
        } catch {
          // Summary converted or invalid JSON
        }
      } catch (err) {
        console.error("Polling item summary error:", err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [status, resource.id, onUpdate]);

  const handleResend = async () => {
    if (!prompt.trim() || submitting) return;
    setSubmitting(true);
    try {
      setStatus("pending");
      setResult("");
      setErrorMsg("");

      const updatedItem = await api.post<ItemData>("/llm/regenerate", {
        item_id: resource.id,
        prompt: prompt.trim(),
        context: payload.context,
      });

      onUpdate(resource.id, { summary: updatedItem.summary });
    } catch (e: any) {
      console.error("Regenerate summary failed:", e);
      setStatus("error");
      setErrorMsg(e.message || "Failed to trigger summary generation.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccept = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const updatedItem = await api.post<ItemData>("/llm/accept-summary", {
        item_id: resource.id,
      });
      onUpdate(resource.id, { summary: updatedItem.summary });
    } catch (e: any) {
      console.error("Accept summary failed:", e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-purple-950/20 border border-purple-800/40 rounded-lg p-3.5 flex flex-col gap-3">
      {/* Header badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
          <span className="text-base">🤖</span> AI Summary Generation
        </div>
        <span
          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
            status === "pending"
              ? "bg-amber-900/60 text-amber-200 animate-pulse"
              : status === "done"
              ? "bg-emerald-900/60 text-emerald-200"
              : "bg-red-900/60 text-red-200"
          }`}
        >
          {status === "pending" ? "Generating..." : status === "done" ? "Ready" : "Error"}
        </span>
      </div>

      {/* Prompt Section */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-400 font-medium flex items-center justify-between">
          <span>Prompt Sent to LLM</span>
          <span className="text-[10px] text-gray-500">(editable)</span>
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          disabled={status === "pending" || submitting}
          className="w-full bg-gray-900/90 border border-gray-700/80 rounded px-2.5 py-1.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-purple-500 disabled:opacity-60 resize-y"
          placeholder="Enter prompt to summarize..."
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleResend}
            disabled={status === "pending" || submitting || !prompt.trim()}
            className="bg-purple-900/80 hover:bg-purple-800 text-purple-200 disabled:opacity-40 text-xs px-2.5 py-1 rounded font-medium flex items-center gap-1 transition-colors"
          >
            🔄 {status === "pending" ? "Generating..." : "Resend / Regenerate"}
          </button>
        </div>
      </div>

      {/* Dynamic Content Body based on status */}
      {status === "pending" && (
        <div className="bg-gray-900/60 border border-purple-900/30 rounded p-4 flex flex-col items-center justify-center gap-2 text-center py-6">
          <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium text-purple-300 animate-pulse">
            Generating summary via Ollama...
          </span>
          <span className="text-[11px] text-gray-400">
            You can keep working in ResearchTree while generation completes in background.
          </span>
        </div>
      )}

      {status === "error" && (
        <div className="bg-red-950/30 border border-red-900/50 rounded p-3 text-xs text-red-200 flex flex-col gap-2">
          <div className="font-semibold text-red-300">Generation Failed</div>
          <p className="text-red-400 font-mono text-[11px] bg-gray-900/80 p-2 rounded">
            {errorMsg || "An unknown error occurred during generation."}
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleResend}
              disabled={submitting}
              className="bg-red-900/80 hover:bg-red-800 text-red-100 text-xs px-2.5 py-1 rounded font-medium transition-colors"
            >
              🔄 Retry
            </button>
          </div>
        </div>
      )}

      {status === "done" && (
        <div className="flex flex-col gap-2.5">
          <label className="text-xs text-gray-400 font-medium">Generated Summary</label>
          <div className="bg-gray-900/90 border border-gray-700/80 rounded p-3 text-xs text-gray-200 whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed">
            {result}
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-purple-900/30">
            <span className="text-[11px] text-gray-400 italic">
              Review and click Accept to save summary.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResend}
                disabled={submitting}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded font-medium transition-colors"
              >
                🔄 Retry
              </button>
              <button
                type="button"
                onClick={handleAccept}
                disabled={submitting}
                className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs px-3.5 py-1.5 rounded font-medium shadow transition-colors flex items-center gap-1"
              >
                ✓ Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
