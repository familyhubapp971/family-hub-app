import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth-context';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { WelcomePage } from './pages/WelcomePage';
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { ResetPasswordRequestPage } from './pages/auth/ResetPasswordRequestPage';
import { AuthCallbackPage } from './pages/auth/AuthCallbackPage';
import { DashboardPage } from './pages/DashboardPage';
import { MePage } from './pages/MePage';

// Top-level routing. AuthProvider wraps every route so useAuth() is
// available everywhere — including the OAuth callback page that needs
// to react to the session flip mid-render.
export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          {/* Legacy /api/hello debug card preserved at /_health so the
              FHS-198 staging-deploy spec keeps validating end-to-end. */}
          <Route path="/_health" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/auth/reset-request" element={<ResetPasswordRequestPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
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
