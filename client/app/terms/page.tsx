import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Film, ShieldCheck } from "lucide-react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { TermsPdfButton } from "./TermsPdfButton";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "Review the Moodies terms for accounts, recommendations, reviews, watchlists, and community features.",
};

const termsSections = [
  {
    title: "1. Acceptance of Terms",
    body: "By creating an account or using Moodies, you agree to these Terms & Conditions. If you do not agree, please do not create an account or use the service.",
  },
  {
    title: "2. Your Account",
    body: "You are responsible for keeping your login details secure and for activity that happens through your account. Use accurate signup information, and notify us if you believe your account has been accessed without permission.",
  },
  {
    title: "3. Moodies Recommendations",
    body: "Moodies helps you discover movies and series through moods, quizzes, trends, watchlists, likes, reviews, and other preference signals. Recommendations are provided for discovery and entertainment purposes and may change as content data, availability, and your activity change.",
  },
  {
    title: "4. Community Content",
    body: "When you post reviews, replies, reactions, profile details, or other content, you are responsible for what you share. Do not post content that is abusive, hateful, threatening, misleading, spammy, infringing, or otherwise harmful to other users or the service.",
  },
  {
    title: "5. Content and Third-Party Data",
    body: "Movie, TV, cast, image, rating, trailer, and related metadata may come from third-party sources. Moodies does not own all external media data and cannot guarantee that every title, image, score, release date, or availability detail is complete or current.",
  },
  {
    title: "6. Acceptable Use",
    body: "Do not attempt to disrupt Moodies, scrape the service at scale, bypass security controls, reverse engineer private systems, impersonate others, upload malicious content, or use the platform for unlawful activity.",
  },
  {
    title: "7. Privacy and Personalization",
    body: "Moodies may use account information, saved titles, likes, moods, quiz answers, reviews, and usage activity to operate the service, personalize recommendations, protect users, and improve product quality.",
  },
  {
    title: "8. Changes to the Service",
    body: "We may update, add, pause, or remove features from Moodies as the product evolves. Some features may be experimental, unavailable, or dependent on third-party services.",
  },
  {
    title: "9. Suspension or Removal",
    body: "We may restrict, suspend, or remove access to accounts or content that violate these terms, create risk for other users, or interfere with the operation of Moodies.",
  },
  {
    title: "10. Updates to These Terms",
    body: "We may update these Terms & Conditions from time to time. Continued use of Moodies after changes are posted means you accept the updated terms.",
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0.45in;
          }

          html,
          body {
            background: #fff !important;
          }

          .terms-screen {
            display: none !important;
          }

          body * {
            visibility: hidden;
          }

          #terms-pdf-document,
          #terms-pdf-document * {
            visibility: visible;
          }

          #terms-pdf-document {
            display: block !important;
            position: absolute;
            inset: 0 auto auto 0;
            width: 100%;
            background: #fff !important;
            color: #111 !important;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 9.5pt;
            line-height: 1.35;
          }

          #terms-pdf-document article,
          #terms-pdf-document section,
          #terms-pdf-document div {
            break-inside: avoid;
            background: #fff !important;
            box-shadow: none !important;
          }

          #terms-pdf-document h1,
          #terms-pdf-document h2,
          #terms-pdf-document h3,
          #terms-pdf-document p,
          #terms-pdf-document a,
          #terms-pdf-document li {
            color: #111 !important;
          }

          #terms-pdf-document h1 {
            font-size: 18pt;
            line-height: 1.1;
            margin: 0 0 6pt;
          }

          #terms-pdf-document h2 {
            font-size: 10.5pt;
            line-height: 1.25;
            margin: 8pt 0 2pt;
          }

          #terms-pdf-document p {
            margin: 0 0 4pt;
          }

          #terms-pdf-document a {
            text-decoration: none;
          }
        }
      `}</style>
      <div className="terms-screen">
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(233,79,55,0.22),transparent_34%),radial-gradient(circle_at_80%_0%,rgba(245,158,11,0.14),transparent_30%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18),#000_92%)]" />

          <div className="relative mx-auto flex min-h-[36rem] max-w-6xl flex-col justify-between px-4 pb-10 pt-24 sm:px-6 lg:px-8 lg:pt-28">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href="/auth/signup"
                className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-sm font-medium text-white/72 transition hover:border-[rgb(233,79,55)]/35 hover:bg-white/[0.07] hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back to signup
              </Link>
              <TermsPdfButton />
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-end">
              <div className="max-w-3xl">
                <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-[rgb(233,79,55)]/25 bg-[rgb(233,79,55)]/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#ffb09f]">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  Moodies account terms
                </div>
                <h1 className="text-4xl font-semibold tracking-normal text-white sm:text-5xl lg:text-6xl">
                  Terms & Conditions
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-white/62 sm:text-lg">
                  These terms explain the expectations for using Moodies, creating
                  an account, saving your watchlist, sharing reviews, and receiving
                  personalized movie and series recommendations.
                </p>
                <p className="mt-4 text-sm text-white/42">
                  Last updated: June 29, 2026
                </p>
              </div>

              <div className="hidden rounded-lg border border-white/10 bg-white/[0.045] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.45)] lg:block">
                <div className="relative mx-auto h-32 w-32">
                  <Image
                    src="/images/moodies-transparent.png"
                    alt="Moodies"
                    fill
                    sizes="128px"
                    className="object-contain drop-shadow-[0_14px_24px_rgba(0,0,0,0.45)]"
                    priority
                  />
                </div>
                <div className="mt-5 space-y-3 text-sm text-white/58">
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#ef775f]" aria-hidden />
                    Keep your account details secure.
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#ef775f]" aria-hidden />
                    Share reviews respectfully.
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#ef775f]" aria-hidden />
                    Use recommendations as discovery guidance.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Film className="h-4 w-4 text-[#ef775f]" aria-hidden />
                  Quick note
                </div>
                <p className="mt-3 text-sm leading-6 text-white/52">
                  These terms are drafted for this Moodies project and should be
                  reviewed by a qualified legal professional before production use.
                </p>
              </div>
            </aside>

            <div className="space-y-4">
              {termsSections.map((section) => (
                <article
                  key={section.title}
                  className="rounded-lg border border-white/10 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6"
                >
                  <h2 className="text-lg font-semibold text-white">
                    {section.title}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-white/60 sm:text-base">
                    {section.body}
                  </p>
                </article>
              ))}

              <div className="rounded-lg border border-[rgb(233,79,55)]/25 bg-[rgb(233,79,55)]/10 p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-white">
                  Questions or Support
                </h2>
                <p className="mt-3 text-sm leading-7 text-white/62 sm:text-base">
                  If you have questions about these terms or need account support,
                  contact the Moodies team through the support channels provided
                  in the app.
                </p>
                <Link
                  href="/auth/signup"
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[rgb(233,79,55)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[rgb(215,65,42)]"
                >
                  Return to signup
                </Link>
              </div>

              <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5 text-center sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ef775f]">
                Credits
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Developed by the Moodies team
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/58">
                <Link
                  href="https://github.com/yl1010ng"
                  className="font-medium text-amber-300 underline-offset-4 transition hover:text-amber-200 hover:underline"
                >
                  Ng Yong Lin
                </Link>{" "}
                and{" "}
                <Link
                  href="https://github.com/septhis215"
                  className="font-medium text-amber-300 underline-offset-4 transition hover:text-amber-200 hover:underline"
                >
                  Teh Yan Yang
                </Link>
              </p>
              <p className="mx-auto mt-4 max-w-2xl border-t border-white/10 pt-4 text-xs leading-6 text-white/45">
                Movie and TV metadata is powered in part by{" "}
                <Link
                  href="https://www.themoviedb.org/"
                  className="font-medium text-amber-300 underline-offset-4 transition hover:text-amber-200 hover:underline"
                >
                  The Movie Database (TMDB)
                </Link>
                . Moodies is not endorsed or certified by TMDB.
              </p>
              </section>
            </div>
          </div>
        </section>
      </div>

      <section id="terms-pdf-document" className="hidden">
        <header>
          <h1>Moodies Terms & Conditions</h1>
          <p>
            Last updated: June 29, 2026. These terms explain the expectations
            for using Moodies, creating an account, saving a watchlist, sharing
            reviews, and receiving personalized movie and series recommendations.
          </p>
          <p>
            This document is drafted for the Moodies project and should be
            reviewed by a qualified legal professional before production use.
          </p>
        </header>

        <main>
          {termsSections.map((section) => (
            <article key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </article>
          ))}

          <article>
            <h2>11. Questions or Support</h2>
            <p>
              If you have questions about these terms or need account support,
              contact the Moodies team through the support channels provided in
              the app.
            </p>
          </article>

          <article>
            <h2>Credits</h2>
            <p>
              Developed by the Moodies team: Ng Yong Lin
              (https://github.com/yl1010ng) and Teh Yan Yang
              (https://github.com/septhis215).
            </p>
            <p>
              Movie and TV metadata is powered in part by The Movie Database
              (TMDB). Moodies is not endorsed or certified by TMDB.
            </p>
          </article>
        </main>
      </section>
    </div>
  );
}
