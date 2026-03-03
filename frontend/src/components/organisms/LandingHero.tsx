"use client";

import Link from "next/link";

import {
  SignInButton,
  SignedIn,
  SignedOut,
  isClerkEnabled,
} from "@/auth/clerk";
import { useT } from "@/lib/i18n";
import { LanguageToggle } from "@/components/ui/language-toggle";

const ArrowIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M6 12L10 8L6 4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function LandingHero() {
  const clerkEnabled = isClerkEnabled();
  const t = useT();

  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <div className="hero-label">{t("landing.label")}</div>
          <h1>
            {t("landing.headline1")}{" "}
            <span className="hero-highlight">{t("landing.headline1Highlight")}</span>
            <br />
            {t("landing.headline2")}
          </h1>
          <p>{t("landing.subtitle")}</p>

          <div className="hero-actions">
            <SignedOut>
              {clerkEnabled ? (
                <>
                  <SignInButton
                    mode="modal"
                    forceRedirectUrl="/boards"
                    signUpForceRedirectUrl="/boards"
                  >
                    <button type="button" className="btn-large primary">
                      {t("landing.openBoards")} <ArrowIcon />
                    </button>
                  </SignInButton>
                  <SignInButton
                    mode="modal"
                    forceRedirectUrl="/boards/new"
                    signUpForceRedirectUrl="/boards/new"
                  >
                    <button type="button" className="btn-large secondary">
                      {t("landing.createBoard")}
                    </button>
                  </SignInButton>
                </>
              ) : (
                <>
                  <Link href="/boards" className="btn-large primary">
                    {t("landing.openBoards")} <ArrowIcon />
                  </Link>
                  <Link href="/boards/new" className="btn-large secondary">
                    {t("landing.createBoard")}
                  </Link>
                </>
              )}
            </SignedOut>

            <SignedIn>
              <Link href="/boards" className="btn-large primary">
                {t("landing.openBoards")} <ArrowIcon />
              </Link>
              <Link href="/boards/new" className="btn-large secondary">
                {t("landing.createBoard")}
              </Link>
            </SignedIn>
          </div>

          <div className="hero-features">
            {[
              t("landing.agentFirstOps"),
              t("landing.approvalQueues"),
              t("landing.liveSignals"),
            ].map((label) => (
              <div key={label} className="hero-feature">
                <div className="feature-icon">✓</div>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="command-surface">
          <div className="surface-header">
            <div className="surface-title">{t("landing.commandSurface")}</div>
            <div className="live-indicator">
              <div className="live-dot" />
              {t("landing.live")}
            </div>
          </div>
          <div className="surface-subtitle">
            <h3>{t("landing.shipWork")}</h3>
            <p>{t("landing.surfaceSubtitle")}</p>
          </div>
          <div className="metrics-row">
            {[
              { label: t("nav.boards"), value: "12" },
              { label: t("nav.agents"), value: "08" },
              { label: "Tasks", value: "46" },
            ].map((item) => (
              <div key={item.label} className="metric">
                <div className="metric-value">{item.value}</div>
                <div className="metric-label">{item.label}</div>
              </div>
            ))}
          </div>
          <div className="surface-content">
            <div className="content-section">
              <h4>{t("landing.boardInProgress")}</h4>
              {[
                t("landing.cutRelease"),
                t("landing.triageApprovals"),
                t("landing.stabilizeAgent"),
              ].map((title) => (
                <div key={title} className="status-item">
                  <div className="status-icon progress">⊙</div>
                  <div className="status-item-content">
                    <div className="status-item-title">{title}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="content-section">
              <h4>{t("landing.approvalsPending")}</h4>
              {[
                { title: t("landing.deployWindow"), status: "ready" as const },
                { title: t("landing.copyReviewed"), status: "waiting" as const },
                { title: t("landing.securitySignOff"), status: "waiting" as const },
              ].map((item) => (
                <div key={item.title} className="approval-item">
                  <div className="approval-title">{item.title}</div>
                  <div className={`approval-badge ${item.status}`}>
                    {item.status === "ready" ? t("landing.ready") : t("landing.waiting")}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              padding: "2rem",
              borderTop: "1px solid var(--neutral-200)",
            }}
          >
            <div className="content-section">
              <h4>{t("landing.signalsUpdated")}</h4>
              {[
                { text: t("landing.signal1"), time: t("landing.now") },
                { text: t("landing.signal2"), time: "5m" },
                { text: t("landing.signal3"), time: "12m" },
              ].map((signal) => (
                <div key={signal.text} className="signal-item">
                  <div className="signal-text">{signal.text}</div>
                  <div className="signal-time">{signal.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="features-section" id="capabilities">
        <div className="features-grid">
          {[
            {
              title: t("landing.feature1Title"),
              description: t("landing.feature1Desc"),
            },
            {
              title: t("landing.feature2Title"),
              description: t("landing.feature2Desc"),
            },
            {
              title: t("landing.feature3Title"),
              description: t("landing.feature3Desc"),
            },
            {
              title: t("landing.feature4Title"),
              description: t("landing.feature4Desc"),
            },
          ].map((feature, idx) => (
            <div key={feature.title} className="feature-card">
              <div className="feature-number">
                {String(idx + 1).padStart(2, "0")}
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-content">
          <h2>{t("landing.ctaHeadline")}</h2>
          <p>{t("landing.ctaSubtitle")}</p>
          <div className="cta-actions">
            <SignedOut>
              {clerkEnabled ? (
                <>
                  <SignInButton
                    mode="modal"
                    forceRedirectUrl="/boards/new"
                    signUpForceRedirectUrl="/boards/new"
                  >
                    <button type="button" className="btn-large white">
                      {t("landing.createBoard")}
                    </button>
                  </SignInButton>
                  <SignInButton
                    mode="modal"
                    forceRedirectUrl="/boards"
                    signUpForceRedirectUrl="/boards"
                  >
                    <button type="button" className="btn-large outline">
                      {t("landing.viewBoards")}
                    </button>
                  </SignInButton>
                </>
              ) : (
                <>
                  <Link href="/boards/new" className="btn-large white">
                    {t("landing.createBoard")}
                  </Link>
                  <Link href="/boards" className="btn-large outline">
                    {t("landing.viewBoards")}
                  </Link>
                </>
              )}
            </SignedOut>

            <SignedIn>
              <Link href="/boards/new" className="btn-large white">
                {t("landing.createBoard")}
              </Link>
              <Link href="/boards" className="btn-large outline">
                {t("landing.viewBoards")}
              </Link>
            </SignedIn>
          </div>
          <div className="mt-6 flex justify-center">
            <LanguageToggle />
          </div>
        </div>
      </section>
    </>
  );
}
