import { Controller, Get, Post, Body, Query, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { MoodsService } from './moods.service';

import { GetRecommendationsDto } from './dto/get-recommendations.dto';
import { LogMoodDto } from './dto/log-mood.dto';
import { RecommendationFeedbackDto } from './dto/recommendation-feedback.dto';

@ApiTags('moods')
@Controller('moods')
export class MoodsController {
    constructor(private readonly moodsService: MoodsService) { }

    @Get()
    @ApiOperation({ summary: 'Get all available moods' })
    @ApiResponse({ status: 200, description: 'List of all active moods' })
    async getAllMoods() {
        return this.moodsService.getAllMoods();
    }
    
    @Get('recommendations')
    @ApiOperation({ summary: 'Get mood-based recommendations' })
    @ApiResponse({ status: 200, description: 'List of recommendations' })
    async getRecommendations(@Query() dto: GetRecommendationsDto) {
        return this.moodsService.getRecommendations(dto);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get mood by ID' })
    @ApiResponse({ status: 200, description: 'Mood details' })
    @ApiResponse({ status: 404, description: 'Mood not found' })
    async getMoodById(@Param('id') id: string) {
        return this.moodsService.getMoodById(id);
    }

    @Post('log')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Log a mood selection' })
    @ApiResponse({ status: 201, description: 'Mood logged successfully' })
    async logMood(@Body() logMoodDto: LogMoodDto) {
        return this.moodsService.logMood(logMoodDto);
    }

    @Get('history/:userId')
    @ApiOperation({ summary: 'Get user mood history' })
    @ApiQuery({ name: 'limit', required: false, description: 'Number of records to return' })
    async getMoodHistory(
        @Param('userId') userId: string,
        @Query('limit') limit?: number,
    ) {
        return this.moodsService.getUserMoodHistory(userId, limit);
    }

    @Post('recommendations/regenerate')
    @ApiOperation({ summary: 'Regenerate fresh recommendations' })
    @ApiResponse({ status: 200, description: 'Fresh list of recommendations' })
    async regenerateRecommendations(@Body() dto: GetRecommendationsDto) {
        return this.moodsService.regenerateRecommendations(dto);
    }

    @Post('recommendations/feedback')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Provide feedback on recommendation' })
    @ApiResponse({ status: 200, description: 'Feedback recorded successfully' })
    async provideFeedback(@Body() dto: RecommendationFeedbackDto) {
        return this.moodsService.provideFeedback(dto);
    }

    @Get('analytics/:userId')
    @ApiOperation({ summary: 'Get mood analytics for user' })
    @ApiResponse({ status: 200, description: 'User mood analytics' })
    async getMoodAnalytics(@Param('userId') userId: string) {
        return this.moodsService.getMoodAnalytics(userId);
    }

    @Get('analytics/global')
    @ApiOperation({ summary: 'Get global mood analytics' })
    @ApiResponse({ status: 200, description: 'Global mood analytics' })
    async getGlobalAnalytics() {
        return this.moodsService.getMoodAnalytics();
    }
}
