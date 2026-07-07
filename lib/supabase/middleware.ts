import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Supabase middleware handler — refreshes the session cookie and
 * redirects unauthenticated users away from protected routes.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refresh the auth session — important so cookies don't expire.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Protected routes — must be logged in.
  if (path.startsWith("/monitoring") && !user) {
    // Allow the login page itself.
    if (path.startsWith("/monitoring/") || path === "/monitoring") {
      // BUT — check if they're hitting a public customer status page
      // Those are at /monitoring/[websiteId] which is a UUID. The admin
      // dashboard is at /monitoring, /monitoring/incidents, etc.
      // Actually, the customer portal is now at /status/. So all /monitoring
      // routes are admin-only.
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }
  }

  return supabaseResponse;
}
