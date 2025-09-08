import { Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../auth/guard';
import { GetUser } from 'src/auth/decorator';
import * as User2 from '@prisma/client';

@UseGuards(JwtGuard) // refer to jwt.guard.ts & jwt.strategy.ts, 'jwt' is a keyword which links them together
@Controller('user')
export class UserController {
  @Get('profile')
  getProfile(@GetUser() user: User2.User) {
    const { id, password, createdAt, ...userData } = user; // remove id & password from user object
    return userData; // refer to jwt.strategy.ts validate function, it able to get user object(info) because it is validated
  }

  @Patch('edit')
  editUser() {}
}
