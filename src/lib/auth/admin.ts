import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

export interface AdminAuthResult {
  isAdmin: boolean;
  userId: string | null;
  error?: string;
  status?: number;
}

export function getAdminUserIds(): string[] {
  return (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getAllowedIPs(): string[] {
  return (process.env.ADMIN_ALLOWED_IPS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getClientIP(req?: NextRequest | Request): string {
  if (!req) return "127.0.0.1";
  
  const headers = req.headers;
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();

  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "127.0.0.1";
}

export function isLocalhostIP(ip: string): boolean {
  const localhostAliases = ["127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost"];
  return localhostAliases.includes(ip);
}

/**
 * Checks whether the current caller has administrative privileges.
 *
 * Evaluation order:
 * 1. Clerk session authentication (must have valid userId).
 * 2. Role check via session claims (e.g. metadata.role === "admin" or role === "admin").
 * 3. User ID match against ADMIN_USER_IDS allowlist.
 * 4. In "development" mode, if ADMIN_USER_IDS is empty and role is unset, allows local dev inspection.
 *    In "production" or other modes, strictly requires matching ADMIN_USER_IDS or admin role.
 * 5. IP allowlist check (ADMIN_ALLOWED_IPS) if configured, always exempting localhost loopback.
 */
export async function checkIsAdmin(
  req?: NextRequest | Request,
  explicitAuth?: { userId: string | null; sessionClaims?: Record<string, unknown> | null }
): Promise<AdminAuthResult> {
  let userId: string | null = null;
  let sessionClaims: Record<string, unknown> | null | undefined = null;

  if (explicitAuth) {
    userId = explicitAuth.userId;
    sessionClaims = explicitAuth.sessionClaims;
  } else {
    try {
      const clerkAuth = await auth();
      userId = clerkAuth.userId;
      sessionClaims = clerkAuth.sessionClaims as Record<string, unknown> | null;
    } catch {
      userId = null;
      sessionClaims = null;
    }
  }

  // 1. Authenticate request
  if (!userId) {
    return {
      isAdmin: false,
      userId: null,
      error: "Unauthorized",
      status: 401,
    };
  }

  // 2. Role check from session claims
  const claims = sessionClaims || {};
  const metadataRole =
    (claims.metadata as Record<string, unknown> | undefined)?.role ||
    (claims.publicMetadata as Record<string, unknown> | undefined)?.role;
  const directRole = claims.role;
  const isRoleAdmin = metadataRole === "admin" || directRole === "admin";

  // 3. User ID allowlist check
  const adminIds = getAdminUserIds();
  const isAllowlisted = adminIds.includes(userId);

  // 4. Determine admin status based on environment
  const isDev = process.env.NODE_ENV === "development";
  let hasPrivilege = false;

  if (isRoleAdmin || isAllowlisted) {
    hasPrivilege = true;
  } else if (isDev && adminIds.length === 0) {
    // Unset allowlist in development mode enables local developer preview
    hasPrivilege = true;
  }

  if (!hasPrivilege) {
    return {
      isAdmin: false,
      userId,
      error: "Forbidden: Admin privileges required",
      status: 403,
    };
  }

  // 5. IP allowlist check if configured
  const allowedIPs = getAllowedIPs();
  if (allowedIPs.length > 0) {
    const clientIP = getClientIP(req);
    if (!isLocalhostIP(clientIP) && !allowedIPs.includes(clientIP)) {
      return {
        isAdmin: false,
        userId,
        error: `Forbidden: IP ${clientIP} not in allowlist`,
        status: 403,
      };
    }
  }

  return {
    isAdmin: true,
    userId,
  };
}
