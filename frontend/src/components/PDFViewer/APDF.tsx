import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/TextLayer.css";
import type { MenuAction } from "./ContextMenu";

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

type RenderingMode = "single" | "continuous" | "continuous_thumbs";

type Props = {
  fileUrl: string | null;
  currentPage: number;
  onPageChange: (page: number) => void;
  onTotalPages: (total: number) => void;
  onSelectionAction: (action: MenuAction, selectedText: string, page: number) => void;
  highlightText?: string | null;
};

type LocalMenuState = {
  x: number;
  y: number;
  selectedText: string;
  page: number;
} | null;

type LazyPageProps = {
  pageNumber: number;
  width: number;
  renderTextLayer?: boolean;
  className?: string;
};

function LazyPage({ pageNumber, width, renderTextLayer = true, className }: LazyPageProps) {
  const [isNearViewport, setIsNearViewport] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsNearViewport(entry.isIntersecting);
      },
      {
        rootMargin: "600px 0px 600px 0px", // Preload pages 600px above/below viewport
      }
    );

    observer.observe(el);
    return () => {
      observer.unobserve(el);
    };
  }, []);

  const height = width * 1.414; // Estimated aspect ratio height for A4

  return (
    <div
      ref={elementRef}
      style={{
        width: `${width}px`,
        height: isNearViewport ? "auto" : `${height}px`,
        minHeight: `${height}px`,
      }}
      className={`relative flex items-center justify-center bg-gray-900 border border-gray-700 rounded ${className || ""}`}
    >
      {isNearViewport ? (
        <Page
          pageNumber={pageNumber}
          width={width}
          renderTextLayer={renderTextLayer}
          className="shadow-lg"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-2">
          <div className="w-8 h-8 rounded-full border-4 border-gray-600 border-t-blue-500 animate-spin" />
          <span className="text-xs">Page {pageNumber}</span>
        </div>
      )}
    </div>
  );
}

type LazyThumbnailProps = {
  pageNumber: number;
  width: number;
  isSelected: boolean;
  onClick: () => void;
};

function LazyThumbnail({ pageNumber, width, isSelected, onClick }: LazyThumbnailProps) {
  const [isNearViewport, setIsNearViewport] = useState(false);
  const elementRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsNearViewport(entry.isIntersecting);
      },
      {
        rootMargin: "300px 0px 300px 0px", // Preload thumbnails 300px above/below viewport
      }
    );

    observer.observe(el);
    return () => {
      observer.unobserve(el);
    };
  }, []);

  const height = width * 1.414; // Estimated aspect ratio height for A4 thumbnail

  return (
    <button
      ref={elementRef}
      type="button"
      onClick={onClick}
      style={{
        width: `${width}px`,
        height: `${height}px`,
      }}
      className={`rounded border overflow-hidden relative flex flex-col justify-between bg-gray-900 shrink-0 ${
        isSelected ? "border-blue-500" : "border-gray-700 hover:border-gray-500"
      }`}
    >
      {isNearViewport ? (
        <>
          <div className="flex-1 overflow-hidden pointer-events-none flex items-center justify-center">
            <Page
              pageNumber={pageNumber}
              width={width}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </div>
          <div className="text-[10px] text-gray-400 py-0.5 bg-gray-950/80 w-full z-10">{pageNumber}</div>
        </>
      ) : (
        <>
          <div className="flex-1 flex items-center justify-center text-gray-600 text-xs">
            {pageNumber}
          </div>
          <div className="text-[10px] text-gray-400 py-0.5 bg-gray-950/80 w-full">{pageNumber}</div>
        </>
      )}
    </button>
  );
}

