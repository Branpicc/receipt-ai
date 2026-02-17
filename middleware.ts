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
    '/login',
    '/signup',
    '/accept-invitation',
    '/forgot-password',
    '/reset-password',
    '/magic-link',
  ]

  const isPublicRoute = publicRoutes.some((route) => path.startsWith(route))

  // If not authenticated and trying to access protected route
  if (!session && !isPublicRoute) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirect', path)
    return NextResponse.redirect(redirectUrl)
  }

  // If authenticated and trying to access auth pages, redirect to dashboard
  if (session && isPublicRoute && path !== '/accept-invitation') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Get user role for role-based routing
  if (session && path.startsWith('/dashboard')) {
    try {
      const { data: firmUser } = await supabase
        .from('firm_users')
        .select('role, client_id')
        .eq('auth_user_id', session.user.id)
        .single()

      if (firmUser) {
        // Client users should be redirected to client portal
        if (firmUser.role === 'client' && !path.startsWith('/dashboard/client')) {
          return NextResponse.redirect(new URL('/dashboard/client', request.url))
        }

        // Non-client users should not access client portal
        if (firmUser.role !== 'client' && path.startsWith('/dashboard/client')) {
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
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     * - api routes (handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)',
  ],
}
