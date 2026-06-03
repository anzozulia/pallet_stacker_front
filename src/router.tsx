import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router';
import ConfigurePage from '@/routes/ConfigurePage';

// Lazy-loaded so three / r3f / drei land only in the /result chunk (D-04),
// kept out of the initial Configure (main) bundle.
const ResultPage = lazy(() => import('@/routes/ResultPage'));

export const router = createBrowserRouter([
  { path: '/', element: <ConfigurePage /> },
  {
    path: '/result',
    element: (
      <Suspense fallback={<div>Loading viewer…</div>}>
        <ResultPage />
      </Suspense>
    ),
  },
]);
