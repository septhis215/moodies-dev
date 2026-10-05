import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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

const termsFocusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]";
const termsTextLink = `rounded-sm text-[var(--brand-coral-strong)] underline underline-offset-4 hover:text-[var(--ink)] ${termsFocusRing}`;

function TermsContents() {
  return (
    <nav aria-label="Terms sections">
      <ol className="space-y-1">
        {termsSections.map((section, index) => (
          <li key={section.title}>
            <a
              href={`#terms-section-${index + 1}`}
              className={`flex min-h-11 items-center rounded-lg px-2 py-2 text-sm leading-5 text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-1)] hover:text-[var(--ink)] ${termsFocusRing}`}
            >
              {section.title}
            </a>
          </li>
        ))}
        <li>
          <a
            href="#terms-support"
            className={`flex min-h-11 items-center rounded-lg px-2 py-2 text-sm text-[var(--ink-muted)] hover:bg-[var(--surface-1)] hover:text-[var(--ink)] ${termsFocusRing}`}
          >
            Questions or Support
          </a>
        </li>
        <li>
          <a
            href="#terms-credits"
            className={`flex min-h-11 items-center rounded-lg px-2 py-2 text-sm text-[var(--ink-muted)] hover:bg-[var(--surface-1)] hover:text-[var(--ink)] ${termsFocusRing}`}
          >
            Credits
          </a>
        </li>
      </ol>
    </nav>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--surface-0)] text-[var(--ink)]">
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
      <div
        id="terms-top"
        className="terms-screen ui-shell pb-12 pt-6 sm:pb-16 sm:pt-8 lg:pt-28"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/auth/signup"
              className={`inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] ${termsFocusRing}`}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to signup
            </Link>
            <TermsPdfButton />
          </div>

          <header className="max-w-3xl">
            <p className="ui-kicker">Using Moodies</p>
            <h1 className="mt-3 text-4xl font-bold leading-none text-[var(--ink)] sm:text-5xl">
              Terms &amp; Conditions
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--ink-muted)]">
              These terms explain the expectations for using Moodies, creating
              an account, saving your watchlist, sharing reviews, and receiving
              personalized movie and series recommendations.
            </p>
            <p className="mt-4 text-sm text-[var(--ink-muted)]">
              Last updated: <time dateTime="2026-06-29">June 29, 2026</time>
            </p>
          </header>

          <aside
            aria-label="Legal review notice"
            className="mt-6 max-w-3xl border-l-2 border-[var(--brand-gold)] pl-4"
          >
            <p className="text-sm leading-6 text-[var(--ink-muted)]">
              These terms are drafted for this Moodies project and should be
              reviewed by a qualified legal professional before production use.
            </p>
          </aside>

          <div className="mt-10 grid items-start gap-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
            <aside className="hidden lg:sticky lg:top-8 lg:block lg:max-h-[calc(100svh-4rem)] lg:overflow-y-auto">
              <h2 className="mb-3 text-xl font-bold leading-tight text-[var(--ink)]">
                On this page
              </h2>
              <TermsContents />
            </aside>
            <div className="min-w-0">
              <details className="mb-8 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-1)] lg:hidden">
                <summary
                  className={`cursor-pointer rounded-xl px-4 py-3 text-sm font-semibold text-[var(--ink)] ${termsFocusRing}`}
                >
                  On this page
                </summary>
                <div className="px-3 pb-3">
                  <TermsContents />
                </div>
              </details>
              <div className="max-w-[65ch] space-y-8 sm:space-y-10">
                {termsSections.map((section, index) => (
                  <section
                    key={section.title}
                    id={`terms-section-${index + 1}`}
                    aria-labelledby={`terms-heading-${index + 1}`}
                    className={`scroll-mt-28 rounded-sm target:bg-[var(--surface-1)] ${termsFocusRing}`}
                    tabIndex={-1}
                  >
                    <h2
                      id={`terms-heading-${index + 1}`}
                      className="text-xl font-bold leading-tight text-[var(--ink)] sm:text-2xl"
                    >
                      {section.title}
                    </h2>
                    <p className="mt-3 text-base leading-7 text-[var(--ink-muted)]">
                      {section.body}
                    </p>
                  </section>
                ))}

                <section
                  id="terms-support"
                  aria-labelledby="terms-support-heading"
                  className={`scroll-mt-28 rounded-sm target:bg-[var(--surface-1)] ${termsFocusRing}`}
                  tabIndex={-1}
                >
                  <h2
                    id="terms-support-heading"
                    className="text-xl font-bold leading-tight text-[var(--ink)] sm:text-2xl"
                  >
                    Questions or Support
                  </h2>
                  <p className="mt-3 text-base leading-7 text-[var(--ink-muted)]">
                    If you have questions about these terms or need account
                    support, contact the Moodies team through the support
                    channels provided in the app.
                  </p>
                  <a
                    href="mailto:moodies.support@gmail.com"
                    className={`mt-2 inline-flex min-h-11 max-w-full items-center rounded-sm text-sm font-semibold text-[var(--brand-coral-strong)] underline decoration-[var(--brand-coral)]/50 underline-offset-4 hover:text-[var(--ink)] ${termsFocusRing}`}
                  >
                    moodies.support@gmail.com
                  </a>
                </section>

                <footer
                  id="terms-credits"
                  className="scroll-mt-28 border-t border-[var(--surface-border)] pt-6"
                >
                  <h2 className="text-xl font-bold leading-tight text-[var(--ink)]">
                    Developed by the Moodies team
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
                    <a
                      href="https://github.com/yl1010ng"
                      className={termsTextLink}
                    >
                      Ng Yong Lin
                    </a>{" "}
                    and{" "}
                    <a
                      href="https://github.com/septhis215"
                      className={termsTextLink}
                    >
                      Teh Yan Yang
                    </a>
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
                    Movie and TV metadata is powered in part by{" "}
                    <a
                      href="https://www.themoviedb.org/"
                      className={termsTextLink}
                    >
                      The Movie Database (TMDB)
                    </a>
                    . Moodies is not endorsed or certified by TMDB.
                  </p>
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                    <Link
                      href="/auth/signup"
                      className={`inline-flex min-h-11 items-center rounded-sm text-sm font-semibold text-[var(--brand-coral-strong)] hover:text-[var(--ink)] ${termsFocusRing}`}
                    >
                      Return to signup
                    </Link>
                    <a
                      href="#terms-top"
                      className={`inline-flex min-h-11 items-center rounded-sm text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] ${termsFocusRing}`}
                    >
                      Back to top
                    </a>
                  </div>
                </footer>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section id="terms-pdf-document" className="hidden">
        <header>
          <h1>Moodies Terms & Conditions</h1>
          <p>
            Last updated: June 29, 2026. These terms explain the expectations
            for using Moodies, creating an account, saving a watchlist, sharing
            reviews, and receiving personalized movie and series
            recommendations.
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
