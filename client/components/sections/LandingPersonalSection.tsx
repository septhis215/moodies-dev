"use client";

import { useAuth } from "@/app/context/AuthProvider";
import FavoriteSection from "./FavoriteSection";
import MoodiesIntro from "./MoodiesIntro";

export default function LandingPersonalSection() {
  const { user, isAuthenticated, loading } = useAuth();

  // Wait for bootstrap so members never see the guest introduction flash.
  if (loading) return null;

  return isAuthenticated ? (
    <FavoriteSection key={user?.id} />
  ) : (
    <MoodiesIntro />
  );
}
