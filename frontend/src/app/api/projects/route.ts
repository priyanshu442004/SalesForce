import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
  }

  try {
    // Backfill: any project at 100% / TRANSFORMED that wasn't marked Completed
    // (predates the auto-status logic). Idempotent — becomes a no-op once done.
    await db.project.updateMany({
      where: { userId, progress: 100, stage: "TRANSFORMED", status: { not: "Completed" } },
      data: { status: "Completed" },
    });

    const projects = await db.project.findMany({
      where: { userId },
      include: {
        files: true,
        activities: { orderBy: { timestamp: "desc" } }
      },
      orderBy: { updatedAt: "desc" }
    });

    return NextResponse.json({ success: true, projects });
  } catch (error: any) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId, name } = await request.json();

    if (!userId || !name) {
      return NextResponse.json({ success: false, error: "userId and name are required" }, { status: 400 });
    }

    const newProject = await db.project.create({
      data: {
        userId,
        name,
        status: "In Progress",
        progress: 0.0,
        stage: "upload"
      },
      include: {
        files: true,
        activities: true
      }
    });

    // Create a default initial activity log
    await db.activityHistory.create({
      data: {
        projectId: newProject.id,
        category: "System",
        actor: "System",
        description: `Project '${name}' initialized.`,
        status: "Success"
      }
    });

    return NextResponse.json({ success: true, project: newProject });
  } catch (error: any) {
    console.error("Failed to create project:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
