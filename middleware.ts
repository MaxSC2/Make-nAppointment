import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type Role = "patient" | "doctor" | "admin" | "labtech";

const roleRoutes: Record<Role, string[]> = {
  patient: ["/dashboard", "/appointment", "/emk", "/laboratory"],
  doctor: ["/doctor"],
  admin: ["/admin"],
  labtech: ["/lab"],
};

const defaultRouteFor: Record<Role, string> = {
  patient: "/dashboard",
  doctor: "/doctor/dashboard",
  admin: "/admin/dashboard",
  labtech: "/lab/queue",
};

const authRoutes = ["/login", "/register"];

function getRoleFromCookie(request: NextRequest): Role | null {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return null;
  // TODO: заменить на верификацию JWT и извлечение роли из payload
  const role = request.cookies.get("role")?.value as Role | undefined;
  if (role && role in roleRoutes) return role;
  // fallback для старых сессий без роли
  return "patient";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const role = getRoleFromCookie(request);

  const isAuthRoute = authRoutes.some((r) => pathname === r);
  const isLanding = pathname === "/" || pathname === "/landing2" || pathname.startsWith("/icon");

  if (role && isAuthRoute) {
    return NextResponse.redirect(new URL(defaultRouteFor[role], request.url));
  }

  if (!role && !isLanding && !isAuthRoute) {
    const url = new URL("/login", request.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (role) {
    const allowedRoutes = roleRoutes[role];
    const isAllowed = allowedRoutes.some((r) => pathname === r || pathname.startsWith(r + "/"));
    if (!isAllowed && !isLanding && !isAuthRoute) {
      return NextResponse.redirect(new URL(defaultRouteFor[role], request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.bak).*)"],
};
