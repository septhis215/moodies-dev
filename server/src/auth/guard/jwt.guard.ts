import { AuthGuard } from '@nestjs/passport';

// 'jwt' is a keyword for jwt.strategy.ts to link both strategy and guard for jwt auth
export class JwtGuard extends AuthGuard('jwt') {
  constructor() {
    super();
  }
}
