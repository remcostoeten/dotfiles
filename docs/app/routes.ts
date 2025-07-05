import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('docs/page.tsx'),
  route(':slug*', 'docs/page.tsx'),
  route('api/search', 'docs/search.ts'),
] satisfies RouteConfig;
