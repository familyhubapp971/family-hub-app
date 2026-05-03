import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth-context';
import { TenantProvider } from './lib/tenant-context';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage } from './pages/marketing/LandingPage';
import { WelcomePage } from './pages/marketing/WelcomePage';
import { PricingPage } from './pages/marketing/PricingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { AuthCallbackPage } from './pages/auth/AuthCallbackPage';
import { DashboardPage } from './pages/tenant/DashboardPage';
import { LegacyDashboardRedirect } from './pages/redirects/LegacyDashboardRedirect';
import { MembersPage } from './pages/tenant/MembersPage';
import { MePage } from './pages/tenant/MePage';
import { OnboardingPage } from './pages/tenant/OnboardingPage';

// Top-level routing. AuthProvider wraps every route so useAuth() is
// available everywhere — including the OAuth callback page that needs
// to react to the session flip mid-render.
//
// FHS-249 — tenant-scoped pages live under `/t/:slug/*` (per ADR 0012).
// Marketing + auth routes stay at the root. Legacy `/dashboard` and
// `/me` redirect into the tenant-scoped tree once the user's tenant is
// known (the AuthCallbackPage figures it out post-login).
export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Marketing + auth — no tenant context. */}
          <Route path="/" element={<WelcomePage />} />
          <Route path="/pricing" element={<PricingPage />} />
          {/* Legacy /api/hello debug card preserved at /_health so the
              FHS-198 staging-deploy spec keeps validating end-to-end. */}
          <Route path="/_health" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          {/* FHS-224 / ADR 0011 — passwords retired. The old reset-password
              entry point now redirects into the magic-link flow so any
              bookmarked link still works. */}
          <Route path="/auth/reset-request" element={<Navigate to="/login" replace />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          {/* Tenant-scoped pages. The TenantProvider reads :slug from
              the URL and exposes it to descendants via useTenantSlug(). */}
          <Route
            path="/t/:slug/onboarding"
            element={
              <ProtectedRoute>
                <TenantProvider>
                  <OnboardingPage />
                </TenantProvider>
              </ProtectedRoute>
            }
          />
          <Route
            path="/t/:slug/dashboard"
            element={
              <ProtectedRoute>
                <TenantProvider>
                  <DashboardPage />
                </TenantProvider>
              </ProtectedRoute>
            }
          />
          <Route
            path="/t/:slug/members"
            element={
              <ProtectedRoute>
                <TenantProvider>
                  <MembersPage />
                </TenantProvider>
              </ProtectedRoute>
            }
          />
          <Route
            path="/t/:slug/me"
            element={
              <ProtectedRoute>
                <TenantProvider>
                  <MePage />
                </TenantProvider>
              </ProtectedRoute>
            }
          />

          {/* Legacy un-prefixed routes — kept as-is for now so existing
              deep links don't 404. Cleanup tracked under FHS-205.
              `/dashboard` resolves the user's first tenant via /api/me
              and forwards to /t/<slug>/dashboard so the new tenant-
              scoped DashboardPage (which requires TenantProvider) keeps
              working from older bookmarks + the OAuth callback. */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <LegacyDashboardRedirect />
              </ProtectedRoute>
            }
          />
          <Route
            path="/me"
            element={
              <ProtectedRoute>
                <MePage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
