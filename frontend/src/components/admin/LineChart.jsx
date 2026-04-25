function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatTick(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (Math.abs(n) >= 100) return `${Math.round(n)}`;
  if (Math.abs(n) >= 10) return `${n.toFixed(1)}`;
  return `${n.toFixed(2)}`;
}

function formatDateLabel(value) {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

export default function LineChart({ data, height = 180, xLabel = "Date", yLabel = "Value" }) {
  const pointsData = Array.isArray(data) ? data : [];
  const values = pointsData.map((d) => Number(d.value) || 0);
  const dates = pointsData.map((d) => d.date);
  const chartHeight = Number.isFinite(height) ? Math.max(120, Number(height)) : 180;

  const width = 560;

  if (!values.length) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50"
        style={{ height: chartHeight }}
      >
        <span className="text-xs font-medium text-neutral-500">No data yet</span>
      </div>
    );
  }

  const yMin = 0;
  const yMax = Math.max(1, ...values);
  const yRange = yMax - yMin || 1;

  // Plot area paddings to leave room for axes labels.
  const padLeft = 48;
  const padRight = 12;
  const padTop = 12;
  const padBottom = 32;
  const innerW = width - padLeft - padRight;
  const innerH = chartHeight - padTop - padBottom;

  const xAt = (i) => padLeft + (i / Math.max(1, values.length - 1)) * innerW;
  const yAt = (v) => padTop + (1 - (v - yMin) / yRange) * innerH;

  const polyline = values
    .map((v, i) => {
      const x = xAt(i);
      const y = yAt(v);
      return `${x.toFixed(2)},${clamp(y, padTop, padTop + innerH).toFixed(2)}`;
    })
    .join(" ");

  const axisX = padTop + innerH;
  const yTicks = 4;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, idx) =>
    yMin + (idx / yTicks) * (yMax - yMin)
  );

  const xLabelIdx = [0, Math.floor((values.length - 1) / 2), values.length - 1]
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => a - b);

  return (
    <svg
      viewBox={`0 0 ${width} ${chartHeight}`}
      className="w-full"
      style={{ height: chartHeight }}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      {/* Grid + Y axis ticks */}
      <g className="text-neutral-200" stroke="currentColor" strokeWidth="1">
        {tickValues.map((tv) => {
          const y = yAt(tv);
          return (
            <line
              key={tv}
              x1={padLeft}
              x2={width - padRight}
              y1={y}
              y2={y}
            />
          );
        })}
      </g>

      {/* Axes */}
      <g className="text-neutral-400" stroke="currentColor" strokeWidth="1.5">
        <line x1={padLeft} x2={padLeft} y1={padTop} y2={axisX} />
        <line x1={padLeft} x2={width - padRight} y1={axisX} y2={axisX} />
      </g>

      {/* Y labels */}
      <g className="text-neutral-500" fill="currentColor" fontSize="10">
        {tickValues.map((tv) => {
          const y = yAt(tv);
          return (
            <text
              key={tv}
              x={padLeft - 8}
              y={y + 3}
              textAnchor="end"
            >
              {formatTick(tv)}
            </text>
          );
        })}
      </g>

      {/* X labels */}
      <g className="text-neutral-500" fill="currentColor" fontSize="10">
        {xLabelIdx.map((idx) => (
          <text
            key={idx}
            x={xAt(idx)}
            y={chartHeight - 10}
            textAnchor={idx === 0 ? "start" : idx === values.length - 1 ? "end" : "middle"}
          >
            {formatDateLabel(dates[idx])}
          </text>
        ))}
      </g>

      {/* Axis titles */}
      <text
        x={padLeft + innerW / 2}
        y={chartHeight - 2}
        textAnchor="middle"
        className="text-neutral-400"
        fill="currentColor"
        fontSize="10"
      >
        {xLabel}
      </text>

      <text
        x={12}
        y={padTop + innerH / 2}
        textAnchor="middle"
        className="text-neutral-400"
        fill="currentColor"
        fontSize="10"
        transform={`rotate(-90 12 ${padTop + innerH / 2})`}
      >
        {yLabel}
      </text>

      {/* Line */}
      <polyline
        fill="none"
        className="text-emerald-600"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={polyline}
      />
    </svg>
  );
}
