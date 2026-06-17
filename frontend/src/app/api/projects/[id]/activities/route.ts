import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;

    const activities = await db.activityHistory.findMany({
      where: { projectId },
      orderBy: { timestamp: "desc" }
    });

    return NextResponse.json({ success: true, activities });
  } catch (error: any) {
    console.error("Failed to fetch project activities:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;
    const body = await request.json();

    const activity = await db.activityHistory.create({
      data: {
        projectId,
        category: body.category,
        actor: body.actor,
        description: body.description,
        status: body.status // "Success", "Warning", "Error"
      }
    });

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const s3LogUrl = `${apiUrl}/api/log-change-s3?project_id=${projectId}&change_name=${encodeURIComponent(body.description)}&timestamp=${encodeURIComponent(activity.timestamp.toISOString())}`;
      await fetch(s3LogUrl, { method: "POST" });
    } catch (s3Err) {
      console.error("Failed to sync change to S3 activity log:", s3Err);
    }

    return NextResponse.json({ success: true, activity });
  } catch (error: any) {
    console.error("Failed to create activity log:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
