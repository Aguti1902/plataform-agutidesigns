import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/middleware';

/**
 * Capa 1: Basic Auth temporal (perímetro completo)
 * Capa 2: Sesión Supabase + guard role=admin
 *
 * Las dos se aplican en orden. La basic auth se desactiva poniendo
 * BASIC_AUTH_USER y BASIC_AUTH_PASSWORD vacíos.
 */

function checkBasicAuth(request: NextRequest): NextResponse | null {
  const user = process.env.BASIC_AUTH_USER ?? '';
  const password = process.env.BASIC_AUTH_PASSWORD ?? '';

  if (!user || !password) return null;

  const header = request.headers.get('authorization');
  if (header) {
    const [scheme, encoded] = header.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const sep = decoded.indexOf(':');
      const providedUser = sep === -1 ? decoded : decoded.slice(0, sep);
      const providedPassword = sep === -1 ? '' : decoded.slice(sep + 1);
      if (providedUser === user && providedPassword === password) return null;
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Mission Control"' },
  });
}

export async function middleware(request: NextRequest) {
  const basicAuthFail = checkBasicAuth(request);
  if (basicAuthFail) return basicAuthFail;

  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
