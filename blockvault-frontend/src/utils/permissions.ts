export type UserRole = "ADMIN" | "OWNER" | "EDITOR" | "VIEWER";

export function canRedact(role?: UserRole | string): boolean {
  return role === "OWNER" || role === "EDITOR" || role === "ADMIN";
}

export function canShare(role?: UserRole | string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canDelete(role?: UserRole | string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canRevokeShare(role?: UserRole | string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function isAdmin(role?: UserRole | string): boolean {
  return role === "ADMIN";
}
