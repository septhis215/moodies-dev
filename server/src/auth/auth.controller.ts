import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Patch,
  UseGuards,
  Get,
  Query,
  Req,
  Res
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { GetUser } from 'src/auth/decorator';
import * as authDto from './dto';
import * as User2 from '@prisma/client';
import { JwtGuard } from './guard';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @HttpCode(HttpStatus.CREATED)
  @Post('signup')
  signup(@Body() dto: authDto.RegisterDto) {
    console.log(dto);
    return this.authService.signup(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('signin')
  signin(@Body() dto: authDto.LoginDto) {
    return this.authService.signin(dto);
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard)
  @Patch('change-password')
  changePassword(
    @Body() dto: authDto.ChangePasswordDto,
    @GetUser() user: User2.User,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  forgotPassword(@Body() dto: authDto.ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard)
  @Post('logout')
  logout(@GetUser() user: User2.User) {
    // the logout can do in client side, just delete token
    return { message: 'Loggout out successfullly' };
  }
 
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Nest/Passport handles redirect to Google
  }

  // 2) Handle Google callback
@Get('google/callback')
@UseGuards(AuthGuard('google'))
async googleCallback(@Req() req, @Res() res) {
  const user = req.user;

  if (!user?.email) {
      return res.status(400).json({ message: 'No email from Google' });
    }

    try {
      // Check if the user already exists by email
      let existingUser = await prisma.user.findUnique({
        where: { email: user.email },
      });

      if (!existingUser) {
        // Create new user if not found
        existingUser = await prisma.user.create({
          data: {
            username: user.name,
            email: user.email,
            provider: 'google',
            googleId: user.googleId,
            password: user.password
          },
        });
        console.log('✅ User created in Prisma:', existingUser);
      } else {
        console.log('✅ Existing user found:', existingUser.email);
      }

      // Optional: generate JWT or redirect to frontend
      return res.json({ success: true, user: existingUser });
    } catch (err) {
      console.error('❌ Prisma error:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }
  }


}
