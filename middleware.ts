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
    '/personal',
    '/accept-invite',
    '/verify-email',
    '/forgot-password',
    '/reset-password',
    '/magic-link',
    '/privacy',
    '/terms',
  ]

const isPublicRoute = publicRoutes.some((route) =>
    route === '/' ? path === '/' : path.startsWith(route)
  )

  // Routes that work for both anonymous and authenticated users — we never
  // bounce people away based on session state. /accept-invite needs both
  // (you're invited, you sign up); /verify-email needs both because a user
  // might click an old verify link after they've already signed in.
  // /privacy and /terms are linked from the footer and need to be readable
  // by everyone regardless of session state — bouncing a logged-in user
  // back to /dashboard when they click "Privacy Policy" was the bug.
  const dualAccessRoutes = ['/accept-invite', '/verify-email', '/privacy', '/terms']
  const isDualAccessRoute = dualAccessRoutes.some(r => path.startsWith(r))

  // If not authenticated and trying to access protected route
  if (!session && !isPublicRoute) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirect', path)
    return NextResponse.redirect(redirectUrl)
  }

  // If authenticated and trying to access auth pages, redirect to dashboard
  if (session && isPublicRoute && !isDualAccessRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Role-based routing
  if (session && path.startsWith('/dashboard')) {
    try {
      const { data: firmUser } = await supabase
        .from('firm_users')
        .select('role, client_id, firm_id')
        .eq('auth_user_id', session.user.id)
        .single()

      console.log('🔍 Middleware - Path:', path)
      console.log('🔍 Middleware - User role:', firmUser?.role)

      if (firmUser) {
        const role = firmUser.role;

        // Resolve account_type so we can treat personal-account firm_admins
        // like clients for routing purposes (the personal experience lives
        // entirely under /dashboard/client). Without this, the "block
        // non-clients from /dashboard/client" rule below bounced personal
        // users back to /dashboard, and the dashboard's client-side
        // redirect bounced them to /dashboard/client again — infinite loop.
        let isPersonal = false;
        try {
          const { data: firm } = await supabase
            .from('firms')
            .select('account_type')
            .eq('id', firmUser.firm_id)
            .single();
          isPersonal = firm?.account_type === 'personal';
        } catch (err) {
          console.warn('Could not load firm account_type:', err);
        }

        // ── BILLING: only firm_admin and owner ──────────────────────────────
        const isBillingPath = path === '/dashboard/billing' || path.startsWith('/dashboard/billing/');
        if (isBillingPath && role !== 'firm_admin' && role !== 'owner') {
          console.log('🔍 Middleware - Blocking billing access for role:', role)
          return NextResponse.redirect(new URL('/dashboard/settings', request.url))
        }

        // ── CLIENT-LIKE: clients AND personal-account users ─────────────────
        // Personal accounts are firm_admin on a firm-of-one, but their
        // experience lives under /dashboard/client, so apply the same
        // allow-list as real client-role users.
        const clientAllowedPaths = [
          '/dashboard/client',
          '/dashboard/category-dashboard',
          '/dashboard/receipts',
          '/dashboard/budget-settings',
          '/dashboard/conversations',
          '/dashboard/settings',
          '/dashboard/billing',
          '/dashboard/tax-codes',
          '/dashboard/reports',
          '/dashboard/reports/clients',
          '/dashboard/reports/edits',
          '/dashboard/email-inbox',
          '/dashboard/personal',
          '/dashboard/flags',
          // Goals page is personal-only; firm/accountant accounts have
          // no use for it (their clients each have their own data). The
          // page itself enforces personal-account access; this whitelist
          // entry lets the route load past the middleware client filter.
          '/dashboard/goals',
        ];

        const isClientLike = role === 'client' || isPersonal;

        // Redirect client-like users from /dashboard root to /dashboard/client
        if (isClientLike && path === '/dashboard') {
          return NextResponse.redirect(new URL('/dashboard/client', request.url));
        }

        const isClientAllowed = clientAllowedPaths.some(
          p => path === p || path.startsWith(p + '/')
        );

        if (role === 'client' && !isClientAllowed) {
          console.log('🔍 Middleware - Redirecting client to /dashboard/client')
          return NextResponse.redirect(new URL('/dashboard/client', request.url))
        }

        // ── NON-CLIENT-LIKE: block client portal ────────────────────────────
        // Personal accounts (isPersonal=true) ARE allowed into
        // /dashboard/client even though their role is firm_admin — only
        // bounce real firm_admins/accountants who belong on the firm view.
        if (!isClientLike && (path === '/dashboard/client' || path.startsWith('/dashboard/client/'))) {
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