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

    return NextResponse.json({ success: true, activity });
  } catch (error: any) {
    console.error("Failed to create activity log:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
