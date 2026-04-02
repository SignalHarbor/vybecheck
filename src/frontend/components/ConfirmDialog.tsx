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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-1000 animate-fade-in p-5">
      <div className="bg-white rounded-[20px] p-6 max-w-100 w-full shadow-dialog animate-slide-up">
        <h2 className="m-0 mb-3 text-xl font-bold text-gray-800">
          {title}
        </h2>
        <p className="m-0 mb-6 text-gray-500 text-[15px] leading-relaxed">
          {message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-4 px-6 border-2 border-gray-200 rounded-xl cursor-pointer text-[17px] font-semibold transition-all text-center select-none [-webkit-tap-highlight-color:transparent] touch-manipulation bg-white text-vybe-blue shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:bg-gray-50 active:scale-[0.97]"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-4 px-6 border-none rounded-xl cursor-pointer text-[17px] font-semibold transition-all text-center select-none [-webkit-tap-highlight-color:transparent] touch-manipulation bg-linear-to-br from-vybe-blue to-vybe-purple text-white shadow-primary active:scale-[0.97]"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
