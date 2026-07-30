import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ProtectedRoute, PublicOnlyRoute } from '../components/auth/ProtectedRoute';

const LoginPage = lazy(() =>
  import('../pages/LoginPage').then((module) => ({
    default: module.LoginPage,
  }))
);
const RegistrationPage = lazy(() =>
  import('../pages/RegistrationPage').then((module) => ({
    default: module.RegistrationPage,
  }))
);
const FeedRoute = lazy(() => import('./FeedRoute'));

function RouteLoader() {
  return (
    <div className="_main_layout _feed_skeleton_init_wrap">
      <div className="_feed_skeleton_init_loader">
        <div className="_feed_skeleton_init_spinner" />
        <p className="_feed_skeleton_init_text">Buddy Script</p>
      </div>
    </div>
  );
}

export function AppRoutes() {
  return (
    <AuthProvider>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnlyRoute>
                <RegistrationPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/feed"
            element={
              <ProtectedRoute>
                <FeedRoute />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
