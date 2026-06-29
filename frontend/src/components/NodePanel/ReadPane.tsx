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
      <div className="text-xs text-gray-500 px-4 py-1 border-b border-gray-700 shrink-0 truncate">
        {src}
      </div>
      {isSameOrigin ? (
        <iframe
          src={src}
          title={title}
          className="flex-1 w-full border-0"
        />
      ) : (
        <iframe
          src={src}
          title={title}
          className="flex-1 w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
        />
      )}
    </div>
  );
}
