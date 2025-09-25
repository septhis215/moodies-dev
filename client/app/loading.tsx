// app/loading.tsx
"use client";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
export default function SearchLoading() {
    return (
        <div className="min-h-screen bg-black">
            <div className="container mx-auto px-4 py-8 space-y-6">
                {/* Header skeleton */}
                <div className="space-y-2">
                    <Skeleton className="h-8 w-1/3 rounded" />
                    <Skeleton className="h-4 w-1/4 rounded" />
                </div>

                {/* Example placeholder filters / badges */}
                <div className="flex gap-2">
                    <Badge variant="secondary" className="opacity-60 pointer-events-none">
                        Loading...
                    </Badge>
                    <Badge variant="secondary" className="opacity-60 pointer-events-none">
                        Please wait
                    </Badge>
                </div>

                {/* Grid of skeleton cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="space-y-2">
                            <Skeleton className="aspect-[2/3] w-full rounded" />
                            <Skeleton className="h-4 w-3/4 rounded" />
                            <Skeleton className="h-3 w-1/2 rounded" />
                        </div>
                    ))}
                </div>

                {/* Button skeleton (e.g., load more) */}
                <div className="flex justify-center pt-6">
                    <Button disabled className="opacity-60">
                        Loading...
                    </Button>
                </div>
            </div>
        </div>
    );
}

