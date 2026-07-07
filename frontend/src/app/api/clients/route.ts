import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
  }

  try {
    const clients = await db.client.findMany({
      where: { userId },
      include: {
        projects: {
          include: {
            files: true,
            activities: { orderBy: { timestamp: "desc" } }
          },
          orderBy: { updatedAt: "desc" }
        }
      },
      orderBy: { name: "asc" }
    });

    return NextResponse.json({ success: true, clients });
  } catch (error: any) {
    console.error("Failed to fetch clients:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId, name } = await request.json();

    if (!userId || !name) {
      return NextResponse.json({ success: false, error: "userId and name are required" }, { status: 400 });
    }

    // Check if client name already exists for this user
    const existingClient = await db.client.findUnique({
      where: {
        userId_name: {
          userId,
          name: name.trim()
        }
      }
    });

    if (existingClient) {
      return NextResponse.json({ success: false, error: "A client with this name already exists." }, { status: 400 });
    }

    const newClient = await db.client.create({
      data: {
        userId,
        name: name.trim()
      },
      include: {
        projects: true
      }
    });

    return NextResponse.json({ success: true, client: newClient });
  } catch (error: any) {
    console.error("Failed to create client:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
