type Props = {
  url: string;
  title: string;
};

export function WebView({ url, title }: Props) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="text-xs text-gray-500 px-4 py-1 border-b border-gray-700 shrink-0">
        {url}
      </div>
      <iframe
        src={url}
        title={title}
        className="flex-1 w-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}
