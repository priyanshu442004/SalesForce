import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;

    const outputs = await db.outputHistory.findMany({
      where: { projectId },
      orderBy: { generatedAt: "desc" }
    });

    return NextResponse.json({ success: true, outputs });
  } catch (error: any) {
    console.error("Failed to fetch project outputs:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;
    const { fileName, fileType, s3Key, recordsCount } = await request.json();

    if (!fileName || !fileType || !s3Key) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    // Set all previous outputs of this type for this project to inactive
    await db.outputHistory.updateMany({
      where: { projectId, fileType },
      data: { isActive: false }
    });

    // Create the new active output reference
    const newOutput = await db.outputHistory.create({
      data: {
        projectId,
        fileName,
        fileType,
        s3Key,
        recordsCount: recordsCount !== undefined ? parseInt(recordsCount) : 0,
        isActive: true
      }
    });

    return NextResponse.json({ success: true, output: newOutput });
  } catch (error: any) {
    console.error("Failed to register generated output:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;
    const { outputId } = await request.json();

    if (!outputId) {
      return NextResponse.json({ success: false, error: "outputId is required" }, { status: 400 });
    }

    // Find the output to revert to
    const targetOutput = await db.outputHistory.findUnique({
      where: { id: outputId }
    });

    if (!targetOutput || targetOutput.projectId !== projectId) {
      return NextResponse.json({ success: false, error: "Output not found or project mismatch" }, { status: 404 });
    }

    const fileType = targetOutput.fileType;

    // Set all outputs of this type to inactive
    await db.outputHistory.updateMany({
      where: { projectId, fileType },
      data: { isActive: false }
    });

    // Set the target output to active (revert/undo action)
    const revertedOutput = await db.outputHistory.update({
      where: { id: outputId },
      data: { isActive: true }
    });

    return NextResponse.json({ success: true, output: revertedOutput });
  } catch (error: any) {
    console.error("Failed to revert output version:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
