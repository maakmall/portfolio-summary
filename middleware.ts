// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateSessionToken } from "@/app/lib/auth-helper";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ambil token session dari cookie
  const sessionToken = request.cookies.get("portfolio_session")?.value;
  
  // Hitung token yang sah berdasarkan password di env
  const validPassword = process.env.DASHBOARD_PASSWORD || "";
  const expectedToken = await generateSessionToken(validPassword);

  const isAuthenticated = sessionToken === expectedToken;

  // 1. Jika mencoba akses dashboard / API tapi BELUM login -> Tendang ke /login
  if (!isAuthenticated && (pathname === "/" || pathname.startsWith("/api/portfolio"))) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Jika SUDAH login tapi mau iseng buka /login lagi -> Balikin ke dashboard /
  if (isAuthenticated && pathname === "/login") {
    const dashboardUrl = new URL("/", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

// Tentukan rute mana saja yang harus dilewati middleware ini
export const config = {
  matcher: ["/", "/login", "/api/portfolio"],
};