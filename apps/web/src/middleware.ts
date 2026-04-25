import { defineMiddleware } from 'astro:middleware';
import { logWarn } from './lib/logger';

const PUBLIC_PATHS = ['/', '/login', '/signup', '/docs'];
const API_URL = import.meta.env.PUBLIC_SUPAPROXY_API_URL;
if (!API_URL) throw new Error('Missing required environment variable: SUPAPROXY_API_URL. Add it to your .env file (see .env.example for reference).');

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Allow static assets
  if (pathname.startsWith('/_') || pathname.includes('.')) {
    return next();
  }

  // Public paths — no auth required
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    // Still try to load user for header display
    const cookie = context.request.headers.get('cookie') || '';
    try {
      const res = await fetch(`${API_URL}/api/auth/session`, { headers: { cookie } });
      if (res.ok) {
        const data = await res.json();
        if (data.user) context.locals.user = data.user;
      }
    } catch (err) {
      logWarn('Session check failed for public path:', (err as Error).message);
    }
    return next();
  }

  // Protected paths: require auth
  const cookie = context.request.headers.get('cookie') || '';
  const sessionMatch = cookie.match(/supaproxy_session=([^;]+)/);

  if (!sessionMatch) {
    return context.redirect('/login');
  }

  try {
    const res = await fetch(`${API_URL}/api/auth/session`, { headers: { cookie } });
    if (!res.ok) {
      logWarn('Session endpoint returned', res.status);
      return context.redirect('/login');
    }
    const data = await res.json();
    if (!data.user) {
      return context.redirect('/login');
    }
    context.locals.user = data.user;
  } catch (err) {
    logWarn('Session check failed:', (err as Error).message);
    return context.redirect('/login');
  }

  return next();
});
