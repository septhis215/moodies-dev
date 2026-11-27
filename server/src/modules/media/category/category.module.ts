import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { AllModule } from '../all/all.module';

@Module({
    imports: [ConfigModule, AllModule],
    providers: [CategoryService],
    controllers: [CategoryController],
    exports: [CategoryService]
})
export class CategoryModule { }
