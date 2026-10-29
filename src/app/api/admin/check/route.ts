import { NextRequest, NextResponse } from "next/server";
import { checkIsAdmin } from "@/src/lib/auth/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/check
 *
 * Lightweight privilege introspection endpoint.
 * Returns HTTP 200 with { success: true, isAdmin: boolean, userId: string | null }.
 * Used by client navigation elements (such as AppSidebar and Header) to conditionally
 * render staff entry points without triggering 403 error logs in candidate consoles.
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await checkIsAdmin(req);
    return NextResponse.json(
      {
        success: true,
        isAdmin: authResult.isAdmin,
        userId: authResult.userId,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("[ADMIN_CHECK_ERROR]", error);
    return NextResponse.json(
      {
        success: true,
        isAdmin: false,
        userId: null,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  }
}
