import type { MatchResult } from '../../shared/types';

interface MatchCardProps {
  match: MatchResult;
  rank: number;
}

// Colour thresholds for the ring
function ringColor(pct: number): { stroke: string; trackStroke: string; textColor: string; bg: string } {
  if (pct >= 80) return { stroke: '#22C55E', trackStroke: '#DCFCE7', textColor: '#16A34A', bg: '#F0FDF4' };
  if (pct >= 60) return { stroke: '#539DC0', trackStroke: '#EAF4FB', textColor: '#3A7FA0', bg: '#EAF4FB' };
  if (pct >= 40) return { stroke: '#FEC539', trackStroke: '#FFF6D8', textColor: '#B8860B', bg: '#FFF6D8' };
  return         { stroke: '#F14573', trackStroke: '#FDEAF1', textColor: '#C91457', bg: '#FDEAF1' };
}

const RANK_MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

// SVG ring: r=16 gives circumference ≈ 100.5 so 1% ≈ 1 unit — easy maths
const R  = 16;
const CX = 20;
const CIRC = 2 * Math.PI * R;

export function MatchCard({ match, rank }: MatchCardProps) {
  const pct     = Math.min(100, Math.max(0, match.matchPercentage));
  const colors  = ringColor(pct);
  const filled  = (pct / 100) * CIRC;
  const gap     = CIRC - filled;

  // Initials avatar
  const name     = match.username || match.participantId.slice(0, 8);
  const initials = name.slice(0, 2).toUpperCase();
  const hue      = (match.participantId.charCodeAt(0) * 37 + match.participantId.charCodeAt(1) * 17) % 360;

  return (
    <div
      className="flex items-center gap-3 rounded-2xl border bg-white p-3.5 shadow-[0_2px_12px_rgba(99,104,140,0.07)] transition-all active:scale-[0.98]"
      style={{ borderColor: `${colors.stroke}30` }}
    >
      {/* Rank medal or number */}
      <div className="shrink-0 w-6 text-center">
        {RANK_MEDALS[rank]
          ? <span className="text-[16px]">{RANK_MEDALS[rank]}</span>
          : <span className="text-[12px] font-black text-ink-muted">#{rank}</span>
        }
      </div>

      {/* Initials avatar */}
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold text-white"
        style={{ background: `hsl(${hue},55%,52%)` }}
      >
        {initials}
      </div>

      {/* Name */}
      <span className="flex-1 text-[13px] font-bold text-ink truncate">{name}</span>

      {/* Circular progress ring */}
      <div className="relative shrink-0 flex items-center justify-center" style={{ width: 40, height: 40 }}>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle
            cx={CX} cy={CX} r={R}
            strokeWidth="3.5"
            stroke={colors.trackStroke}
            fill="none"
          />
          {/* Fill */}
          <circle
            cx={CX} cy={CX} r={R}
            strokeWidth="3.5"
            stroke={colors.stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${gap}`}
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
        </svg>
        {/* Percentage label in the middle */}
        <div className="absolute flex flex-col items-center justify-center">
          <span
            className="text-[9px] font-extrabold leading-none"
            style={{ color: colors.textColor }}
          >
            {Math.round(pct)}%
          </span>
        </div>
      </div>
    </div>
  );
}
