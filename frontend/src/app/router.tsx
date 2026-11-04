import { createBrowserRouter, Navigate } from 'react-router-dom';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { ForecastsPage } from '@/features/forecasts/ForecastsPage';
import { AccuracyPage } from '@/features/accuracy/AccuracyPage';
import { DataQualityPage } from '@/features/data-quality/DataQualityPage';
import { PipelinePage } from '@/features/pipeline/PipelinePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/dashboard',
    element: <DashboardPage />,
  },
  {
    path: '/forecasts',
    element: <ForecastsPage />,
  },
  {
    path: '/accuracy',
    element: <AccuracyPage />,
  },
  {
    path: '/data-quality',
    element: <DataQualityPage />,
  },
  {
    path: '/pipeline',
    element: <PipelinePage />,
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);
