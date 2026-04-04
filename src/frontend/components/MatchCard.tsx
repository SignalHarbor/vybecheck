import { ChevronRight } from 'lucide-react';
import type { MatchResult } from '../../shared/types';

interface MatchCardProps {
  match: MatchResult;
  rank: number;
}

export function MatchCard({ match, rank }: MatchCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border-light bg-white p-3 shadow-[0_2px_8px_rgba(99,104,140,0.05)] transition-all active:scale-[0.98]">
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
        rank === 1
          ? 'bg-gradient-yellow shadow-glow-yellow'
          : 'bg-tint-muted'
      }`}>
        <span className={`text-[12px] font-black ${rank === 1 ? 'text-ink' : 'text-ink-muted'}`}>#{rank}</span>
      </div>
      <span className="flex-1 text-[13px] font-bold text-ink truncate">
        {match.username || `${match.participantId.slice(0, 8)}`}
      </span>
      <div className="flex items-center gap-1 rounded-full bg-tint-blue px-2.5 py-1">
        <span className="text-[13px] font-extrabold text-vybe-blue">{match.matchPercentage.toFixed(1)}%</span>
      </div>
      <ChevronRight size={14} className="text-ink-muted" />
    </div>
  );
}
