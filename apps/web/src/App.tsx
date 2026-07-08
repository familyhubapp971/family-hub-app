import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth-context';
import { TenantProvider } from './lib/tenant-context';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage } from './pages/marketing/LandingPage';
import { WelcomePage } from './pages/marketing/WelcomePage';
import { PricingPage } from './pages/marketing/PricingPage';
import { AboutPage } from './pages/marketing/AboutPage';
import { PrivacyPage } from './pages/marketing/PrivacyPage';
import { KidLoginPage } from './pages/auth/KidLoginPage';
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { AuthCallbackPage } from './pages/auth/AuthCallbackPage';
import { DashboardPage } from './pages/tenant/DashboardPage';
import { ChildWorldPage } from './pages/tenant/child/ChildWorldPage';
import { LegacyDashboardRedirect } from './pages/redirects/LegacyDashboardRedirect';
import { AdminPanelPage } from './pages/tenant/AdminPanelPage';
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
          {/* FHS-436 — public "what is Family Hub" page for beta reviewers
              and first-time visitors. */}
          <Route path="/about" element={<AboutPage />} />
          {/* FHS-435 — public draft privacy policy + signup consent link target. */}
          <Route path="/privacy" element={<PrivacyPage />} />
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

          {/* FHS-238 — kid login. Tenant-scoped (slug in URL) but NOT
              behind ProtectedRoute: the kid hasn't authenticated yet,
              that's the whole point. The page reads :slug via useParams
              directly so it can resolve the family + show the avatar
              grid. After successful PIN entry the kid lands on
              /t/:slug/dashboard like any other authenticated user. */}
          <Route path="/t/:slug/kid-login" element={<KidLoginPage />} />

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
              <ProtectedRoute allowKid>
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
          {/* FHS-308 — Admin Panel */}
          <Route
            path="/t/:slug/admin"
            element={
              <ProtectedRoute>
                <TenantProvider>
                  <AdminPanelPage />
                </TenantProvider>
              </ProtectedRoute>
            }
          />
          {/* FHS-268 — ChildWorld: a parent views a child's world. */}
          <Route
            path="/t/:slug/child/:memberId"
            element={
              <ProtectedRoute>
                <TenantProvider>
                  <ChildWorldPage />
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
