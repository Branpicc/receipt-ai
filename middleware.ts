// middleware.ts - Protect routes and enforce authentication
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const path = request.nextUrl.pathname

  // Public routes that don't require authentication
const publicRoutes = [
    '/',
    '/login',
    '/signup',
    '/accept-invite',
    '/forgot-password',
    '/reset-password',
    '/magic-link',
  ]
  
const isPublicRoute = publicRoutes.some((route) => 
    route === '/' ? path === '/' : path.startsWith(route)
  )
  
  // If not authenticated and trying to access protected route
  if (!session && !isPublicRoute) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirect', path)
    return NextResponse.redirect(redirectUrl)
  }

  // If authenticated and trying to access auth pages, redirect to dashboard
  if (session && isPublicRoute && path !== '/accept-invite') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Role-based routing
  if (session && path.startsWith('/dashboard')) {
    try {
      const { data: firmUser } = await supabase
        .from('firm_users')
        .select('role, client_id')
        .eq('auth_user_id', session.user.id)
        .single()

      console.log('🔍 Middleware - Path:', path)
      console.log('🔍 Middleware - User role:', firmUser?.role)

      if (firmUser) {
        const role = firmUser.role;

        // ── BILLING: only firm_admin and owner ──────────────────────────────
        const isBillingPath = path === '/dashboard/billing' || path.startsWith('/dashboard/billing/');
        if (isBillingPath && role !== 'firm_admin' && role !== 'owner') {
          console.log('🔍 Middleware - Blocking billing access for role:', role)
          return NextResponse.redirect(new URL('/dashboard/settings', request.url))
        }

        // ── CLIENT: allowed paths ────────────────────────────────────────────
const clientAllowedPaths = [
  '/dashboard/client',
  '/dashboard/category-dashboard',
  '/dashboard/receipts',
  '/dashboard/budget-settings',
  '/dashboard/conversations',
  '/dashboard/settings',
  '/dashboard/reports/clients',
  '/dashboard/reports/edits',
];

// Redirect clients from /dashboard root to /dashboard/client
if (role === 'client' && path === '/dashboard') {
  return NextResponse.redirect(new URL('/dashboard/client', request.url));
}

        const isClientAllowed = clientAllowedPaths.some(
          p => path === p || path.startsWith(p + '/')
        );

        if (role === 'client' && !isClientAllowed) {
          console.log('🔍 Middleware - Redirecting client to /dashboard/client')
          return NextResponse.redirect(new URL('/dashboard/client', request.url))
        }

        // ── NON-CLIENT: block client portal ─────────────────────────────────
        if (role !== 'client' && (path === '/dashboard/client' || path.startsWith('/dashboard/client/'))) {
          console.log('🔍 Middleware - Redirecting non-client from /dashboard/client')
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }
      }
    } catch (error) {
      console.error('Error checking user role:', error)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)',
  ],
}