import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    const trimmedEmail = email.toLowerCase().trim();
    const trimmedName = name.trim();

    // Check if user with email already exists
    const existingEmail = await db.user.findUnique({
      where: { email: trimmedEmail }
    });

    if (existingEmail) {
      return NextResponse.json(
        { success: false, error: "A user with this email address already exists" },
        { status: 400 }
      );
    }

    // Check if user with name already exists
    const existingName = await db.user.findUnique({
      where: { name: trimmedName }
    });

    if (existingName) {
      return NextResponse.json(
        { success: false, error: "A user with this name already exists" },
        { status: 400 }
      );
    }

    // Create the new user
    const newUser = await db.user.create({
      data: {
        name: trimmedName,
        email: trimmedEmail,
        password
      }
    });

    const { password: _, ...userWithoutPassword } = newUser;

    return NextResponse.json({
      success: true,
      user: userWithoutPassword
    });
  } catch (error: any) {
    console.error("User registration failed:", error);
    return NextResponse.json(
      { success: false, error: error.message || "An error occurred during registration" },
      { status: 500 }
    );
  }
}
