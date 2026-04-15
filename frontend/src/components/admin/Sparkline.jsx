function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function Sparkline({ data, height = 44 }) {
  const values = Array.isArray(data) ? data.map((d) => Number(d.value) || 0) : [];
  const width = 160;

  if (!values.length) {
    return (
      <div className="h-11 w-40 rounded-md border border-neutral-200 bg-neutral-50" />
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * (width - 2) + 1;
      const y = (1 - (v - min) / range) * (height - 2) + 1;
      return `${x.toFixed(2)},${clamp(y, 1, height - 1).toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-11 w-40 text-emerald-600"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
}
