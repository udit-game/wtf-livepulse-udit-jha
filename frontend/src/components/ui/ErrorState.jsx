import React from "react";

export function ErrorState({ message = "Something went wrong", onRetry }) {
  return (
    <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg text-sm flex items-center justify-between">
      <div>{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-4 px-3 py-1 bg-rose-500 text-white rounded text-xs font-semibold hover:bg-rose-400 transition"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export default ErrorState;
