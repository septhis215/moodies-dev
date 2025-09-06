import { Module } from '@nestjs/common';
import { GeneralModule } from './general/general.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [GeneralModule, ConfigModule.forRoot({ isGlobal: true }), // loads .env automatically
  ],
})
export class AppModule { }