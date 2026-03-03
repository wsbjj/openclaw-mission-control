"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import {
  SignInButton,
  SignedIn,
  SignedOut,
  isClerkEnabled,
} from "@/auth/clerk";

import { UserMenu } from "@/components/organisms/UserMenu";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { useT } from "@/lib/i18n";

export function LandingShell({ children }: { children: ReactNode }) {
  const clerkEnabled = isClerkEnabled();
  const t = useT();

  return (
    <div className="landing-enterprise">
      <nav className="landing-nav" aria-label="Primary navigation">
        <div className="nav-container">
          <Link href="/" className="logo-section" aria-label="OpenClaw home">
            <div className="logo-icon" aria-hidden="true">
              OC
            </div>
            <div className="logo-text">
              <div className="logo-name">OpenClaw</div>
              <div className="logo-tagline">Mission Control</div>
            </div>
          </Link>

          <div className="nav-links">
            <Link href="#capabilities">{t("nav.capabilities")}</Link>
            <Link href="/boards">{t("landingShell.boards")}</Link>
            <Link href="/activity">{t("nav.activity")}</Link>
            <Link href="/gateways">{t("nav.gateways")}</Link>
          </div>

          <div className="nav-cta">
            <SignedOut>
              {clerkEnabled ? (
                <>
                  <SignInButton
                    mode="modal"
                    forceRedirectUrl="/onboarding"
                    signUpForceRedirectUrl="/onboarding"
                  >
                    <button type="button" className="btn-secondary">
                      {t("landingShell.signIn")}
                    </button>
                  </SignInButton>
                  <SignInButton
                    mode="modal"
                    forceRedirectUrl="/onboarding"
                    signUpForceRedirectUrl="/onboarding"
                  >
                    <button type="button" className="btn-primary">
                      {t("landingShell.startFreeTrial")}
                    </button>
                  </SignInButton>
                </>
              ) : (
                <>
                  <Link href="/boards" className="btn-secondary">
                    {t("landingShell.boards")}
                  </Link>
                  <Link href="/onboarding" className="btn-primary">
                    {t("landingShell.getStarted")}
                  </Link>
                </>
              )}
            </SignedOut>

            <SignedIn>
              <Link href="/boards/new" className="btn-secondary">
                {t("landingShell.createBoard")}
              </Link>
              <Link href="/boards" className="btn-primary">
                {t("landingShell.openBoards")}
              </Link>
              <LanguageToggle />
              <UserMenu />
            </SignedIn>
          </div>
        </div>
      </nav>

      <main>{children}</main>

      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <h3>OpenClaw</h3>
            <p>{t("landingShell.footerTagline")}</p>
            <div className="footer-tagline">{t("landingShell.realtimeVisibility")}</div>
          </div>

          <div className="footer-column">
            <h4>{t("landingShell.product")}</h4>
            <div className="footer-links">
              <Link href="#capabilities">{t("nav.capabilities")}</Link>
              <Link href="/boards">{t("landingShell.boards")}</Link>
              <Link href="/activity">{t("nav.activity")}</Link>
              <Link href="/dashboard">{t("landingShell.dashboard")}</Link>
            </div>
          </div>

          <div className="footer-column">
            <h4>{t("landingShell.platform")}</h4>
            <div className="footer-links">
              <Link href="/gateways">{t("nav.gateways")}</Link>
              <Link href="/agents">{t("nav.agents")}</Link>
              <Link href="/dashboard">{t("landingShell.dashboard")}</Link>
            </div>
          </div>

          <div className="footer-column">
            <h4>{t("landingShell.access")}</h4>
            <div className="footer-links">
              <SignedOut>
                {clerkEnabled ? (
                  <>
                    <SignInButton
                      mode="modal"
                      forceRedirectUrl="/onboarding"
                      signUpForceRedirectUrl="/onboarding"
                    >
                      <button type="button">{t("landingShell.signIn")}</button>
                    </SignInButton>
                    <SignInButton
                      mode="modal"
                      forceRedirectUrl="/onboarding"
                      signUpForceRedirectUrl="/onboarding"
                    >
                      <button type="button">{t("landingShell.createAccount")}</button>
                    </SignInButton>
                  </>
                ) : (
                  <Link href="/boards">{t("landingShell.boards")}</Link>
                )}
                <Link href="/onboarding">{t("landingShell.onboarding")}</Link>
              </SignedOut>
              <SignedIn>
                <Link href="/boards">{t("landingShell.openSidebarBoards")}</Link>
                <Link href="/boards/new">{t("landingShell.createSidebarBoard")}</Link>
                <Link href="/dashboard">{t("landingShell.dashboard")}</Link>
              </SignedIn>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-copyright">
            {t("landingShell.copyright", { year: new Date().getFullYear() })}
          </div>
          <div className="footer-bottom-links">
            <Link href="#capabilities">{t("nav.capabilities")}</Link>
            <Link href="/boards">{t("landingShell.boards")}</Link>
            <Link href="/activity">{t("nav.activity")}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
