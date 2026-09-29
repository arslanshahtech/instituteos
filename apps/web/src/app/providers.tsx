import type { PropsWithChildren } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { RouterProviderProps } from 'react-router-dom';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from './query-client.js';
import { AppErrorBoundary } from '../components/ui/AppErrorBoundary.js';
import { ToastProvider } from '../components/ui/ToastProvider.js';

interface AppProvidersProps extends PropsWithChildren {
  router?: RouterProviderProps['router'];
}

export function AppProviders({ children, router }: AppProvidersProps) {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          {router ? <RouterProvider router={router} /> : children}
        </ToastProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
