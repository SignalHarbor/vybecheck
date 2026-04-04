interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 bg-gradient-header">
      <h1 className="text-white text-[28px] font-black">VybeCheck</h1>
      <div className="w-8 h-8 border-[3px] border-white/15 border-t-vybe-yellow rounded-full animate-spin-fast" />
      <p className="text-white/50 text-[13px]">{message}</p>
    </div>
  );
}
