import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — skip auth check entirely
  if (
    pathname.startsWith("/tour/") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth/") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // Rate limiting for API routes
  if (pathname.startsWith("/api/")) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

    let config: { maxRequests: number; windowMs: number } = RATE_LIMITS.api;
    let key = `api:${ip}`;

    if (pathname.includes("/upload/presign")) {
      config = RATE_LIMITS.upload;
      key = `upload:${ip}`;
    } else if (pathname.includes("/payments/") || pathname.includes("/webhooks/")) {
      // Don't rate limit webhooks (they come from payment providers)
      if (!pathname.includes("/webhooks/")) {
        config = RATE_LIMITS.payment;
        key = `payment:${ip}`;
      } else {
        return NextResponse.next();
      }
    }

    const result = rateLimit(key, config);
    if (!result.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
  }

  // Protected routes — check auth (Layer 1: middleware redirect)
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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/capture/:path*",
    "/checkout/:path*",
    "/api/:path*",
  ],
};
