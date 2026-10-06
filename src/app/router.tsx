import { createBrowserRouter, type RouteObject } from 'react-router';

import { HomePage } from './HomePage';

export const routes: RouteObject[] = [{ path: '/', element: <HomePage /> }];

export function createRouter() {
  return createBrowserRouter(routes);
}
