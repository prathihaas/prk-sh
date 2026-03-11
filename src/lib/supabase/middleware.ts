import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const isMockMode = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

export async function updateSession(request: NextRequest) {
  // In mock mode, skip all Supabase auth — just pass through
  if (isMockMode) {
    // Redirect root to dashboard
    if (request.nextUrl.pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    // Redirect login to dashboard (no need to login in mock mode)
    if (request.nextUrl.pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    // Set default scope cookies if missing
    const response = NextResponse.next({ request });
    if (!request.cookies.get("scope_company_id")) {
      response.cookies.set("scope_company_id", "00000000-0000-0000-0000-200000000001", {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    if (!request.cookies.get("scope_branch_id")) {
      response.cookies.set("scope_branch_id", "00000000-0000-0000-0000-300000000001", {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return response;
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — this is critical for keeping the JWT alive
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Unauthenticated users trying to access protected routes → redirect to login
  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");
  const isCallbackRoute = request.nextUrl.pathname.startsWith("/auth/callback");

  if (!user && !isAuthRoute && !isCallbackRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated users on login page → redirect to dashboard
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
