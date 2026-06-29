type Props = {
  value: number;
  onChange: (v: number) => void;
};

export function ProgressBar({ value, onChange }: Props) {
  const hue = Math.round((value / 100) * 120);
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-blue-500"
      />
      <span
        className="text-xs font-mono w-8 text-right"
        style={{ color: `hsl(${hue}, 80%, 55%)` }}
      >
        {Math.round(value)}%
      </span>
    </div>
  );
}
