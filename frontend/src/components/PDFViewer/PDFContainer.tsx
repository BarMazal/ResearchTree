import { useState, useRef, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

type Props = {
  fileUrl: string | null;
  currentPage: number;
  onPageChange: (page: number) => void;
  onTotalPages: (total: number) => void;
  onTextSelect: (text: string, page: number, x: number, y: number) => void;
};

export function PDFContainer({
  fileUrl,
  currentPage,
  onPageChange,
  onTotalPages,
  onTextSelect,
}: Props) {
  const [numPages, setNumPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(800);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = useCallback(
    (pdf: { numPages: number }) => {
      setNumPages(pdf.numPages);
      onTotalPages(pdf.numPages);
      setLoading(false);
    },
    [onTotalPages]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setPageWidth(entry.contentRect.width - 40);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (text) {
        e.preventDefault();
        onTextSelect(text, currentPage, e.clientX, e.clientY);
      }
    },
    [currentPage, onTextSelect]
  );

  if (!fileUrl) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <p>Open a resource with a PDF file to view it here</p>
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto bg-gray-800"
        onContextMenu={handleContextMenu}
      >
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
          <Page
            pageNumber={currentPage}
            width={pageWidth}
            renderTextLayer
            className="shadow-lg"
          />
        </Document>
      </div>

      {/* Page navigation — always visible at bottom */}
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
    </>
  );
}
