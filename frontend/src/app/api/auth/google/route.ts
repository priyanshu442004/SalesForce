import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { credential } = await request.json();

    if (!credential) {
      return NextResponse.json(
        { success: false, error: "Credential token is required" },
        { status: 400 }
      );
    }

    // Verify Google ID token using Google's tokeninfo API
    const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
    const googleResponse = await fetch(verifyUrl);

    if (!googleResponse.ok) {
      return NextResponse.json(
        { success: false, error: "Failed to verify Google credential" },
        { status: 400 }
      );
    }

    const payload = await googleResponse.json();

    // Verify client ID matching
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (clientId && payload.aud !== clientId) {
      return NextResponse.json(
        { success: false, error: "Google client ID mismatch" },
        { status: 400 }
      );
    }

    const email = payload.email?.toLowerCase().trim();
    let name = payload.name?.trim();

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email not provided by Google account" },
        { status: 400 }
      );
    }

    // Find existing user by email
    let user = await db.user.findUnique({
      where: { email }
    });

    if (!user) {
      if (!name) {
        name = email.split("@")[0];
      }

      // Check if user with this name already exists
      const existingName = await db.user.findUnique({
        where: { name }
      });

      if (existingName) {
        // Append random string to name to keep it unique
        name = `${name}_${Math.floor(Math.random() * 1000)}`;
      }

      // Create new user for this Google account
      user = await db.user.create({
        data: {
          email,
          name,
          password: "google-auth-user"
        }
      });
    }

    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json({
      success: true,
      user: userWithoutPassword
    });
  } catch (error: any) {
    console.error("Google authentication failed:", error);
    return NextResponse.json(
      { success: false, error: error.message || "An error occurred during Google sign-in" },
      { status: 500 }
    );
  }
}
