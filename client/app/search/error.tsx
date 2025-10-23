'use client';

import Link from "next/link";

export default function SearchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
        <Link
          href="/"
          className="bg-white text-black px-4 py-2 rounded hover:bg-gray-200"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}