# Testing the Mood Recommendations Fixes

## Quick Test Checklist

### 1. **Test Randomization & Diversity**
Steps:
1. Go to a mood section (TV, Movies, or Moods page)
2. Select a mood (e.g., "Happy", "Relaxing", etc.)
3. Note the recommendations displayed
4. Click the **"New Picks"** or **refresh icon** button
5. Should see **different recommendations** (not the exact same list)
6. Repeat 3-4 times - each refresh should give different results
7. Media types should mix (movies and TV shows alternating)

**Expected Result**: ✅ Each refresh shows different recommendations within same mood

### 2. **Test Cache Behavior (5-minute window)**
Steps:
1. Select a mood at 10:00 AM
2. Note the first recommendation shown (first item)
3. Wait 30 seconds
4. Click refresh/new picks
5. Compare to step 2 recommendations
6. Should show **shuffled version** of cached results (same items, different order)
7. Note this behavior occurs within 5 minutes

**Expected Result**: ✅ Shuffled cached results within 5 minutes, different after 5 minutes

### 3. **Test Force Refresh (New Picks Button)**
Steps:
1. Select a mood
2. Click "New Picks" button
3. Wait for loading to complete
4. Check if results are **completely different** from cached (new tmdbIds)

**Expected Result**: ✅ Clicking "New Picks" bypasses cache and generates fresh results

### 4. **Test Empty Moods** 
Steps:
1. Test with moods that previously had no results
2. Should now see recommendations
3. Quality should still be high (good ratings/popularity)

**Expected Result**: ✅ No more "No matches found" for any mood

### 5. **Test Media Type Diversity**
Steps:
1. Select any mood
2. Count movies vs TV shows in results
3. Should see roughly 6 movies + 6 TV shows (or similar mix)
4. Not all one type dominating

**Expected Result**: ✅ Balanced mix of movies and TV shows alternating

### 6. **Browser Console Logging** (Debug)
Steps:
1. Open browser DevTools (F12)
2. Go to Network tab
3. Select a mood
4. Look for `/moods/recommendations?` request
5. Check response JSON structure
6. Should see `recommendations` array with proper data

**Expected Result**: ✅ Proper JSON response with recommendations array

## Performance Checks

- **Load time**: Should be similar or faster (5min cache)
- **Memory usage**: Should be similar or slightly higher
- **API calls**: Same as before (~10 TMDB API calls)

## Troubleshooting

### Issue: "No recommendations available"
- Check backend logs for fallback activation
- Verify mood has `tmdbGenres` configured
- Try `forceRefresh: true` in query

### Issue: Same results appearing
- May indicate cache hit - wait 5+ minutes
- Try clicking "New Picks" to force refresh
- Check if cache clearing is working

### Issue: Poor quality recommendations
- Check score distribution (should span multiple tiers)
- Verify mood configuration in database
- Check TMDB API is returning quality content

## Monitoring

Watch server logs for these patterns:
```
✅ "Fetching recommendations from random pages"
✅ "Shuffled X movies and Y TV shows"
✅ "Generated N final recommendations"

⚠️ "No recommendations generated for mood: X" - means fallback triggered
❌ "Failed to fetch page X" - some pages failed but fallback should handle
```

## Metrics to Track

After deployment, monitor:
1. **Recommendation diversity** - compare results from same mood across time
2. **Cache hit rate** - % of requests served from cache vs fresh
3. **User feedback** - are repeated recommendations still an issue?
4. **Empty mood results** - should be zero after this fix
