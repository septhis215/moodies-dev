import {
    Controller, Get, Post, Body, Query,
    Param, HttpCode, HttpStatus,
    UseGuards, Req, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtGuard, OptionalJwtGuard } from 'src/auth/guard';
import { MoodsService } from './moods.service';
import { GetRecommendationsDto } from './dto/get-recommendations.dto';
import { LogMoodDto } from './dto/log-mood.dto';
import { RecommendationFeedbackDto } from './dto/recommendation-feedback.dto';

/**
 * IMPORTANT — NestJS resolves routes top-to-bottom within a controller.
 * All static-segment routes (e.g. "recommendations", "analytics/global")
 * MUST be declared BEFORE any wildcard param routes (e.g. ":id", ":userId")
 * or the param route will swallow the static path.
 *
 * Current safe ordering:
 *   GET  /moods                           ← no param
 *   GET  /moods/recommendations           ← static, before :id
 *   GET  /moods/analytics/global          ← static, before :userId
 *   POST /moods/recommendations/regenerate
 *   POST /moods/recommendations/feedback
 *   POST /moods/log
 *   GET  /moods/history/:userId           ← param, after all statics
 *   GET  /moods/analytics/:userId         ← param, after analytics/global
 *   GET  /moods/:id                       ← catch-all param, must be last
 */
@ApiTags('moods')
@Controller('moods')
export class MoodsController {
    constructor(private readonly moodsService: MoodsService) { }

    // ── Static routes ────────────────────────────────────────────────────────

    @Get()
    @ApiOperation({ summary: 'Get all available moods' })
    @ApiResponse({ status: 200, description: 'List of all active moods' })
    async getAllMoods() {
        return this.moodsService.getAllMoods();
    }

    @Get('recommendations')
    @UseGuards(OptionalJwtGuard)
    @ApiOperation({ summary: 'Get mood-based recommendations' })
    @ApiResponse({ status: 200, description: 'Paginated list of scored recommendations' })
    async getRecommendations(@Req() req: any, @Query() dto: GetRecommendationsDto) {
        dto.userId = this.resolveUserId(req);
        return this.moodsService.getRecommendations(dto);
    }

    /**
     * Must be declared before GET analytics/:userId — otherwise NestJS
     * matches "global" as the userId param and calls getMoodAnalytics('global').
     */
    @Get('analytics/global')
    @ApiOperation({ summary: 'Get global mood analytics across all users' })
    @ApiResponse({ status: 200, description: 'Global mood analytics' })
    async getGlobalAnalytics() {
        return this.moodsService.getMoodAnalytics();
    }

    @Post('log')
    @UseGuards(OptionalJwtGuard)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Log a mood selection' })
    @ApiResponse({ status: 201, description: 'Mood logged successfully' })
    async logMood(@Req() req: any, @Body() dto: LogMoodDto) {
        dto.userId = this.resolveUserId(req);
        return this.moodsService.logMood(dto);
    }

    @Post('recommendations/regenerate')
    @UseGuards(OptionalJwtGuard)
    @ApiOperation({ summary: 'Delete cached recommendations and regenerate fresh ones' })
    @ApiResponse({ status: 200, description: 'Fresh list of recommendations' })
    async regenerateRecommendations(@Req() req: any, @Body() dto: GetRecommendationsDto) {
        dto.userId = this.resolveUserId(req);
        return this.moodsService.regenerateRecommendations(dto);
    }

    @Post('recommendations/feedback')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Provide feedback on a recommendation' })
    @ApiResponse({ status: 200, description: 'Feedback recorded successfully' })
    async provideFeedback(@Body() dto: RecommendationFeedbackDto) {
        return this.moodsService.provideFeedback(dto);
    }

    // ── Param routes — declared after all static routes ─────────────────────

    /**
     * Must be declared before GET :id — otherwise NestJS matches
     * "history" as the id param.
     */
    @Get('history/:userId')
    @UseGuards(JwtGuard)
    @ApiOperation({ summary: 'Get mood log history for a user' })
    @ApiQuery({ name: 'limit', required: false, description: 'Max records to return (default 50)' })
    async getMoodHistory(
        @Req() req: any,
        @Param('userId') userId: string,
        @Query('limit') limit?: number,
    ) {
        // A user's mood history is private — only the owner may read it.
        this.assertSelf(req, userId);
        return this.moodsService.getUserMoodHistory(userId, limit);
    }

    @Get('analytics/:userId')
    @UseGuards(JwtGuard)
    @ApiOperation({ summary: 'Get mood analytics for a specific user' })
    @ApiResponse({ status: 200, description: 'User mood analytics' })
    async getMoodAnalytics(@Req() req: any, @Param('userId') userId: string) {
        // Per-user analytics are private — only the owner may read them.
        this.assertSelf(req, userId);
        return this.moodsService.getMoodAnalytics(userId);
    }

    /**
     * Enforce that the authenticated caller is acting on their own data,
     * preventing IDOR access to another user's mood records by guessing IDs.
     */
    private assertSelf(req: any, userId: string) {
        const callerId = req?.user?.id ?? req?.user?.sub;
        if (!callerId || String(callerId) !== String(userId)) {
            throw new ForbiddenException('You can only access your own mood data');
        }
    }

    /**
     * Resolve the effective userId from the authenticated token only. Returning
     * the token's id (or undefined when anonymous) and always overwriting the
     * DTO field means a client-supplied userId is never trusted — closing the
     * impersonation gap while preserving anonymous ('anonymous' bucket) usage.
     */
    private resolveUserId(req: any): string | undefined {
        const id = req?.user?.id ?? req?.user?.sub;
        return id ? String(id) : undefined;
    }

    /**
     * Catch-all param route — must be the last GET in this controller.
     */
    @Get(':id')
    @ApiOperation({ summary: 'Get a mood by ID' })
    @ApiResponse({ status: 200, description: 'Mood details' })
    @ApiResponse({ status: 404, description: 'Mood not found' })
    async getMoodById(@Param('id') id: string) {
        return this.moodsService.getMoodById(id);
    }
}