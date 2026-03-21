# Mood Recommendations System - Improvements & Fixes

## Issues Fixed

### 1. **Weak Randomization**
**Problem**: Recommendations were being sorted strictly by score, causing the same high-scoring items to appear repeatedly across sessions.

**Solution**: 
- Implemented score-tier grouping that divides recommendations into 5 tiers (0.9-1.0, 0.8-0.89, 0.7-0.79, 0.6-0.69, <0.6)
- Use round-robin selection across tiers rather than strict score ordering
- Alternate between movie and TV show results within each tier
- Apply final shuffle to break any remaining patterns

### 2. **Aggressive Cache Re-use**
**Problem**: Cache timeout was 30 minutes, causing users to see identical recommendations for extended periods.

**Solution**:
- Reduced cache timeout from 30 minutes to **5 minutes**
- When cache is hit, fetch 3x the requested limit and shuffle before returning
- Added `forceRefresh` parameter support to completely bypass cache when needed
- Clear internal keyword and sentiment caches on regenerate

### 3. **Sequential Page Fetching**
**Problem**: The system fetched TMDB results sequentially (pages 1, 2, 3...), limiting variety since similar content clusters on adjacent pages.

**Solution**:
- Implemented `generateRandomPages()` method to select random, non-sequential pages from TMDB
- Fetch from up to 10 random pages instead of first N pages sequentially
- Randomized page selection ensures different results across calls for same mood

### 4. **No Fallback for Empty Results**
**Problem**: Some moods returned no results, leaving users with errors instead of alternatives.

**Solution**:
- Added `generateRecommendationsFallback()` method that:
  - Relaxes minimum rating requirements (uses 0 instead of default)
  - Tries initial 3 pages as fallback
  - Still applies full scoring and diversification
  - Logs warnings for debugging

## Technical Changes

### Backend (Server)

#### `moods.service.ts`

1. **Cache Handling**:
   - `getCachedRecommendations()`: Reduced timeout to 5 minutes, shuffles cached results, fetches 3x limit to allow better selection

2. **Page Fetching**:
   - `generateRecommendations()`: Now uses randomized page selection
   - New helper: `generateRandomPages(min, max, count)` generates random page numbers without replacement

3. **Diversification Algorithm**:
   - Replaced strict score-based sorting with tier-based grouping
   - New helper: `groupByScoreTiers()` creates recommendation tiers
   - `diversifyRecommendations()` now uses round-robin tier selection with media-type alternation

4. **Fallback System**:
   - New method: `generateRecommendationsFallback()` handles moods with insufficient results
   - Relaxed constraints for fallback while maintaining quality

5. **Cache Regeneration**:
   - `regenerateRecommendations()` now clears ALL cache (not just recent)
   - Clears internal keyword and sentiment caches for true refresh
   - Logs deleted recommendation count

6. **Shuffling**:
   - Increased shuffles from 3 to 4 during collection phase
   - Added final 3-shuffle before diversification

### Frontend (Client)

#### `app/tv/action.ts` & `app/movies/action.ts`
- Added `forceRefresh` parameter to `getMoodRecommendations()`
- Passes parameter to backend via query string

#### `components/sections/MoodRecommendationSection.tsx`
- Updated `fetchRecommendations()` to accept optional `forceRefresh` parameter
- `handleRefresh()` now calls with `forceRefresh: true` to bypass cache
- Better control over when fresh vs cached results are used

## Testing & Validation

### How to Verify the Fixes

1. **Test Randomization**:
   ```
   - Select same mood twice in quick succession
   - Results should be different (shuffled differently)
   - Same moods won't dominate
   ```

2. **Test Cache Behavior**:
   ```
   - First call to mood: generates fresh recommendations
   - Second call within 5 minutes: shuffled cached results
   - Third call after 5 minutes: new recommendations generated
   - Click "New Picks" button: forces fresh generation
   ```

3. **Test Empty Mood Results**:
   ```
   - Moods that previously returned no results now show recommendations
   - Quality is maintained through fallback's scaled scoring
   ```

4. **Test Variety**:
   ```
   - Recommendations should show mix of movie and TV
   - Quality scores should be distributed across tiers
   - No strict "always top-scored" bias
   ```

## Performance Considerations

- **API Calls**: Still fetches from up to 10 TMDB pages (same as before, just randomized)
- **Memory**: Slightly increased due to groupByScoreTiers but minimal impact
- **Cache**: Smaller cache window (5 min) but better UX
- **Shuffling**: Extra shuffles add negligible compute time

## Future Enhancements

1. **Per-Session Seeding**: Implement consistent randomization per session
2. **User Preferences**: Weight recent mood history more heavily
3. **Trending Adjustment**: Boost trending content slightly within each tier
4. **Quality Floor**: Minimum score requirement (e.g., 5.0) to ensure quality

## Rollback Instructions

If issues arise, revert these files:
- `server/src/routes/moods/moods.service.ts` (cache time, page selection, diversification)
- `client/app/tv/action.ts` (forceRefresh parameter)
- `client/app/movies/action.ts` (forceRefresh parameter)
- `client/components/sections/MoodRecommendationSection.tsx` (refresh call)
