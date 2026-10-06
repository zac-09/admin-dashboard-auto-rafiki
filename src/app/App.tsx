import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { useState } from 'react';
import { RouterProvider } from 'react-router';

import { createQueryClient } from '@/lib/queryClient';
import { useSessionSync } from '@/lib/session';

import { createRouter } from './router';

export function App() {
  const [queryClient] = useState(createQueryClient);
  const [router] = useState(createRouter);
  useSessionSync();
  return (
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MotionConfig>
  );
}
