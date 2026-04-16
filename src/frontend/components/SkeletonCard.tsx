interface SkeletonCardProps {
  lines?: number;
  className?: string;
  /** Render an icon placeholder circle at the top */
  hasIcon?: boolean;
}

/** Animated shimmer placeholder — use while data is loading */
export function SkeletonCard({ lines = 2, className = '', hasIcon = false }: SkeletonCardProps) {
  return (
    <div className={`rounded-3xl border border-border-light bg-white p-4 shadow-card-muted animate-pulse ${className}`}>
      {hasIcon && (
        <div className="mb-3 h-10 w-10 rounded-2xl bg-tint-muted" />
      )}
      <div className="mb-3 h-3.5 w-2/5 rounded-lg bg-tint-muted" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3 rounded-lg bg-tint-muted ${i < lines - 1 ? 'mb-2 w-full' : 'w-3/4'}`}
        />
      ))}
    </div>
  );
}

/** Single row skeleton — for list items */
export function SkeletonRow({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 py-2.5 animate-pulse ${className}`}>
      <div className="h-8 w-8 shrink-0 rounded-full bg-tint-muted" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-1/2 rounded bg-tint-muted" />
        <div className="h-2.5 w-1/3 rounded bg-tint-muted" />
      </div>
      <div className="h-3 w-10 rounded bg-tint-muted" />
    </div>
  );
}
