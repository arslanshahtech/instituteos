import { Suspense, type PropsWithChildren } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { RouterProviderProps } from 'react-router-dom';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from './query-client.js';
import { AppErrorBoundary } from '../components/ui/AppErrorBoundary.js';
import { ToastProvider } from '../components/ui/ToastProvider.js';
import { AuthProvider } from '../auth/AuthProvider.js';

interface AppProvidersProps extends PropsWithChildren {
  router?: RouterProviderProps['router'];
}

export function AppProviders({ children, router }: AppProvidersProps) {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            {router ? (
              <Suspense
                fallback={
                  <main
                    style={{
                      display: 'grid',
                      minHeight: '50vh',
                      placeItems: 'center',
                      padding: '2rem',
                    }}
                    role="status"
                    aria-live="polite"
                  >
                    Loading page...
                  </main>
                }
              >
                <RouterProvider router={router} />
              </Suspense>
            ) : (
              children
            )}
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
