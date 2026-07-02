import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { ItemData } from "../../store/useGraphStore";

type Props = {
  resource: ItemData;
};

export function LatexView({ resource }: Props) {
  const latex = resource.summary?.trim() || resource.title.trim();

  const rendered = useMemo(() => {
    return katex.renderToString(latex || String.raw`\text{Empty equation}`, {
      displayMode: true,
      throwOnError: false,
      strict: false,
    });
  }, [latex]);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3 p-4 bg-gray-900/60 overflow-auto">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wider text-gray-500">LaTeX</div>
          <div className="text-sm text-gray-300">
            Edit the formula in the summary field below, then view it rendered here.
            {" "}
            <a
              href="https://katex.org/docs/supported.html"
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              KaTeX syntax cheatsheet
            </a>
          </div>
        </div>
      </div>

      <div className="rounded border border-gray-700 bg-white p-4 text-black overflow-auto">
        <div dangerouslySetInnerHTML={{ __html: rendered }} />
      </div>
    </div>
  );
}