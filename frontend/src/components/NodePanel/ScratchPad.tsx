import { useEffect, useMemo, useRef, useState, useCallback, useLayoutEffect, type PointerEvent as ReactPointerEvent } from "react";
import type { ItemData } from "../../store/useGraphStore";
import { api } from "../../api/client";

type Props = {
  resource: ItemData;
  onUpdate: (id: string, data: Partial<ItemData>) => void;
};

type Point = { x: number; y: number };
type CanvasSize = { width: number; height: number };
type ExpandDirection = "left" | "right" | "top" | "bottom";
type SaveTarget = { id: string; title: string };

const DEFAULT_CANVAS_WIDTH = 1400;
const DEFAULT_CANVAS_HEIGHT = 900;
const EXPAND_STEP = 320;
const MIN_ZOOM_PERCENT = 10;
const MAX_ZOOM_PERCENT = 800;

export function ScratchPad({ resource, onUpdate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const mountedRef = useRef(true);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const baseMaxDimensionRef = useRef(Math.max(DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT));

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const [brushSize, setBrushSize] = useState(3);
  const [penColor, setPenColor] = useState("#111827");
  const [eraserEnabled, setEraserEnabled] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({
    width: DEFAULT_CANVAS_WIDTH,
    height: DEFAULT_CANVAS_HEIGHT,
  });

  const fileUrl = useMemo(() => {
    if (!resource.file_path) return null;
    return `/api/items/${resource.id}/file?rev=${encodeURIComponent(resource.file_path)}&v=${loadVersion}`;
  }, [resource.file_path, resource.id, loadVersion]);

  useEffect(() => {
    setLoadVersion(0);
    setSaveError(null);
  }, [resource.id]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const resizeCanvas = useCallback((nextWidth: number, nextHeight: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = Math.max(1, Math.floor(nextWidth));
    const height = Math.max(1, Math.floor(nextHeight));
    if (canvas.width === width && canvas.height === height) return;

    const snapshot = document.createElement("canvas");
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    const snapshotCtx = snapshot.getContext("2d");
    if (snapshotCtx && canvas.width > 0 && canvas.height > 0) {
      snapshotCtx.drawImage(canvas, 0, 0);
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, width, height);
    if (snapshot.width > 0 && snapshot.height > 0) {
      ctx.drawImage(snapshot, 0, 0);
    }

    setCanvasSize({ width, height });
  }, []);

  const markDirty = () => {
    dirtyRef.current = true;
  };

  const exportCanvasBlob = async (sourceCanvas: HTMLCanvasElement) => {
    return new Promise<Blob | null>((resolve) => sourceCanvas.toBlob(resolve, "image/png"));
  };

  const uploadCanvasBlob = useCallback(async (
    blob: Blob,
    target: SaveTarget,
    options?: { updateLoadVersion?: boolean; setBusy?: boolean }
  ) => {
    const updateLoadVersion = options?.updateLoadVersion ?? false;
    const setBusy = options?.setBusy ?? false;

    if (setBusy && mountedRef.current) {
      setSaving(true);
    }
    setSaveError(null);

    try {
      const form = new FormData();
      form.append("file", new File([blob], `${target.title || target.id}.png`, { type: "image/png" }));
      const uploaded = await fetch("/api/upload", { method: "POST", body: form });
      if (!uploaded.ok) throw new Error(await uploaded.text());
      const data = await uploaded.json();

      await api.put(`/items/${target.id}`, { file_path: data.file_path });
      onUpdate(target.id, { file_path: data.file_path });
      if (updateLoadVersion && mountedRef.current) {
        setLoadVersion((prev) => prev + 1);
      }
      dirtyRef.current = false;
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save scratchpad image";
      if (mountedRef.current) {
        setSaveError(message);
      }
      return false;
    } finally {
      if (setBusy && mountedRef.current) {
        setSaving(false);
      }
    }
  }, [onUpdate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!fileUrl) {
      resizeCanvas(DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT);
      baseMaxDimensionRef.current = Math.max(DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT);
      setZoomPercent(100);
      const nextCtx = canvas.getContext("2d");
      if (!nextCtx) return;
      nextCtx.fillStyle = "#f8fafc";
      nextCtx.fillRect(0, 0, canvas.width, canvas.height);
      dirtyRef.current = false;
      return;
    }

    const img = new Image();
    img.onload = () => {
      const width = Math.max(1, img.naturalWidth || DEFAULT_CANVAS_WIDTH);
      const height = Math.max(1, img.naturalHeight || DEFAULT_CANVAS_HEIGHT);
      resizeCanvas(width, height);
      baseMaxDimensionRef.current = Math.max(width, height);
      setZoomPercent(100);
      const nextCtx = canvas.getContext("2d");
      if (!nextCtx) return;
      nextCtx.fillStyle = "#f8fafc";
      nextCtx.fillRect(0, 0, canvas.width, canvas.height);
      nextCtx.drawImage(img, 0, 0);
      dirtyRef.current = false;
    };
    img.src = fileUrl;
  }, [fileUrl, resizeCanvas]);

  const getPoint = (event: ReactPointerEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const drawLine = (from: Point, to: Point) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const currentMaxDimension = Math.max(canvas.width, canvas.height);
    const effectiveZoom = (zoomPercent / 100) * (baseMaxDimensionRef.current / currentMaxDimension);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = eraserEnabled ? "#f8fafc" : penColor;
    ctx.lineWidth = Math.max(1, brushSize / effectiveZoom);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = getPoint(event);
    if (!point) return;
    drawingRef.current = true;
    lastPointRef.current = point;
    (event.currentTarget as HTMLCanvasElement).setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const point = getPoint(event);
    const lastPoint = lastPointRef.current;
    if (!point || !lastPoint) return;
    drawLine(lastPoint, point);
    markDirty();
    lastPointRef.current = point;
  };

  const stopDrawing = () => {
    drawingRef.current = false;
    lastPointRef.current = null;
  };

  const save = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || savingRef.current) return;
    savingRef.current = true;

    try {
      const blob = await exportCanvasBlob(canvas);
      if (!blob) {
        if (mountedRef.current) {
          setSaveError("Canvas export failed");
        }
        return;
      }
      await uploadCanvasBlob(blob, { id: resource.id, title: resource.title || resource.id }, {
        updateLoadVersion: true,
        setBusy: true,
      });
    } finally {
      savingRef.current = false;
    }
  }, [resource.id, resource.title, uploadCanvasBlob]);

  useLayoutEffect(() => {
    return () => {
      if (!dirtyRef.current) return;
      const liveCanvas = canvasRef.current;
      if (!liveCanvas) return;

      const snapshot = document.createElement("canvas");
      snapshot.width = liveCanvas.width;
      snapshot.height = liveCanvas.height;
      const snapshotCtx = snapshot.getContext("2d");
      if (!snapshotCtx) return;
      snapshotCtx.drawImage(liveCanvas, 0, 0);

      const target: SaveTarget = { id: resource.id, title: resource.title || resource.id };
      void exportCanvasBlob(snapshot)
        .then((blob) => {
          if (!blob) return;
          return uploadCanvasBlob(blob, target, { updateLoadVersion: false, setBusy: false });
        })
        .catch(() => {
          // autosave errors are surfaced in component state when mounted
        });
    };
  }, [resource.id, resource.title, uploadCanvasBlob]);

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    markDirty();
  };

  const expandCanvas = (direction: ExpandDirection) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const oldWidth = canvas.width;
    const oldHeight = canvas.height;
    const oldMax = Math.max(oldWidth, oldHeight);
    const nextWidth = oldWidth + (direction === "left" || direction === "right" ? EXPAND_STEP : 0);
    const nextHeight = oldHeight + (direction === "top" || direction === "bottom" ? EXPAND_STEP : 0);
    const nextMax = Math.max(nextWidth, nextHeight);

    const snapshot = document.createElement("canvas");
    snapshot.width = oldWidth;
    snapshot.height = oldHeight;
    const snapshotCtx = snapshot.getContext("2d");
    if (!snapshotCtx) return;
    snapshotCtx.drawImage(canvas, 0, 0);

    canvas.width = nextWidth;
    canvas.height = nextHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, nextWidth, nextHeight);

    const offsetX = direction === "left" ? EXPAND_STEP : 0;
    const offsetY = direction === "top" ? EXPAND_STEP : 0;
    ctx.drawImage(snapshot, offsetX, offsetY);

    setCanvasSize({ width: nextWidth, height: nextHeight });
    markDirty();
    setZoomPercent((prev) => {
      const next = prev * (nextMax / oldMax);
      return Math.min(MAX_ZOOM_PERCENT, Math.max(MIN_ZOOM_PERCENT, Number(next.toFixed(2))));
    });

    const viewport = viewportRef.current;
    if (!viewport) return;
    const effectiveZoom = (zoomPercent / 100) * (baseMaxDimensionRef.current / nextMax);
    if (direction === "left") {
      viewport.scrollLeft += EXPAND_STEP * effectiveZoom;
    } else if (direction === "top") {
      viewport.scrollTop += EXPAND_STEP * effectiveZoom;
    }
  };

  const zoomIn = () => {
    setZoomPercent((prev) => Math.min(MAX_ZOOM_PERCENT, Number((prev * 1.25).toFixed(2))));
  };

  const zoomOut = () => {
    setZoomPercent((prev) => Math.max(MIN_ZOOM_PERCENT, Number((prev / 1.25).toFixed(2))));
  };

  const resetZoom = () => {
    setZoomPercent(100);
  };

  const decreaseBrushSize = () => {
    setBrushSize((prev) => Math.max(1, prev - 1));
  };

  const increaseBrushSize = () => {
    setBrushSize((prev) => Math.min(30, prev + 1));
  };

  const currentMaxDimension = Math.max(canvasSize.width, canvasSize.height);
  const effectiveZoom = (zoomPercent / 100) * (baseMaxDimensionRef.current / currentMaxDimension);
  const displayWidth = canvasSize.width * effectiveZoom;
  const displayHeight = canvasSize.height * effectiveZoom;

  const canvasContainerStyle = {
    width: `${displayWidth}px`,
    height: `${displayHeight}px`,
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3 p-3 bg-gray-900/60">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs uppercase tracking-wider text-gray-500">Scratch Pad</span>

        <button
          type="button"
          className={`px-2 py-1 text-xs rounded border ${!eraserEnabled ? "bg-blue-700 border-blue-500 text-white" : "bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-200"}`}
          onClick={() => setEraserEnabled(false)}
          title="Use pen"
        >
          Pen
        </button>
        <button
          type="button"
          className={`px-2 py-1 text-xs rounded border ${eraserEnabled ? "bg-amber-700 border-amber-500 text-white" : "bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-200"}`}
          onClick={() => setEraserEnabled(true)}
          title="Use eraser"
        >
          Eraser
        </button>

        <label className="text-xs text-gray-400 flex items-center gap-2">
          Color
          <input
            type="color"
            value={penColor}
            disabled={eraserEnabled}
            onChange={(e) => setPenColor(e.target.value)}
            className="h-7 w-8 rounded border border-gray-600 bg-gray-800 p-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Pen color"
          />
        </label>

        <label className="text-xs text-gray-400 flex items-center gap-2">
          Thickness
          <button
            type="button"
            onClick={decreaseBrushSize}
            className="px-1.5 py-0.5 rounded border border-gray-600 bg-gray-700 hover:bg-gray-600 text-gray-200"
            title="Decrease thickness"
          >
            -
          </button>
          <input
            type="range"
            min={1}
            max={30}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
          />
          <button
            type="button"
            onClick={increaseBrushSize}
            className="px-1.5 py-0.5 rounded border border-gray-600 bg-gray-700 hover:bg-gray-600 text-gray-200"
            title="Increase thickness"
          >
            +
          </button>
          <span className="text-gray-500 w-7 text-right">{brushSize}</span>
        </label>

        <label className="text-xs text-gray-400 flex items-center gap-2">
          Zoom
          <button
            type="button"
            onClick={zoomOut}
            className="px-1.5 py-0.5 rounded border border-gray-600 bg-gray-700 hover:bg-gray-600 text-gray-200"
            title="Zoom out"
          >
            -
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="px-2 py-0.5 rounded border border-gray-600 bg-gray-700 hover:bg-gray-600 text-gray-200"
            title="Reset zoom"
          >
            {Math.round(zoomPercent)}%
          </button>
          <button
            type="button"
            onClick={zoomIn}
            className="px-1.5 py-0.5 rounded border border-gray-600 bg-gray-700 hover:bg-gray-600 text-gray-200"
            title="Zoom in"
          >
            +
          </button>
          <input
            type="range"
            min={MIN_ZOOM_PERCENT}
            max={MAX_ZOOM_PERCENT}
            step={1}
            value={zoomPercent}
            onChange={(e) => setZoomPercent(Number(e.target.value))}
            className="w-28"
            title="Zoom level"
          />
        </label>

        <button className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600" onClick={clear}>Clear</button>
        <button className="px-2 py-1 text-xs rounded bg-blue-700 hover:bg-blue-600" onClick={() => { void save(); }} disabled={saving}>
          {saving ? "Saving..." : "Save PNG"}
        </button>
        <span className="text-xs text-gray-500">Draw directly on the canvas. Switching items auto-saves unsaved changes.</span>
        <span className="text-xs text-gray-400">Canvas {canvasSize.width} x {canvasSize.height}</span>
        {saveError && <span className="text-xs text-red-400">Save failed: {saveError}</span>}
      </div>

      <div className="relative flex-1 min-h-0">
        <button
          type="button"
          onClick={() => expandCanvas("top")}
          className="absolute top-2 left-1/2 -translate-x-1/2 z-20 px-2 py-0.5 rounded border border-gray-400/60 bg-white/90 text-gray-700 hover:bg-white"
          title="Expand up"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => expandCanvas("left")}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 px-2 py-0.5 rounded border border-gray-400/60 bg-white/90 text-gray-700 hover:bg-white"
          title="Expand left"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => expandCanvas("right")}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 px-2 py-0.5 rounded border border-gray-400/60 bg-white/90 text-gray-700 hover:bg-white"
          title="Expand right"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => expandCanvas("bottom")}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 px-2 py-0.5 rounded border border-gray-400/60 bg-white/90 text-gray-700 hover:bg-white"
          title="Expand down"
        >
          +
        </button>

        <div ref={viewportRef} className="h-full w-full overflow-auto rounded border border-gray-700 bg-gray-500/80">
          <div className="relative" style={canvasContainerStyle}>
            <canvas
              ref={canvasRef}
              style={{
                width: `${displayWidth}px`,
                height: `${displayHeight}px`,
                imageRendering: "pixelated",
                backgroundColor: "#f8fafc",
              }}
              className="absolute left-0 top-0 touch-none block"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={stopDrawing}
              onPointerCancel={stopDrawing}
              onPointerLeave={stopDrawing}
            />
          </div>
        </div>
      </div>
    </div>
  );
}