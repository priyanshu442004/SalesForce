import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;

    const project = await db.project.findUnique({
      where: { id },
      include: {
        // Newest upload first so Array.find() always selects the latest active
        // record per slot, even if a race condition temporarily left more than
        // one isActive=true row for the same slot.
        files: { orderBy: { uploadedAt: "desc" } },
        activities: { orderBy: { timestamp: "desc" } },
        outputs: { orderBy: { generatedAt: "desc" } }
      }
    });

    if (!project) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, project });
  } catch (error: any) {
    console.error("Failed to fetch project details:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const body = await request.json();

    const updatedProject = await db.project.update({
      where: { id },
      data: {
        status: body.status,
        progress: body.progress !== undefined ? parseFloat(body.progress) : undefined,
        stage: body.stage,
        recordsCount: body.recordsCount !== undefined ? parseInt(body.recordsCount) : undefined
      }
    });

    return NextResponse.json({ success: true, project: updatedProject });
  } catch (error: any) {
    console.error("Failed to update project:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
