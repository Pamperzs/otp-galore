import { getTokens } from "@/utils/auth";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    // Get the code from the URL
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json({ error: "No code provided" }, { status: 400 });
    }

    // Exchange the code for tokens
    const tokens = await getTokens(code);

    // Store the refresh token securely (you should implement this)
    // For example, save it in a database or secure storage

    return NextResponse.redirect("/dashboard");
  } catch (error) {
    console.error("Auth callback error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