export function APDF({
  fileUrl,
  currentPage,
  onPageChange,
  onTotalPages,
  onSelectionAction,
  highlightText,
}: Props) {
  const [numPages, setNumPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(800);
  const [loading, setLoading] = useState(false);
  const [renderingMode, setRenderingMode] = useState<RenderingMode>("continuous_thumbs");
  const [menu, setMenu] = useState<LocalMenuState>(null);
  const [showRenderingSubmenu, setShowRenderingSubmenu] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const menuRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = useCallback(
    (pdf: { numPages: number }) => {
      setNumPages(pdf.numPages);
      onTotalPages(pdf.numPages);
      setLoading(false);
    },
    [onTotalPages]
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const thumbs = renderingMode === "continuous_thumbs" ? 140 : 0;
        setPageWidth(Math.max(320, entry.contentRect.width - thumbs - 52));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [renderingMode]);

  const getSelectionText = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return "";
    const range = selection.getRangeAt(0);
    const container = scrollRef.current;
    if (!container || !container.contains(range.commonAncestorContainer)) return "";
    return selection.toString().trim();
  };

  const getEventPage = (target: EventTarget | null): number => {
    if (!(target instanceof HTMLElement)) return currentPage;
    const host = target.closest("[data-page-number]") as HTMLElement | null;
    if (!host) return currentPage;
    const value = Number(host.dataset.pageNumber);
    return Number.isFinite(value) && value > 0 ? value : currentPage;
  };

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const text = getSelectionText();
    const page = getEventPage(e.target);
    setMenu({ x: e.clientX, y: e.clientY, selectedText: text, page });
    setShowRenderingSubmenu(false);
  }, [currentPage]);

  // Scroll the selected page to the top when a thumbnail is clicked
  const handleThumbnailClick = useCallback((page: number) => {
    onPageChange(page);
    const node = pagesRef.current.get(page);
    if (node) {
      node.scrollIntoView({ block: "start" });
    }
  }, [onPageChange]);

  useEffect(() => {
    if (!menu) return;
    const onMouseDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenu(null);
        setShowRenderingSubmenu(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [menu]);

  const pages = useMemo(() => {
    if (!numPages) return [];
    return Array.from({ length: numPages }, (_, i) => i + 1);
  }, [numPages]);

  useEffect(() => {
    if (renderingMode === "single") return;
    const scroller = scrollRef.current;
    if (!scroller) return;

    let ticking = false;
    const updateCurrentPage = () => {
      const scrollerRect = scroller.getBoundingClientRect();
      const centerY = scrollerRect.top + scrollerRect.height / 2;
      let bestPage = currentPage;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const [page, node] of pagesRef.current.entries()) {
        const rect = node.getBoundingClientRect();
        if (rect.height <= 0) continue;
        const pageCenter = rect.top + rect.height / 2;
        const distance = Math.abs(pageCenter - centerY);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestPage = page;
        }
      }

      if (bestPage !== currentPage) {
        onPageChange(bestPage);
      }
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateCurrentPage);
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [currentPage, onPageChange, renderingMode]);



  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const clearHighlights = () => {
      container.querySelectorAll(".apdf-text-highlight").forEach((el) => {
        (el as HTMLElement).style.removeProperty("background");
        (el as HTMLElement).style.removeProperty("border-radius");
        (el as HTMLElement).classList.remove("apdf-text-highlight");
      });
    };

    if (!highlightText) {
      clearHighlights();
      return;
    }

    // Wait for text layer to paint after page scroll
    const timerId = window.setTimeout(() => {
      clearHighlights();
      const spans = Array.from(
        container.querySelectorAll(".react-pdf__Page__textContent span")
      ) as HTMLElement[];
      if (spans.length === 0) return;

      // Build combined text with span index map
      let combined = "";
      const ranges: { start: number; end: number; el: HTMLElement }[] = [];
      for (const span of spans) {
        const t = span.textContent ?? "";
        ranges.push({ start: combined.length, end: combined.length + t.length, el: span });
        combined += t;
      }

      // Normalise both strings for matching (collapse whitespace)
      const normalise = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
      const needle = normalise(highlightText).slice(0, 120); // cap to first 120 chars
      const haystack = normalise(combined);
      const idx = haystack.indexOf(needle.slice(0, 60));
      if (idx === -1) return;

      const matchEnd = idx + needle.length;
      let firstEl: HTMLElement | null = null;
      for (const range of ranges) {
        if (range.end > idx && range.start < matchEnd) {
          range.el.style.background = "rgba(234,179,8,0.45)";
          range.el.style.borderRadius = "2px";
          range.el.classList.add("apdf-text-highlight");
          if (!firstEl) firstEl = range.el;
        }
      }
      firstEl?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 600);

    return () => window.clearTimeout(timerId);
  }, [highlightText, currentPage]);



  const renderActionButton = (label: string, action: MenuAction) => {
    const enabled = Boolean(menu?.selectedText);
    return (
      <button
        type="button"
        disabled={!enabled}
        className={`w-full text-left px-3 py-2 text-sm ${enabled ? "hover:bg-gray-700 text-gray-100" : "text-gray-500 cursor-not-allowed"}`}
        onMouseDown={() => {
          if (!menu || !menu.selectedText) return;
          onSelectionAction(action, menu.selectedText, menu.page);
          setMenu(null);
          setShowRenderingSubmenu(false);
        }}
      >
        {label}
      </button>
    );
  };

  if (!fileUrl) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <p>Open a resource with a PDF file to view it here</p>
      </div>
    );
  }

  const showThumbs = renderingMode === "continuous_thumbs";
  const singlePage = renderingMode === "single";

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 border-b border-gray-700 bg-gray-900/80 px-3 py-1 text-xs text-gray-400 flex items-center gap-2">
        <span>APDF Mode:</span>
        <span className="text-gray-200">
          {renderingMode === "single" ? "Single Page" : renderingMode === "continuous" ? "Continuous" : "Continuous + Thumbnails"}
        </span>
      </div>

      <div
        ref={rootRef}
        className="flex-1 min-h-0 flex bg-gray-800"
        onContextMenu={handleContextMenu}
      >
        {showThumbs && (
          <aside className="w-36 shrink-0 border-r border-gray-700 overflow-y-auto p-2 bg-gray-900/60">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Pages</div>
            <Document file={fileUrl} loading={null} className="flex flex-col gap-2">
                {pages.map((p) => (
                  <LazyThumbnail
                    key={`thumb-${p}`}
                    pageNumber={p}
                    width={112}
                    isSelected={currentPage === p}
                    onClick={() => handleThumbnailClick(p)}
                  />
                ))}
            </Document>
          </aside>
        )}

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-gray-400">Loading PDF...</span>
            </div>
          )}

          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadStart={() => setLoading(true)}
            onLoadError={() => setLoading(false)}
            className="flex flex-col items-center py-4 gap-4"
            loading={<div className="text-gray-400 text-sm">Loading...</div>}
          >
            {singlePage ? (
              <div data-page-number={currentPage}>
                <Page
                  pageNumber={currentPage}
                  width={pageWidth}
                  renderTextLayer
                  className="shadow-lg"
                />
              </div>
            ) : (
              pages.map((p) => (
                <div
                  key={`page-${p}`}
                  data-page-number={p}
                  ref={(node) => {
                    if (node) {
                      pagesRef.current.set(p, node);
                    } else {
                      pagesRef.current.delete(p);
                    }
                  }}
                >
                  <LazyPage
                    pageNumber={p}
                    width={pageWidth}
                    renderTextLayer
                    className={`${currentPage === p ? "ring-2 ring-blue-500/70" : ""}`}
                  />
                </div>
              ))
            )}
          </Document>
        </div>
      </div>

      <div className="shrink-0 bg-gray-900/90 border-t border-gray-700 px-4 py-2 flex items-center justify-center gap-3 text-sm">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40"
        >
          Prev
        </button>
        <span className="text-gray-300">
          Page {currentPage} of {numPages || "?"}
        </span>
        <button
          onClick={() => onPageChange(Math.min(numPages, currentPage + 1))}
          disabled={currentPage >= numPages}
          className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40"
        >
          Next
        </button>
      </div>

      {menu && (
        <div
          ref={menuRef}
          className="fixed z-[70] bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-60"
          style={{ left: menu.x, top: menu.y }}
          onMouseLeave={() => setShowRenderingSubmenu(false)}
        >
          <div className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-700 truncate max-w-72">
            {menu.selectedText
              ? `Selected: \"${menu.selectedText.slice(0, 72)}\"`
              : "No text selected"}
          </div>

          {renderActionButton("Bookmark selection", { type: "bookmark" })}
          {renderActionButton("Spawn note", { type: "spawn_note" })}
          {renderActionButton("Spawn child", { type: "spawn_branch" })}
          {renderActionButton("Mark progress here", { type: "mark_progress" })}

          <div className="border-t border-gray-700 my-1" />

          <div
            className="relative"
            onMouseEnter={() => setShowRenderingSubmenu(true)}
          >
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 text-gray-100"
              onMouseDown={(e) => e.preventDefault()}
            >
              Rendering Mode ▸
            </button>

            {showRenderingSubmenu && (
              <div className="absolute left-full top-0 ml-1 z-[80] bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-52">
                <button
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700 ${renderingMode === "single" ? "text-blue-300" : "text-gray-100"}`}
                  onMouseDown={() => {
                    setRenderingMode("single");
                    setMenu(null);
                    setShowRenderingSubmenu(false);
                  }}
                >
                  Single Page
                </button>
                <button
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700 ${renderingMode === "continuous" ? "text-blue-300" : "text-gray-100"}`}
                  onMouseDown={() => {
                    setRenderingMode("continuous");
                    setMenu(null);
                    setShowRenderingSubmenu(false);
                  }}
                >
                  Continuous
                </button>
                <button
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700 ${renderingMode === "continuous_thumbs" ? "text-blue-300" : "text-gray-100"}`}
                  onMouseDown={() => {
                    setRenderingMode("continuous_thumbs");
                    setMenu(null);
                    setShowRenderingSubmenu(false);
                  }}
                >
                  Continuous + Thumbnails
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
