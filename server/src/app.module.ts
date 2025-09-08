import { Module } from '@nestjs/common';
import { GeneralModule } from './general/general.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './routes/user/user.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    AuthModule,
    UserModule,
    PrismaModule,
    GeneralModule,
    ConfigModule.forRoot({ isGlobal: true }),
  ],
})
export class AppModule {}
