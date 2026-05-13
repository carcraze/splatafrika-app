"use client";

/**
 * Atomic error component — always renders BOTH error message AND retry button.
 * These cannot be separated per REQ-18.5.
 */
interface ViewerErrorProps {
  onRetry: () => void;
  message?: string;
}

export function ViewerError({
  onRetry,
  message = "Tour content is temporarily unavailable.",
}: ViewerErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-[#1A3C5E] flex items-center justify-center">
        <svg
          className="w-8 h-8 text-[#EF4444]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>
      <p className="text-sm text-[#8FA3B1]">{message}</p>
      {/* Retry prompt is NOT optional — it is part of the error state */}
      <button
        onClick={onRetry}
        className="px-6 py-3 bg-[#00D4AA] hover:bg-[#33DDBB] active:bg-[#00BF97] text-[#003D30] font-semibold text-sm rounded-xl transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,212,170,0.35)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4AA] focus-visible:ring-offset-2"
      >
        Try Again
      </button>
    </div>
  );
}
