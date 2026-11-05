import { createBrowserRouter, Navigate } from 'react-router-dom';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/dashboard',
    lazy: async () => {
      const { DashboardPage } = await import('@/features/dashboard/DashboardPage');
      return { Component: DashboardPage };
    },
  },
  {
    path: '/forecasts',
    lazy: async () => {
      const { ForecastsPage } = await import('@/features/forecasts/ForecastsPage');
      return { Component: ForecastsPage };
    },
  },
  {
    path: '/accuracy',
    lazy: async () => {
      const { AccuracyPage } = await import('@/features/accuracy/AccuracyPage');
      return { Component: AccuracyPage };
    },
  },
  {
    path: '/data-quality',
    lazy: async () => {
      const { DataQualityPage } = await import('@/features/data-quality/DataQualityPage');
      return { Component: DataQualityPage };
    },
  },
  {
    path: '/pipeline',
    lazy: async () => {
      const { PipelinePage } = await import('@/features/pipeline/PipelinePage');
      return { Component: PipelinePage };
    },
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);
