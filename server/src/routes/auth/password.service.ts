import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as argon from 'argon2'; 

const prisma = new PrismaClient();

@Injectable()
export class PasswordService {
  async checkEmail(email: string) {
    if (!email) throw new BadRequestException('Email is required');
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('Email not found');
    return { message: 'Email exists' };
  }

  async changePassword(email: string, newPassword: string, confirmPassword: string) {
    if (!email || !newPassword || !confirmPassword)
      throw new BadRequestException('Missing fields');

    if (newPassword !== confirmPassword)
      throw new BadRequestException('Passwords do not match');

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('User not found');

    // ✅ Hash new password using Argon2
    const hashedPassword = await argon.hash(newPassword);

    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    return { message: 'Password updated successfully' };
  }
}
