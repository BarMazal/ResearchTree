import { useEffect, useState, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSettingsStore } from "../store/useSettingsStore";

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  height?: number;
};

export function PopoutWindow({ title, onClose, children, width = 440, height = 600 }: Props) {
  const floatingTitleBarColor = useSettingsStore((st) => st.floatingTitleBarColor || "#2563eb");
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const externalWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    const left = Math.max(0, window.screenX + window.innerWidth - width - 40);
    const top = Math.max(0, window.screenY + 40);

    const win = window.open(
      "",
      `popout_${title.replace(/\s+/g, "_")}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no`
    );

    if (!win) {
      alert("⚠️ Popout Window Blocked by Browser!\n\nTo allow external desktop windows:\n1. Click the Popup Blocker icon (top right of your address bar / URL bar).\n2. Select 'Always allow popups and redirects from " + window.location.origin + "'.\n3. Click Done and try clicking Popout again.");
      onClose();
      return;
    }

    externalWindowRef.current = win;
    win.document.title = `${title} — Research Tree`;

    // Copy all style tags and stylesheets from main document to popout window
    Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).forEach((styleNode) => {
      win.document.head.appendChild(styleNode.cloneNode(true));
    });

    win.document.body.className = "bg-gray-900 text-gray-100 p-0 m-0 h-full overflow-hidden font-sans";
    
    const mountNode = win.document.createElement("div");
    mountNode.id = "popout-root";
    mountNode.style.height = "100vh";
    mountNode.style.display = "flex";
    mountNode.style.flexDirection = "column";
    win.document.body.appendChild(mountNode);

    setContainer(mountNode);

    const handleUnload = () => {
      onClose();
    };

    win.addEventListener("beforeunload", handleUnload);

    return () => {
      win.removeEventListener("beforeunload", handleUnload);
      if (!win.closed) {
        win.close();
      }
    };
  }, [title]);

  if (!container) return null;

  return createPortal(
    <div className="flex-1 flex flex-col h-full bg-gray-900 text-gray-100 min-h-0 overflow-hidden">
      <header
        style={{ backgroundColor: floatingTitleBarColor }}
        className="border-b border-black/20 px-3 py-1.5 flex items-center justify-between shrink-0 select-none text-white"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-xs font-semibold text-gray-200">{title}</span>
        </div>
        <button
          onClick={() => {
            if (externalWindowRef.current && !externalWindowRef.current.closed) {
              externalWindowRef.current.close();
            }
            onClose();
          }}
          className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-2.5 py-1 rounded font-medium transition-colors"
          title="Dock back into main window"
        >
          Dock Back ↓
        </button>
      </header>
      <div className="flex-1 overflow-auto min-h-0 flex flex-col">
        {children}
      </div>
    </div>,
    container
  );
}
