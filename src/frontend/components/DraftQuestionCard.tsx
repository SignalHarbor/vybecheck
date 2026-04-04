import { X } from 'lucide-react';
import type { DraftQuestion } from '../store/draftStore';

interface DraftQuestionCardProps {
  draft: DraftQuestion;
  index: number;
  onRemove: (id: string) => void;
  onSetOwnerResponse?: (id: string, response: string) => void;
}

export function DraftQuestionCard({ draft, index, onRemove, onSetOwnerResponse }: DraftQuestionCardProps) {
  return (
    <div className="rounded-2xl border-[1.5px] border-border-light border-l-[3.5px] border-l-ink-muted bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <div className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-lg bg-tint-muted">
            <span className="text-[10px] font-black text-ink-muted">{index + 1}</span>
          </div>
          <p className="text-[13px] font-bold leading-[1.4] text-ink">
            {draft.isAIGenerated && <span title="AI Generated" className="mr-1">🤖</span>}
            {draft.prompt}
          </p>
        </div>
        <button
          onClick={() => onRemove(draft.id)}
          className="shrink-0 cursor-pointer border-0 bg-transparent p-0.5"
        >
          <X size={15} className="text-ink-muted" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {draft.options.map((option) => {
          const isSelected = draft.ownerResponse === option;
          return (
            <div
              key={option}
              onClick={() => onSetOwnerResponse?.(draft.id, option)}
              className={`rounded-xl px-3 py-2 text-center transition-all ${
                onSetOwnerResponse ? 'cursor-pointer' : 'cursor-default'
              } ${
                isSelected
                  ? 'border-2 border-status-success bg-tint-green'
                  : 'border border-border-light bg-surface-page'
              }`}
            >
              <span className={`text-[12px] font-semibold ${isSelected ? 'text-status-success-dark' : 'text-ink'}`}>
                {option}{isSelected && ' ✓'}
              </span>
            </div>
          );
        })}
      </div>
      {!draft.ownerResponse && (
        <div className="mt-2 text-[11px] text-vybe-red font-bold">
          ⚠️ Tap an option to select your answer
        </div>
      )}
    </div>
  );
}
