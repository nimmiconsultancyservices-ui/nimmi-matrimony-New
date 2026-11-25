import React, { useState } from 'react';

export interface LineChartPoint {
  label: string;
  value: number;
  subLabel?: string;
}

export interface BarChartItem {
  label: string;
  value: number;
  secondaryText?: string;
  color?: string;
}

export interface DonutChartSlice {
  label: string;
  value: number;
  color: string;
}

function getThemeColors() {
  if (typeof window === 'undefined') {
    return { primary: '#7A1C2C', accent: '#C59B27', deep: '#7C5D12', ink: '#231418' };
  }
  const styles = getComputedStyle(document.documentElement);
  return {
    primary: styles.getPropertyValue('--theme-primary').trim() || '#7A1C2C',
    accent: styles.getPropertyValue('--theme-accent').trim() || '#C59B27',
    deep: styles.getPropertyValue('--theme-accent-deep').trim() || '#7C5D12',
    ink: styles.getPropertyValue('--theme-ink').trim() || '#231418',
  };
}

/**
 * Converts an inline SVG chart element into a crisp PNG data URL so downloaded PDFs
 * embed real, theme-accurate visual charts.
 */
export async function rasterizeSvgChartToPng(
  svgEl: SVGSVGElement | null,
  targetWidth = 900,
  targetHeight = 360
): Promise<string | null> {
  if (!svgEl || typeof document === 'undefined') return null;
  try {
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(targetWidth));
    clone.setAttribute('height', String(targetHeight));

    // Resolve CSS variables on clone so standalone SVG renders identically inside Image()
    const colors = getThemeColors();
    let serialized = new XMLSerializer().serializeToString(clone);
    serialized = serialized
      .replace(/var\(--theme-primary\)/g, colors.primary)
      .replace(/var\(--theme-accent\)/g, colors.accent)
      .replace(/var\(--theme-accent-deep\)/g, colors.deep)
      .replace(/var\(--theme-ink\)/g, colors.ink);

    const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG rasterize failed'));
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      URL.revokeObjectURL(url);
      return null;
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    URL.revokeObjectURL(url);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export const AnalyticsLineChart: React.FC<{
  data: LineChartPoint[];
  svgRef?: React.Ref<SVGSVGElement>;
  emptyMessage?: string;
  valueFormatter?: (v: number) => string;
  strokeColor?: string;
}> = ({
  data,
  svgRef,
  emptyMessage = 'No registration records available for this period.',
  valueFormatter = (v) => v.toLocaleString(),
  strokeColor = 'var(--theme-primary)',
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border border-hairline bg-canvas/50 px-4 text-xs text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  const W = 720;
  const H = 250;
  const padL = 46;
  const padR = 18;
  const padT = 22;
  const padB = 38;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const maxVal = Math.max(1, ...data.map((d) => d.value));
  const yTicks = [0, Math.ceil(maxVal / 2), maxVal];

  const getX = (idx: number) =>
    data.length === 1 ? padL + chartW / 2 : padL + (idx / (data.length - 1)) * chartW;
  const getY = (val: number) => padT + chartH - (val / maxVal) * chartH;

  const polylinePoints = data.map((d, i) => `${getX(i).toFixed(1)},${getY(d.value).toFixed(1)}`).join(' ');
  const areaPath =
    data.length === 1
      ? ''
      : `M ${getX(0).toFixed(1)},${(padT + chartH).toFixed(1)} L ${data
          .map((d, i) => `${getX(i).toFixed(1)},${getY(d.value).toFixed(1)}`)
          .join(' L ')} L ${getX(data.length - 1).toFixed(1)},${(padT + chartH).toFixed(1)} Z`;

  const xLabelStep = Math.max(1, Math.ceil(data.length / 7));
  const activePoint = hoverIdx !== null ? data[hoverIdx] : null;

  return (
    <div className="relative w-full">
      {activePoint && (
        <div className="mb-1.5 flex items-center justify-end gap-2 text-[11px] font-medium text-ink tabular-nums">
          <span className="text-slate-500">{activePoint.subLabel || activePoint.label}:</span>
          <span className="font-mono font-semibold text-brand">
            {valueFormatter(activePoint.value)}
          </span>
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none overflow-visible"
        role="img"
        aria-label="Registration trend line chart"
      >
        <defs>
          <linearGradient id="nimmiLineAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.22" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {yTicks.map((tick, idx) => {
          const y = getY(tick);
          return (
            <g key={idx}>
              <line
                x1={padL}
                y1={y}
                x2={W - padR}
                y2={y}
                stroke="#E2E8F0"
                strokeDasharray="3 3"
              />
              <text
                x={padL - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="#64748B"
                fontFamily="JetBrains Mono, monospace"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {areaPath && <path d={areaPath} fill="url(#nimmiLineAreaGrad)" />}

        {data.length > 1 && (
          <polyline
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polylinePoints}
          />
        )}

        {data.map((d, i) => {
          const cx = getX(i);
          const cy = getY(d.value);
          const showLabel = i === 0 || i === data.length - 1 || i % xLabelStep === 0;
          const isHovered = hoverIdx === i;
          return (
            <g
              key={`${d.label}-${i}`}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              className="cursor-pointer"
            >
              <circle
                cx={cx}
                cy={cy}
                r={isHovered ? 5.5 : data.length <= 35 ? 3.2 : 2}
                fill={isHovered ? 'var(--theme-accent)' : strokeColor}
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />
              {showLabel && (
                <text
                  x={cx}
                  y={H - 12}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#64748B"
                  fontFamily="Plus Jakarta Sans, sans-serif"
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const AnalyticsBarChart: React.FC<{
  data: BarChartItem[];
  svgRef?: React.Ref<SVGSVGElement>;
  emptyMessage?: string;
  barColor?: string;
  valueFormatter?: (v: number) => string;
  horizontal?: boolean;
}> = ({
  data,
  svgRef,
  emptyMessage = 'No records available for the selected filters.',
  barColor = 'var(--theme-primary)',
  valueFormatter = (v) => v.toLocaleString(),
  horizontal = false,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center rounded-xl border border-hairline bg-canvas/50 px-4 text-xs text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  if (horizontal) {
    const visible = data.slice(0, 12);
    const maxVal = Math.max(1, ...visible.map((d) => d.value));
    const W = 680;
    const rowH = 30;
    const H = Math.max(150, visible.length * rowH + 24);
    const labelW = 148;
    const valueW = 92;
    const barMaxW = W - labelW - valueW - 20;

    return (
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none"
        role="img"
        aria-label="Horizontal distribution bar chart"
      >
        {visible.map((item, i) => {
          const y = 14 + i * rowH;
          const barW = Math.max(item.value > 0 ? 4 : 0, (item.value / maxVal) * barMaxW);
          const fill = item.color || barColor;
          return (
            <g
              key={`${item.label}-${i}`}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            >
              <text
                x={labelW - 10}
                y={y + 14}
                textAnchor="end"
                fontSize="11"
                fontWeight="600"
                fill="#334155"
                fontFamily="Plus Jakarta Sans, sans-serif"
              >
                {item.label.length > 20 ? `${item.label.slice(0, 19)}…` : item.label}
              </text>
              <rect
                x={labelW}
                y={y + 3}
                width={barMaxW}
                height={14}
                rx="4"
                fill="#F1F5F9"
              />
              <rect
                x={labelW}
                y={y + 3}
                width={barW}
                height={14}
                rx="4"
                fill={fill}
                opacity={hoverIdx === i ? 0.85 : 1}
              />
              <text
                x={labelW + barMaxW + 10}
                y={y + 14}
                textAnchor="start"
                fontSize="11"
                fontWeight="600"
                fill="#0F172A"
                fontFamily="JetBrains Mono, monospace"
              >
                {item.secondaryText || valueFormatter(item.value)}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  const visible = data.slice(0, 24);
  const W = 720;
  const H = 250;
  const padL = 52;
  const padR = 16;
  const padT = 24;
  const padB = 46;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const maxVal = Math.max(1, ...visible.map((d) => d.value));
  const yTicks = [0, Math.ceil(maxVal / 2), maxVal];
  const slotW = chartW / visible.length;
  const barW = Math.max(10, Math.min(42, slotW * 0.62));
  const active = hoverIdx !== null ? visible[hoverIdx] : null;

  return (
    <div className="w-full">
      {active && (
        <div className="mb-1 flex items-center justify-end gap-2 text-[11px] font-medium text-ink tabular-nums">
          <span className="text-slate-500">{active.label}:</span>
          <span className="font-mono font-semibold text-brand">
            {active.secondaryText || valueFormatter(active.value)}
          </span>
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none"
        role="img"
        aria-label="Vertical distribution bar chart"
      >
        {yTicks.map((tick, idx) => {
          const y = padT + chartH - (tick / maxVal) * chartH;
          return (
            <g key={idx}>
              <line
                x1={padL}
                y1={y}
                x2={W - padR}
                y2={y}
                stroke="#E2E8F0"
                strokeDasharray="3 3"
              />
              <text
                x={padL - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="#64748B"
                fontFamily="JetBrains Mono, monospace"
              >
                {valueFormatter(tick)}
              </text>
            </g>
          );
        })}

        {visible.map((item, i) => {
          const h = Math.max(item.value > 0 ? 3 : 0, (item.value / maxVal) * chartH);
          const x = padL + i * slotW + (slotW - barW) / 2;
          const y = padT + chartH - h;
          const fill = item.color || barColor;
          return (
            <g
              key={`${item.label}-${i}`}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              className="cursor-pointer"
            >
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx="4"
                fill={fill}
                opacity={hoverIdx === i ? 0.85 : 1}
              />
              <text
                x={x + barW / 2}
                y={y - 5}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill="#334155"
                fontFamily="JetBrains Mono, monospace"
              >
                {item.value > 0 ? valueFormatter(item.value) : ''}
              </text>
              <text
                x={x + barW / 2}
                y={H - 16}
                textAnchor="middle"
                fontSize="10"
                fill="#64748B"
                fontFamily="Plus Jakarta Sans, sans-serif"
              >
                {item.label.length > 10 ? `${item.label.slice(0, 9)}…` : item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const AnalyticsDonutChart: React.FC<{
  slices: DonutChartSlice[];
  centerLabel: string;
  centerValue: string | number;
  svgRef?: React.Ref<SVGSVGElement>;
}> = ({ slices, centerLabel, centerValue, svgRef }) => {
  const total = slices.reduce((acc, s) => acc + Math.max(0, s.value), 0);
  const size = 210;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 74;
  const strokeWidth = 26;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${size} ${size}`}
        className="h-44 w-44 shrink-0 select-none"
        role="img"
        aria-label={centerLabel}
      >
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#F1F5F9"
          strokeWidth={strokeWidth}
        />
        {total > 0 &&
          slices.map((slice, idx) => {
            if (slice.value <= 0) return null;
            const fraction = slice.value / total;
            const dash = fraction * circumference;
            const offset = -cumulative * circumference;
            cumulative += fraction;
            return (
              <circle
                key={`${slice.label}-${idx}`}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dash} ${circumference}`}
                strokeDashoffset={offset}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            );
          })}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fontSize="22"
          fontWeight="700"
          fill="#0F172A"
          fontFamily="JetBrains Mono, monospace"
        >
          {typeof centerValue === 'number' ? centerValue.toLocaleString() : centerValue}
        </text>
        <text
          x={cx}
          y={cy + 16}
          textAnchor="middle"
          fontSize="10"
          fontWeight="600"
          fill="#64748B"
          fontFamily="Plus Jakarta Sans, sans-serif"
        >
          {centerLabel}
        </text>
      </svg>

      <div className="w-full flex-1 space-y-2.5">
        {slices.map((slice) => {
          const pct = total > 0 ? Math.round((slice.value / total) * 1000) / 10 : 0;
          return (
            <div
              key={slice.label}
              className="flex items-center justify-between gap-3 border-b border-hairline/70 pb-1.5 text-xs"
            >
              <span className="flex items-center gap-2 font-medium text-ink">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: slice.color }}
                />
                <span>{slice.label}</span>
              </span>
              <span className="font-mono font-semibold text-ink tabular-nums">
                {slice.value.toLocaleString()}{' '}
                <span className="text-slate-500 font-normal">({pct.toFixed(1)}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
