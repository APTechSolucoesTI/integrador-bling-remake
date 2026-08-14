import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { ModulePermission } from "@integrador/contracts";
import type { AuthenticatedRequest } from "./auth.types.js";

const PERMISSIONS_KEY = "module_permissions";
const ANY_PERMISSIONS_KEY = "any_module_permissions";
export const RequirePermissions = (...permissions: ModulePermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
export const RequireAnyPermission = (...permissions: ModulePermission[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.auth.superAdmin) return true;
    const permissions = this.reflector.getAllAndOverride<ModulePermission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const anyPermissions = this.reflector.getAllAndOverride<ModulePermission[]>(
      ANY_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    return (
      (!permissions?.length ||
        permissions.every((permission) =>
          request.auth.permissions.includes(permission),
        )) &&
      (!anyPermissions?.length ||
        anyPermissions.some((permission) =>
          request.auth.permissions.includes(permission),
        ))
    );
  }
}
