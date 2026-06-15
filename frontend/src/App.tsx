import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Home } from './pages/Home';
import { CourseDetails } from './pages/CourseDetails';
import { WatchLesson } from './pages/WatchLesson';
import { Dashboard } from './pages/Dashboard';

const queryClient = new QueryClient();

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRole?: 'STUDENT' | 'INSTRUCTOR' }> = ({ children, allowedRole }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-sm text-zinc-500 font-medium">
        Validating session...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={user.role === 'INSTRUCTOR' ? '/instructor-dashboard' : '/'} replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected Student Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute allowedRole="STUDENT">
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/courses/:id"
              element={
                <ProtectedRoute>
                  <CourseDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/courses/:courseId/lessons/:lessonId"
              element={
                <ProtectedRoute>
                  <WatchLesson />
                </ProtectedRoute>
              }
            />

            {/* Protected Instructor Routes */}
            <Route
              path="/instructor-dashboard"
              element={
                <ProtectedRoute allowedRole="INSTRUCTOR">
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            {/* Fallback routing */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
