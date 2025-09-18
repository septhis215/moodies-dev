import { Controller, Get } from '@nestjs/common';
import { GeneralService } from './general.service';

@Controller('api/general')
export class GeneralController {
    constructor(private generalService: GeneralService) { }

    @Get('featured')
    async featured() {
        return this.generalService.getFeatured(25); // number of items in the carousel row
    }
    @Get('trending')
    async trending() {
        return this.generalService.getTrending(25);
    }

    @Get('trailers')
    async trailers() {
        return this.generalService.getTrailers(25);
    }

    @Get('favorites')
    async favorites() {
        return this.generalService.getFavorites(25);
    }
    @Get('koreaTrending')
    async koreaTrending() {
        return this.generalService.getKoreaTrending(25);
    }
    @Get('peoples')
    async peoples() {
        return this.generalService.getPeople(25);
    }
}
