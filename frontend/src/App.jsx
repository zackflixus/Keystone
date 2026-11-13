import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { getCurrentUser } from './store/slices/authSlice';
import Login from './features/auth/Login';
import Register from './features/auth/Register';
import ForgotPassword from './features/auth/ForgotPassword';
import ResetPassword from './features/auth/ResetPassword';
import LandingPage from './features/landing/LandingPage';
import Dashboard from './features/dashboard/Dashboard';
import Workspace from './features/workspace/Workspace';
import ProjectBoard from './features/board/ProjectBoard';
import TaskDetail from './features/tasks/TaskDetail';
import MyTasks from './features/tasks/MyTasks';
import Inbox from './features/inbox/Inbox';
import Profile from './features/profile/Profile';
import Settings from './features/settings/Settings';
import AcceptInvite from './features/invites/AcceptInvite';
import Reports from './features/reports/Reports';
import Rules from './features/rules/Rules';
import Layout from './components/Layout';
import Logo from './components/Logo';

// Public paths that should never be used as post-login redirect destinations.
const PUBLIC_PATHS = new Set(['/', '/login', '/register']);

function redirectAfterAuth(from) {
  if (!from || PUBLIC_PATHS.has(from)) return '/dashboard';
  return from;
}

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search + location.hash }} replace />;
  }
  return children;
}

function App() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { isAuthenticated, loading } = useAppSelector((state) => state.auth);
  const [authBootstrapped, setAuthBootstrapped] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token && !isAuthenticated) {
      dispatch(getCurrentUser()).finally(() => setAuthBootstrapped(true));
    } else {
      setAuthBootstrapped(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!authBootstrapped || (loading && !isAuthenticated)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--karya-bg)]">
        <div className="flex flex-col items-center space-y-3">
          <Logo size={40} className="rounded-xl shadow-lg animate-pulse" />
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-karya-blue" />
        </div>
      </div>
    );
  }

  const afterAuth = redirectAfterAuth(location.state?.from);

  return (
    <Routes>
      {/* Public: landing page — guests see it, authenticated users go to dashboard */}
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />} />

      {/* Auth pages */}
      <Route path="/login"    element={!isAuthenticated ? <Login />    : <Navigate to={afterAuth} replace />} />
      <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to={afterAuth} replace />} />
      <Route path="/forgot-password" element={!isAuthenticated ? <ForgotPassword /> : <Navigate to={afterAuth} replace />} />
      <Route path="/reset-password/:token" element={!isAuthenticated ? <ResetPassword /> : <Navigate to={afterAuth} replace />} />

      {/* Invite accept is always public */}
      <Route path="/invite/accept/:token" element={<AcceptInvite />} />

      {/* Protected app shell */}
      <Route element={<Layout />}>
        <Route path="/dashboard"             element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/my-tasks"              element={<ProtectedRoute><MyTasks /></ProtectedRoute>} />
        <Route path="/inbox"                 element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
        <Route path="/profile"              element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/settings"              element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/reports"               element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/rules"                 element={<ProtectedRoute><Rules /></ProtectedRoute>} />
        <Route path="/workspace/:workspaceId" element={<ProtectedRoute><Workspace /></ProtectedRoute>} />
        <Route path="/project/:projectId"    element={<ProtectedRoute><ProjectBoard /></ProtectedRoute>} />
        <Route path="/task/:taskId"          element={<ProtectedRoute><TaskDetail /></ProtectedRoute>} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />} />
    </Routes>
  );
}

export default App;
