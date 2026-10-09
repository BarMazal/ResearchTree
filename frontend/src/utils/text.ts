export type TitleSplit = {
  line1: string;
  line2: string;
  fullTitle: string;
};

export function splitTitleTwoLines(title: string | null | undefined, maxWords = 5): TitleSplit {
  if (!title) return { line1: "", line2: "", fullTitle: "" };

  const trimmed = title.trim();
  const allWords = trimmed.split(/\s+/);
  const isTruncated = allWords.length > maxWords;
  const words = allWords.slice(0, maxWords);

  if (words.length <= 1) {
    const l1 = words[0] ? words[0] + (isTruncated ? "..." : "") : "";
    return { line1: l1, line2: "", fullTitle: trimmed };
  }

  let bestK = 1;
  let minDiff = Infinity;

  for (let k = 1; k < words.length; k++) {
    const l1 = words.slice(0, k).join(" ");
    const l2 = words.slice(k).join(" ") + (isTruncated ? "..." : "");
    const diff = Math.abs(l1.length - l2.length);
    if (diff < minDiff) {
      minDiff = diff;
      bestK = k;
    }
  }

  const line1 = words.slice(0, bestK).join(" ");
  const line2 = words.slice(bestK).join(" ") + (isTruncated ? "..." : "");

  return { line1, line2, fullTitle: trimmed };
}

export function truncateTitle(title: string | null | undefined, maxWords = 5): string {
  const { line1, line2 } = splitTitleTwoLines(title, maxWords);
  return line2 ? `${line1} ${line2}` : line1;
}
