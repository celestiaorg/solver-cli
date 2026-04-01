'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-xl font-bold">Something went wrong</h2>
      <pre className="max-w-lg overflow-auto rounded bg-black/20 p-4 text-sm">
        {error.message}
      </pre>
      <button
        onClick={reset}
        className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
      >
        Try again
      </button>
    </div>
  );
}
