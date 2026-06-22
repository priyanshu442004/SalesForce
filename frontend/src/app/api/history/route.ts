import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/history?userId=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
  }

  try {
    const activities = await db.activityHistory.findMany({
      where: {
        project: {
          userId: userId,
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        timestamp: "desc",
      },
    });

    return NextResponse.json({ success: true, activities });
  } catch (error: any) {
    console.error("Failed to fetch user-wide activity history:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/history?userId=... (or ?activityId=...)
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const activityId = searchParams.get("activityId");
  const projectId = searchParams.get("projectId");
  const userId = searchParams.get("userId");

  try {
    if (activityId) {
      // Delete a single activity log entry
      await db.activityHistory.delete({
        where: { id: activityId },
      });
      return NextResponse.json({ success: true, message: "Activity log deleted successfully" });
    } else if (projectId) {
      // Purge all history for a specific project
      await db.activityHistory.deleteMany({
        where: { projectId },
      });
      return NextResponse.json({ success: true, message: `History for project ${projectId} purged successfully` });
    } else if (userId) {
      // Purge all history for the user's projects
      await db.activityHistory.deleteMany({
        where: {
          project: {
            userId,
          },
        },
      });
      return NextResponse.json({ success: true, message: "All activity history purged successfully" });
    }

    return NextResponse.json({ success: false, error: "Missing delete criteria (activityId, projectId, or userId)" }, { status: 400 });
  } catch (error: any) {
    console.error("Failed to delete/purge history:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
