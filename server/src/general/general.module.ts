import { Module } from '@nestjs/common';
import { GeneralService } from './general.service';
import { GeneralController } from './general.controller'; // optional
import { HttpModule } from '@nestjs/axios';

@Module({
    imports: [HttpModule],
    providers: [GeneralService],
    controllers: [GeneralController], // remove if you don't have it
    exports: [GeneralService],
})
export class GeneralModule { }
