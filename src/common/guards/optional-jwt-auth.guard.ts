import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional JWT Auth Guard
 * Attempts to authenticate the user via JWT token,
 * but does not throw an error if authentication fails.
 * Useful for endpoints that work for both authenticated and unauthenticated users.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Override handleRequest to not throw error when no user is found
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleRequest<TUser = unknown>(err: Error | null, user: TUser, info: unknown, context: ExecutionContext, status?: unknown): TUser | null {
    // If there's an error or no user, just return null instead of throwing
    if (err || !user) {
      return null;
    }
    return user;
  }
}
