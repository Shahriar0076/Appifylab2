import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';
import { RegistrationPage } from '../pages/RegistrationPage';
import { FeedPage } from '../pages/FeedPage';
import { FeedProvider } from '../context/FeedContext';
import { AuthProvider } from '../context/AuthContext';
import { ProtectedRoute, PublicOnlyRoute } from '../components/auth/ProtectedRoute';

export function AppRoutes() {
  return (
    <AuthProvider>
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
              <FeedProvider>
                <FeedPage />
              </FeedProvider>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
