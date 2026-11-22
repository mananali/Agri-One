import type { UserRole } from '@prisma/client';
import type { Request } from 'express';

export type AuthUser = { sub: string; role: UserRole; organizationId: string | null };
export type AuthenticatedRequest = Request & { user: AuthUser };
