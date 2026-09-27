import { Request } from 'express';
import { User } from '../../users/entities/user.entity';

export interface AuthenticatedRequest extends Request {
  user: User;
  /** Session the caller's access token belongs to (its `sid` claim), when present. */
  sessionId?: number;
}
