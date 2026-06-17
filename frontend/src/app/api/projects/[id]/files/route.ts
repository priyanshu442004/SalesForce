import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;

    const files = await db.uploadedFileReference.findMany({
      where: { projectId },
      orderBy: { uploadedAt: "desc" }
    });

    return NextResponse.json({ success: true, files });
  } catch (error: any) {
    console.error("Failed to fetch project files:", error);
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
    const { slot, fileName, fileSize, s3Key } = await request.json();

    if (!slot || !fileName || !fileSize || !s3Key) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    // Set all previous files in this slot for this project to inactive
    await db.uploadedFileReference.updateMany({
      where: { projectId, slot },
      data: { isActive: false }
    });

    // Create the new active file reference
    const newFile = await db.uploadedFileReference.create({
      data: {
        projectId,
        slot,
        fileName,
        fileSize,
        s3Key,
        isActive: true
      }
    });

    // Log the upload activity
    await db.activityHistory.create({
      data: {
        projectId,
        category: "Upload",
        actor: "System",
        description: `Uploaded file '${fileName}' (${fileSize}) in slot [${slot}].`,
        status: "Success"
      }
    });

    return NextResponse.json({ success: true, file: newFile });
  } catch (error: any) {
    console.error("Failed to register uploaded file:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;
    const { fileId } = await request.json();

    if (!fileId) {
      return NextResponse.json({ success: false, error: "fileId is required" }, { status: 400 });
    }

    // Find the file to revert to
    const targetFile = await db.uploadedFileReference.findUnique({
      where: { id: fileId }
    });

    if (!targetFile || targetFile.projectId !== projectId) {
      return NextResponse.json({ success: false, error: "File not found or project mismatch" }, { status: 404 });
    }

    const slot = targetFile.slot;

    // Set all files in this slot to inactive
    await db.uploadedFileReference.updateMany({
      where: { projectId, slot },
      data: { isActive: false }
    });

    // Set the target file to active (revert/undo action)
    const revertedFile = await db.uploadedFileReference.update({
      where: { id: fileId },
      data: { isActive: true }
    });

    // Log the revert activity
    await db.activityHistory.create({
      data: {
        projectId,
        category: "System",
        actor: "System",
        description: `Reverted slot [${slot}] to previous version: '${revertedFile.fileName}'.`,
        status: "Success"
      }
    });

    return NextResponse.json({ success: true, file: revertedFile });
  } catch (error: any) {
    console.error("Failed to revert file version:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;
    const { searchParams } = new URL(request.url);
    const slot = searchParams.get("slot");

    if (!slot) {
      return NextResponse.json({ success: false, error: "slot is required" }, { status: 400 });
    }

    // Set active files in this slot to inactive
    await db.uploadedFileReference.updateMany({
      where: { projectId, slot, isActive: true },
      data: { isActive: false }
    });

    // Add activity log
    await db.activityHistory.create({
      data: {
        projectId,
        category: "System",
        actor: "System",
        description: `Cleared file in slot [${slot}].`,
        status: "Success"
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to clear file reference:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

