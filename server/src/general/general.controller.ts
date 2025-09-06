import { Controller, Get } from '@nestjs/common';
import { GeneralService } from './general.service';

@Controller('api/general')
export class GeneralController {
    constructor(private generalService: GeneralService) { }

    @Get('featured')
    async featured() {
        return this.generalService.getFeatured(20); // number of items in the carousel row
    }
}
