import type { ModulePermission, SessionResponse } from "@integrador/contracts";

const entryRoutes: Array<{
  href: string;
  permissions: ModulePermission[];
}> = [
  { href: "/app/nfe", permissions: ["nfe:view"] },
  { href: "/app/dashboard", permissions: ["dashboard:view"] },
  { href: "/app/products", permissions: ["products:view"] },
  { href: "/app/people", permissions: ["people:view"] },
  { href: "/app/documents", permissions: ["documents:view"] },
  { href: "/app/commercial", permissions: ["commercial:view"] },
  { href: "/app/goals", permissions: ["goals:view"] },
  { href: "/app/finance", permissions: ["finance:view"] },
  { href: "/app/operations", permissions: ["operations:view"] },
  { href: "/app/settings", permissions: ["settings:view"] },
];

export function homeRoute(
  session: Pick<SessionResponse, "permissions" | "user">,
): string {
  const route = entryRoutes.find((entry) =>
    entry.permissions.some((permission) =>
      session.permissions.includes(permission),
    ),
  );
  if (route) return route.href;
  return session.user.superAdmin ? "/app/organizations" : "/app/nfe";
}
