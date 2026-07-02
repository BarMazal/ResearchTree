import { useState, useRef, useEffect } from "react";

type Props = {
  onSubmit: (data: { title: string; type: string; file_path?: string; source_url?: string }) => void;
  onClose: () => void;
  initialType?: string;
  initialTitle?: string;
};

const ITEM_TYPES = ["pdf", "article", "note", "video", "link", "repo", "idea", "scratch-pad", "latex"];

export function AddItemDialog({ onSubmit, onClose, initialType = "pdf", initialTitle = "" }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [type, setType] = useState(initialType);
  const [filePath, setFilePath] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setType(initialType);
  }, [initialType]);

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

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
    const data: { title: string; type: string; file_path?: string; source_url?: string } = {
      title: title || (filePath || sourceUrl ? (filePath || sourceUrl).split(/[/\\]/).pop() || "Untitled" : "Untitled"),
      type,
    };
    if (filePath) data.file_path = filePath;
    if (sourceUrl) data.source_url = sourceUrl;
    onSubmit(data);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 border border-gray-600 rounded-lg shadow-xl w-96 p-4">
        <h3 className="text-base font-semibold mb-3">Add item</h3>

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
              placeholder="Optional — defaults to filename"
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
            >
              {ITEM_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

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
            className="px-3 py-1.5 rounded text-sm bg-blue-600 hover:bg-blue-500"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
