// app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { generateSessionToken } from "@/app/lib/auth-helper";

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const correctPassword = process.env.DASHBOARD_PASSWORD;

    if (!correctPassword) {
      return NextResponse.json({ error: "Server password env not set" }, { status: 500 });
    }

    if (password !== correctPassword) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    // Generate token valid
    const token = await generateSessionToken(correctPassword);

    const response = NextResponse.json({ success: true });

    // Pasang HTTP-Only Cookie (Exp: 7 Hari)
    response.cookies.set("portfolio_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, 
      path: "/",
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}