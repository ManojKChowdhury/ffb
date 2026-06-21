import React from 'react';
import { createRootRouteWithContext, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router';
import { QueryClient } from '@tanstack/react-query';
import { Navigation } from './components/Navigation';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Results } from './pages/Results';
import { Fantasy } from './pages/Fantasy';
import { Leaderboard } from './pages/Leaderboard';

// 1. Declare the Router context type
interface MyRouterContext {
  queryClient: QueryClient;
}

// 2. Define the Root route enclosing the navbar layout and viewport outlet
const rootRoute = createRootRouteWithContext<MyRouterContext>()({
  component: () => (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navigation />
      <div className="flex-1 flex flex-col">
        <Outlet />
      </div>
      <footer className="py-6 border-t border-slate-900 bg-slate-950 text-center text-xs text-slate-600">
        &copy; 2026 Championship Fantasy Football. All rights reserved.
      </footer>
    </div>
  )
});

// Helper validation for protected pages
const checkAuth = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw redirect({ to: '/login' });
  }
};

// Helper validation for guest-only login/register pages
const checkGuest = () => {
  const token = localStorage.getItem('token');
  if (token) {
    throw redirect({ to: '/' });
  }
};

// 3. Define the actual Routes mapping
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: checkAuth,
  component: Dashboard
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: checkGuest,
  component: Login
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  beforeLoad: checkGuest,
  component: Register
});

const resultsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/matches/$eventId',
  beforeLoad: checkAuth,
  component: Results
});

const fantasyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/fantasy/$eventId',
  beforeLoad: checkAuth,
  component: Fantasy
});

const leaderboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/leaderboard',
  beforeLoad: checkAuth,
  component: Leaderboard
});

// 4. Assemble route tree and compile Router
const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
  resultsRoute,
  fantasyRoute,
  leaderboardRoute
]);

export const router = createRouter({
  routeTree,
  context: {
    queryClient: undefined! // will be provided inside main.tsx
  }
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
