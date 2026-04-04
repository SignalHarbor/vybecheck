interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel'
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] animate-fade-in p-5">
      <div className="bg-white rounded-3xl p-6 max-w-[340px] w-full shadow-dialog animate-slide-up">
        <h2 className="m-0 mb-2 text-[17px] font-extrabold text-ink">
          {title}
        </h2>
        <p className="m-0 mb-5 text-ink-muted text-[13px] leading-[1.6]">
          {message}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 border border-border-light rounded-2xl cursor-pointer text-[13px] font-bold transition-all text-center bg-white text-ink-muted active:scale-[0.97]"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 px-4 border-none rounded-2xl cursor-pointer text-[13px] font-bold transition-all text-center bg-gradient-red text-white shadow-glow-red-sm active:scale-[0.97]"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
