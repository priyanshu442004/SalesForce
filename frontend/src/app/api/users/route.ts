import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Upsert dummy users to ensure they have the correct emails and passwords
    const dummyUsers = [
      { name: "Arthita", email: "arthita@mail.com", password: "12345678" },
      { name: "Priyanshu", email: "priyanshu@mail.com", password: "12345678" },
      { name: "Amit", email: "amit@mail.com", password: "12345678" }
    ];

    for (const u of dummyUsers) {
      await db.user.upsert({
        where: { name: u.name },
        update: {
          email: u.email,
          password: u.password
        },
        create: u
      });
    }

    const users = await db.user.findMany({
      orderBy: { name: "asc" }
    });

    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    console.error("Failed to fetch/seed users:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

