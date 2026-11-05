import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const ForecastsPage = lazy(() =>
  import('@/features/forecasts/ForecastsPage').then((m) => ({ default: m.ForecastsPage }))
);
const AccuracyPage = lazy(() =>
  import('@/features/accuracy/AccuracyPage').then((m) => ({ default: m.AccuracyPage }))
);
const DataQualityPage = lazy(() =>
  import('@/features/data-quality/DataQualityPage').then((m) => ({ default: m.DataQualityPage }))
);
const PipelinePage = lazy(() =>
  import('@/features/pipeline/PipelinePage').then((m) => ({ default: m.PipelinePage }))
);

const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-[400px] text-slate-400 text-sm">
    <div className="animate-pulse flex items-center gap-2">
      <div className="w-2 h-2 bg-teal-500 rounded-full animate-ping" />
      <span>Loading module...</span>
    </div>
  </div>
);

const withSuspense = (Component: React.ComponentType) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/dashboard',
    element: withSuspense(DashboardPage),
  },
  {
    path: '/forecasts',
    element: withSuspense(ForecastsPage),
  },
  {
    path: '/accuracy',
    element: withSuspense(AccuracyPage),
  },
  {
    path: '/data-quality',
    element: withSuspense(DataQualityPage),
  },
  {
    path: '/pipeline',
    element: withSuspense(PipelinePage),
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);
