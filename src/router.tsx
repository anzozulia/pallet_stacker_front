import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router';
import ConfigurePage from '@/routes/ConfigurePage';
// EAGER static import (like ConfigurePage) so /loading stays on the Configure→loading
// entry chunk and three NEVER enters it (D-03/C-06). NOT lazy, NO <Suspense>.
import LoadingPage from '@/routes/LoadingPage';

// Lazy-loaded so three / r3f / drei land only in the /result chunk (D-04),
// kept out of the initial Configure (main) bundle.
const ResultPage = lazy(() => import('@/routes/ResultPage'));

export const router = createBrowserRouter([
  { path: '/', element: <ConfigurePage /> },
  { path: '/loading', element: <LoadingPage /> },
  {
    path: '/result',
    element: (
      <Suspense fallback={<div>Loading viewer…</div>}>
        <ResultPage />
      </Suspense>
    ),
  },
]);
