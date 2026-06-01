import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

@Module({
    imports: [ConfigModule],
    providers: [CategoryService],
    controllers: [CategoryController],
    exports: [CategoryService]
})
export class CategoryModule { }
