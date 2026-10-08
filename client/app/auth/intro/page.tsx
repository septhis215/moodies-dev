"use client";

import { useEffect } from "react";
import PageSkeleton from "@/components/loading/PageSkeleton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/app/context/AuthProvider";
import MoodiesIntro from "@/components/sections/MoodiesIntro";
import { AuthBrand, AuthHeader } from "../AuthFormUI";

export default function AccountIntroPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace("/auth/signup");
  }, [loading, isAuthenticated, router]);

  if (loading || !isAuthenticated) return <PageSkeleton variant="intro" embedded />;

  return (
    <div>
      <AuthBrand compact />
      <AuthHeader title="Welcome to Moodies" compact>
        Your account is ready. Get to know Moodies, then choose your favourite genres and languages.
      </AuthHeader>
      <MoodiesIntro variant="onboarding" headingId="account-intro-heading" />
      <div className="mt-6 flex flex-col gap-3 sm:items-start">
        <Link href="/auth/onboarding" className="ui-primary-action">
          Set up my preferences <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <p className="text-xs leading-5 text-[var(--ink-muted)]">
          Next: your age, favourite genres and languages.
        </p>
      </div>
    </div>
  );
}
