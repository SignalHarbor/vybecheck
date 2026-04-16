import { X, Pencil, GripVertical } from 'lucide-react';
import type { DraftQuestion } from '../store/draftStore';

interface DraftQuestionCardProps {
  draft: DraftQuestion;
  index: number;
  onRemove: (id: string) => void;
  onSetOwnerResponse?: (id: string, response: string) => void;
  onEdit?: (draft: DraftQuestion) => void;
  isEditDisabled?: boolean;
  editDisabledReason?: string;
  onDragStart?: (index: number) => void;
  onDragEnter?: (index: number) => void;
  onDragEnd?: () => void;
}

export function DraftQuestionCard({
  draft,
  index,
  onRemove,
  onSetOwnerResponse,
  onEdit,
  isEditDisabled,
  editDisabledReason,
  onDragStart,
  onDragEnter,
  onDragEnd
}: DraftQuestionCardProps) {
  return (
    <div
      className="group relative rounded-2xl border-[1.5px] border-border-light border-l-[3.5px] border-l-ink-muted bg-white p-4 shadow-sm transition-all hover:shadow-md cursor-grab active:cursor-grabbing"
      draggable
      onDragStart={(e) => {
        // Essential for Firefox
        e.dataTransfer.effectAllowed = 'move';
        // Add minimal empty text to allow drag
        e.dataTransfer.setData('text/plain', '');
        onDragStart?.(index);
      }}
      onDragEnter={() => onDragEnter?.(index)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <div className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-lg bg-tint-muted text-ink-muted">
            <GripVertical size={12} className="opacity-50" />
          </div>
          <p className="text-[13px] font-bold leading-[1.4] text-ink">
            {draft.isAIGenerated && <span title="AI Generated" className="mr-1">🤖</span>}
            {draft.prompt}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isEditDisabled) onEdit(draft);
              }}
              title={isEditDisabled ? editDisabledReason : "Edit Question"}
              disabled={isEditDisabled}
              className={`flex h-7 w-7 items-center justify-center rounded-lg border-0 transition-colors ${
                isEditDisabled 
                  ? 'bg-tint-muted text-ink-muted/50 cursor-not-allowed' 
                  : 'bg-tint-blue/50 text-vybe-blue cursor-pointer hover:bg-tint-blue'
              }`}
            >
              <Pencil size={13} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(draft.id);
            }}
            title="Delete Question"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-0 bg-tint-pink/50 text-vybe-red transition-colors hover:bg-tint-pink"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {draft.options.map((option) => {
          const isSelected = draft.ownerResponse === option;
          return (
            <div
              key={option}
              onClick={(e) => {
                e.stopPropagation();
                onSetOwnerResponse?.(draft.id, option);
              }}
              className={`rounded-xl px-3 py-2 text-center transition-all active:scale-[0.97] ${
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
