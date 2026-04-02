import type { DraftQuestion } from '../store/draftStore';

interface DraftQuestionCardProps {
  draft: DraftQuestion;
  index: number;
  onRemove: (id: string) => void;
  onSetOwnerResponse?: (id: string, response: string) => void;
}

export function DraftQuestionCard({ draft, index, onRemove, onSetOwnerResponse }: DraftQuestionCardProps) {
  return (
    <div className="bg-vybe-yellow/30 border-2 border-dashed border-vybe-yellow rounded-2xl p-4 mb-3 transition-all hover:bg-vybe-yellow/40">
      <div className="flex justify-between items-start mb-3">
        <h3 className="m-0 flex-1 text-base font-semibold text-gray-800">
          {draft.isAIGenerated && <span title="AI Generated" className="mr-1">🤖</span>}Q{index + 1}: {draft.prompt}
        </h3>
        <button
          onClick={() => onRemove(draft.id)}
          className="ml-3 bg-red-500/10 text-red-500 border-none w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer text-base font-semibold transition-all shrink-0 [-webkit-tap-highlight-color:transparent] hover:bg-red-500/20 active:scale-95"
        >
          ✕
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {draft.options.map((option) => {
          const isSelected = draft.ownerResponse === option;
          return (
            <div
              key={option}
              onClick={() => onSetOwnerResponse?.(draft.id, option)}
              className={`border-2 rounded-xl py-3 px-4 font-medium text-[15px] flex items-center justify-between transition-all ${
                onSetOwnerResponse ? 'cursor-pointer' : 'cursor-default'
              } ${
                isSelected
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'bg-white text-gray-800 border-vybe-yellow'
              }`}
            >
              <span>{option}</span>
              {isSelected && <span>✓</span>}
            </div>
          );
        })}
      </div>
      {!draft.ownerResponse && (
        <div className="mt-2 text-xs text-red-600 font-medium">
          ⚠️ Click an option to select your answer
        </div>
      )}
    </div>
  );
}
