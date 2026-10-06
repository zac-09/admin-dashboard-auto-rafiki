import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { useState } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { routes } from '@/app/router';
import { useSessionSync } from '@/lib/session';

function Harness({ path }: { path: string }) {
  useSessionSync();
  const [router] = useState(() => createMemoryRouter(routes, { initialEntries: [path] }));
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

/** The whole app (routes, session, react-query) at `path`, on whatever repositories are set. */
export function renderApp(path: string) {
  return render(<Harness path={path} />);
}
