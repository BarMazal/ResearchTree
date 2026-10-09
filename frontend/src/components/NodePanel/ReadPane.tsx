type Props = {
  fileUrl: string | null;
  sourceUrl: string | null;
  title: string;
};

export function ReadPane({ fileUrl, sourceUrl, title }: Props) {
  const src = fileUrl ?? sourceUrl;
  const isSameOrigin = src?.startsWith("/");
  if (!src) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="text-xs text-gray-400 px-4 py-1.5 border-b border-gray-700 bg-gray-900/60 shrink-0 flex items-center justify-between gap-2">
        <span className="truncate flex-1 font-mono text-[11px] text-gray-400">{src}</span>
        {!isSameOrigin && (
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 px-2 py-0.5 rounded bg-blue-600/80 hover:bg-blue-600 text-white text-[11px] font-medium transition-colors flex items-center gap-1"
          >
            Open in new tab ↗
          </a>
        )}
      </div>
      {isSameOrigin ? (
        <iframe
          src={src}
          title={title}
          className="flex-1 w-full border-0 bg-white"
        />
      ) : (
        <iframe
          src={src}
          title={title}
          className="flex-1 w-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
        />
      )}
    </div>
  );
}
