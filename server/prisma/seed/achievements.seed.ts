import type { PrismaClient } from '@prisma/client';

type AchievementSeed = {
  key: string;
  title: string;
  description: string;
  category: string;
  requirementType: string;
  requirementTarget: string;
  requiredCount: number | null;
  progressLogic: string;
  reasoningTemplate: string;
  lockedHint: string;
  badgeKey: string;
  badgeName: string;
  icon: string;
  rarity: string;
  mascotMood: string;
  mascotMotion: string;
};

const rarityTheme: Record<string, { accent: string; glow: string }> = {
  Common: { accent: '#e94f37', glow: 'rgba(233,79,55,0.22)' },
  Uncommon: { accent: '#22c55e', glow: 'rgba(34,197,94,0.20)' },
  Rare: { accent: '#38bdf8', glow: 'rgba(56,189,248,0.22)' },
  Epic: { accent: '#a855f7', glow: 'rgba(168,85,247,0.24)' },
  Legendary: { accent: '#f59e0b', glow: 'rgba(245,158,11,0.28)' },
};

const seeds: AchievementSeed[] = [
  ['first-mood', 'Select your first mood', 'Begin mood-based discovery by choosing a mood.', 'Mood Discovery', 'COUNT', 'mood_selections', 1, 'Count mood selections from MoodLog.', 'Awarded because the user started exploring content through mood-based discovery.', 'Choose your first mood to begin your discovery journey.', 'mood-starter', 'Mood Starter', 'Sparkles', 'Common', 'Curious', 'Peeking and pointing at the mood wheel'],
  ['five-moods', 'Explore 5 different moods', 'Try five different mood paths.', 'Mood Discovery', 'DISTINCT_COUNT', 'distinct_moods', 5, 'Count distinct mood IDs from MoodLog.', 'Awarded because the user has explored multiple emotional paths and started discovering content through different moods.', 'Try more moods to unlock this badge.', 'mood-explorer', 'Mood Explorer', 'Compass', 'Common', 'Excited', 'Spinning around the mood wheel'],
  ['all-moods', 'Explore all mood categories', 'Explore every active mood category.', 'Mood Discovery', 'ALL_ACTIVE', 'all_moods', null, 'Compare distinct MoodLog mood IDs with active Mood count.', 'Awarded because the user has fully explored the Moodies mood discovery system.', 'Explore every mood category to master mood discovery.', 'mood-master', 'Mood Master', 'Trophy', 'Rare', 'Proud', 'Holding a trophy beside the mood wheel'],
  ['first-movie', 'Watch your first movie', 'Mark one movie as watched.', 'Movie Watching', 'COUNT', 'watched_movies', 1, 'Count watched movie activity events.', 'Awarded because the user started their movie journey on Moodies.', 'Watch or mark your first movie to unlock this badge.', 'first-watch', 'First Watch', 'Film', 'Common', 'Happy', 'Holding popcorn'],
  ['ten-movies', 'Watch 10 movies', 'Build a habit with ten watched movies.', 'Movie Watching', 'COUNT', 'watched_movies', 10, 'Count watched movie activity events.', 'Awarded because the user has built a strong movie-watching habit.', 'Watch more movies to become a Movie Buff.', 'movie-buff', 'Movie Buff', 'Clapperboard', 'Uncommon', 'Focused', 'Sitting in a cinema seat'],
  ['fifty-movies', 'Watch 50 movies', 'Reach fifty watched movies.', 'Movie Watching', 'COUNT', 'watched_movies', 50, 'Count watched movie activity events.', 'Awarded because the user has shown deep dedication to discovering movies.', 'Keep watching movies to reach this milestone.', 'cinema-addict', 'Cinema Addict', 'Ticket', 'Rare', 'Amazed', 'Surrounded by movie posters'],
  ['first-tv', 'Watch your first TV series', 'Mark one TV series as watched.', 'TV Watching', 'COUNT', 'watched_series', 1, 'Count watched TV activity events.', 'Awarded because the user started exploring TV series on Moodies.', 'Watch or mark your first series to unlock this badge.', 'first-episode', 'First Episode', 'Tv', 'Common', 'Cozy', 'Wrapped in a blanket with a remote'],
  ['ten-tv', 'Watch 10 TV series', 'Reach ten watched TV series.', 'TV Watching', 'COUNT', 'watched_series', 10, 'Count watched TV activity events.', 'Awarded because the user is actively building their series journey.', 'Watch more series to unlock this badge.', 'series-tracker', 'Series Tracker', 'ListChecks', 'Uncommon', 'Relaxed', 'Binge-watching on a sofa'],
  ['fifty-tv', 'Watch 50 TV series', 'Reach fifty watched TV series.', 'TV Watching', 'COUNT', 'watched_series', 50, 'Count watched TV activity events.', 'Awarded because the user has become a serious TV series explorer.', 'Keep exploring series to become a Binge Legend.', 'binge-legend', 'Binge Legend', 'MonitorPlay', 'Rare', 'Energetic', 'Holding multiple remotes'],
  ['first-review', 'Write your first review', 'Share one published review.', 'Reviews', 'COUNT', 'reviews', 1, 'Count reviews authored by the user.', 'Awarded because the user shared their first opinion with the Moodies community.', 'Write your first review to unlock this badge.', 'first-review', 'First Review', 'Star', 'Common', 'Thoughtful', 'Writing in a notebook'],
  ['ten-reviews', 'Write 10 reviews', 'Share ten reviews.', 'Reviews', 'COUNT', 'reviews', 10, 'Count reviews authored by the user.', 'Awarded because the user is actively contributing opinions and helping others discover content.', 'Keep writing reviews to grow your voice.', 'review-voice', 'Review Voice', 'Megaphone', 'Uncommon', 'Confident', 'Speaking into a megaphone'],
  ['fifty-reviews', 'Write 50 reviews', 'Share fifty reviews.', 'Reviews', 'COUNT', 'reviews', 50, 'Count reviews authored by the user.', 'Awarded because the user has become a strong reviewer with consistent community contribution.', 'Write more reviews to unlock Critic Mode.', 'critic-mode', 'Critic Mode', 'BadgeCheck', 'Rare', 'Serious', 'Holding rating cards'],
  ['first-like', 'Like your first title', 'Like one movie or series.', 'Likes', 'COUNT', 'liked_titles', 1, 'Count liked movies and series.', 'Awarded because the user started showing appreciation for content they enjoy.', 'Like your first movie or series to unlock this badge.', 'first-like', 'First Like', 'Heart', 'Common', 'Cheerful', 'Giving a heart reaction'],
  ['twenty-five-likes', 'Like 25 titles', 'Like twenty-five titles.', 'Likes', 'COUNT', 'liked_titles', 25, 'Count liked movies and series.', 'Awarded because the user has developed a clear taste profile through liked content.', 'Like more content to shape your taste profile.', 'taste-maker', 'Taste Maker', 'HeartHandshake', 'Uncommon', 'Stylish', 'Wearing sunglasses with heart icons'],
  ['hundred-likes', 'Like 100 titles', 'Like one hundred titles.', 'Likes', 'COUNT', 'liked_titles', 100, 'Count liked movies and series.', 'Awarded because the user has shown strong passion for many titles.', 'Keep liking your favorite content to become a Super Fan.', 'super-fan', 'Super Fan', 'HeartPulse', 'Rare', 'Excited', 'Jumping with heart effects'],
  ['first-save', 'Save your first title', 'Save one title to the watchlist.', 'Watchlist', 'COUNT', 'watchlist_titles', 1, 'Count saved movies and series.', 'Awarded because the user started building their personal watchlist.', 'Save your first title to unlock this badge.', 'first-save', 'First Save', 'Bookmark', 'Common', 'Organized', 'Pinning a title to a board'],
  ['twenty-saves', 'Save 20 titles', 'Save twenty titles.', 'Watchlist', 'COUNT', 'watchlist_titles', 20, 'Count saved movies and series.', 'Awarded because the user is actively curating future watches.', 'Add more titles to your watchlist.', 'watchlist-builder', 'Watchlist Builder', 'BookmarkPlus', 'Uncommon', 'Focused', 'Stacking movie cards'],
  ['hundred-saves', 'Save 100 titles', 'Save one hundred titles.', 'Watchlist', 'COUNT', 'watchlist_titles', 100, 'Count saved movies and series.', 'Awarded because the user has created a large personal content collection.', 'Keep saving titles to grow your collection.', 'watchlist-collector', 'Watchlist Collector', 'Library', 'Rare', 'Proud', 'Standing beside a huge watchlist stack'],
  ['first-post', 'Create your first community post', 'Create one community post.', 'Community', 'COUNT', 'community_posts', 1, 'Count community posts.', 'Awarded because the user started participating in the Moodies community.', 'Create your first post to unlock this badge.', 'first-post', 'First Post', 'MessageSquare', 'Common', 'Friendly', 'Waving at a community board'],
  ['ten-community-actions', 'Create 10 posts or comments', 'Create ten posts or comments.', 'Community', 'COUNT', 'community_posts_comments', 10, 'Count community posts and comments.', 'Awarded because the user is helping start conversations in the community.', 'Post or comment more to unlock this badge.', 'conversation-starter', 'Conversation Starter', 'MessagesSquare', 'Uncommon', 'Social', 'Chat bubbles around mascot'],
  ['fifty-community-likes', 'Receive 50 likes on posts or reviews', 'Receive fifty likes on contributions.', 'Community', 'COUNT', 'community_likes_received', 50, 'Count likes received on posts or reviews.', 'Awarded because the user content is receiving strong community engagement.', 'Share helpful posts and reviews to earn more community likes.', 'community-star', 'Community Star', 'Star', 'Rare', 'Celebrating', 'Spotlight pose with stars'],
  ['first-quiz', 'Complete your first quiz', 'Complete one quiz.', 'Quiz', 'COUNT', 'quizzes', 1, 'Count Quiz rows for the user.', 'Awarded because the user discovered their first personality-based recommendation profile.', 'Complete your first quiz to unlock this badge.', 'quiz-starter', 'Quiz Starter', 'ClipboardQuestion', 'Common', 'Curious', 'Holding a quiz card'],
  ['five-quizzes', 'Complete 5 quizzes', 'Complete five quizzes.', 'Quiz', 'COUNT', 'quizzes', 5, 'Count Quiz rows for the user.', 'Awarded because the user explored different sides of their viewing personality.', 'Complete more quizzes to discover more about your taste.', 'personality-seeker', 'Personality Seeker', 'Brain', 'Uncommon', 'Playful', 'Thinking with question marks'],
  ['all-quiz-types', 'Complete all personality quiz types', 'Complete every quiz type.', 'Quiz', 'ALL_ACTIVE', 'all_quiz_types', null, 'Compare completed quiz types to available quiz types.', 'Awarded because the user fully explored their Moodies personality profile.', 'Complete every quiz type to unlock your full identity.', 'identity-unlocked', 'Identity Unlocked', 'Fingerprint', 'Rare', 'Enlightened', 'Glowing with personality cards'],
  ['three-day-streak', 'Visit Moodies for 3 consecutive days', 'Visit for three consecutive days.', 'Streaks', 'STREAK', 'visit_days', 3, 'Count consecutive daily visits.', 'Awarded because the user started forming a consistent discovery habit.', 'Visit Moodies for 3 days in a row.', 'daily-visitor', 'Daily Visitor', 'CalendarCheck', 'Common', 'Motivated', 'Marking a calendar'],
  ['seven-day-streak', 'Visit Moodies for 7 consecutive days', 'Visit for seven consecutive days.', 'Streaks', 'STREAK', 'visit_days', 7, 'Count consecutive daily visits.', 'Awarded because the user consistently returned to discover and engage with content.', 'Keep your streak going for one full week.', 'weekly-explorer', 'Weekly Explorer', 'CalendarDays', 'Uncommon', 'Determined', 'Running with a calendar trail'],
  ['thirty-day-streak', 'Visit Moodies for 30 consecutive days', 'Visit for thirty consecutive days.', 'Streaks', 'STREAK', 'visit_days', 30, 'Count consecutive daily visits.', 'Awarded because the user has become a loyal and consistent Moodies member.', 'Visit Moodies every day for 30 days.', 'moodies-loyalist', 'Moodies Loyalist', 'Crown', 'Epic', 'Legendary', 'Crowned mascot with a glowing streak'],
  ['profile-basic', 'Complete basic profile information', 'Complete basic profile details.', 'Profile', 'BOOLEAN', 'profile_basic', 1, 'Check name and username.', 'Awarded because the user personalized their Moodies identity.', 'Complete your profile details to unlock this badge.', 'profile-starter', 'Profile Starter', 'UserRound', 'Common', 'Friendly', 'Decorating a profile card'],
  ['profile-stylist', 'Add avatar, bio, and preferences', 'Customize avatar and preferences.', 'Profile', 'BOOLEAN', 'profile_stylist', 1, 'Check avatar and preference fields.', 'Awarded because the user customized their profile and made it more expressive.', 'Add an avatar, bio, and preferences to style your profile.', 'profile-stylist', 'Profile Stylist', 'Palette', 'Uncommon', 'Stylish', 'Holding a paintbrush'],
  ['moodies-identity', 'Complete full Moodies onboarding identity', 'Complete profile, quiz, preferences, and first mood discovery.', 'Profile', 'BOOLEAN', 'full_identity', 1, 'Check profile, quiz, preferences, and mood logs.', 'Awarded because the user created a complete Moodies identity across profile, mood, and personality features.', 'Complete your profile, quiz, preferences, and mood discovery.', 'moodies-identity', 'Moodies Identity', 'IdCard', 'Rare', 'Proud', 'Presenting a completed profile badge'],
  ['hidden-gem-hunter', 'Discover 10 hidden gems', 'Engage with ten underrated highly rated titles.', 'Special Milestones', 'COUNT', 'hidden_gems', 10, 'Count low-popularity high-rated watched/saved titles.', 'Awarded because the user enjoys discovering underrated movies or series.', 'Discover more underrated but highly rated titles.', 'hidden-gem-hunter', 'Hidden Gem Hunter', 'Gem', 'Rare', 'Adventurous', 'Holding a treasure map'],
  ['k-drama-soul', 'Engage with 10 Korean drama or romance titles', 'Engage with ten Korean drama or romance titles.', 'Special Milestones', 'COUNT', 'k_drama_romance', 10, 'Count watched, saved, or liked Korean drama or romance titles.', 'Awarded because the user shows strong interest in Korean drama or romance content.', 'Explore more Korean drama or romance titles.', 'k-drama-soul', 'K-Drama Soul', 'Heart', 'Uncommon', 'Romantic', 'Heart pose with soft sparkle'],
  ['horror-survivor', 'Engage with 10 horror titles', 'Engage with ten horror titles.', 'Special Milestones', 'COUNT', 'horror_titles', 10, 'Count watched, saved, or liked horror titles.', 'Awarded because the user has survived multiple scary picks.', 'Watch or save more horror titles to unlock this badge.', 'horror-survivor', 'Horror Survivor', 'Flashlight', 'Uncommon', 'Scared but brave', 'Holding a flashlight'],
  ['romance-dreamer', 'Engage with 10 romance titles', 'Engage with ten romance titles.', 'Special Milestones', 'COUNT', 'romance_titles', 10, 'Count watched, saved, or liked romance titles.', 'Awarded because the user often connects with love stories and emotional romance content.', 'Explore more romance titles to unlock this badge.', 'romance-dreamer', 'Romance Dreamer', 'Heart', 'Uncommon', 'Dreamy', 'Floating with heart bubbles'],
  ['action-chaser', 'Engage with 10 action or adventure titles', 'Engage with ten action/adventure titles.', 'Special Milestones', 'COUNT', 'action_adventure_titles', 10, 'Count watched, saved, or liked action/adventure titles.', 'Awarded because the user enjoys fast-paced stories, battles, missions, and adventure.', 'Explore more action and adventure titles.', 'action-chaser', 'Action Chaser', 'Zap', 'Uncommon', 'Energetic', 'Sprinting with motion lines'],
  ['comfort-watcher', 'Engage with 10 cozy or feel-good titles', 'Engage with ten cozy or feel-good titles.', 'Special Milestones', 'COUNT', 'cozy_titles', 10, 'Count watched, saved, or liked family, animation, comedy, or cozy titles.', 'Awarded because the user enjoys relaxing, warm, and feel-good content.', 'Explore more cozy and feel-good titles.', 'comfort-watcher', 'Comfort Watcher', 'Coffee', 'Uncommon', 'Cozy', 'Hugging a pillow with warm glow'],
  ['night-owl', 'Complete 10 late-night sessions', 'Use Moodies late at night ten times.', 'Special Milestones', 'COUNT', 'late_night_sessions', 10, 'Count late-night user sessions.', 'Awarded because the user often explores Moodies during late-night viewing sessions.', 'Late-night activity may unlock this badge.', 'night-owl', 'Night Owl', 'Moon', 'Rare', 'Sleepy', 'Holding moon-shaped popcorn'],
  ['trend-rider', 'Engage with 10 trending titles', 'Engage with ten trending titles.', 'Special Milestones', 'COUNT', 'trending_titles', 10, 'Count watched, saved, or liked trending titles.', 'Awarded because the user keeps up with popular and trending content.', 'Explore trending titles to unlock this badge.', 'trend-rider', 'Trend Rider', 'TrendingUp', 'Uncommon', 'Cool', 'Surfing on a trending arrow'],
  ['deep-diver', 'View details for 100 movies or series', 'Open one hundred title detail pages.', 'Special Milestones', 'COUNT', 'detail_views', 100, 'Count movie and series detail page views.', 'Awarded because the user deeply explores titles before choosing what to watch.', 'Open more movie or series detail pages.', 'deep-diver', 'Deep Diver', 'Search', 'Rare', 'Investigative', 'Using a magnifying glass'],
  ['moodies-legend', 'Earn 25 badges', 'Earn twenty-five badges.', 'Special Milestones', 'COUNT', 'badges_earned', 25, 'Count unlocked user achievements with badge rewards.', 'Awarded because the user has made strong progress across Moodies discovery, profile, quiz, review, and community features.', 'Earn more badges across Moodies to unlock this legendary badge.', 'moodies-legend', 'Moodies Legend', 'Crown', 'Legendary', 'Legendary', 'Crowned mascot holding a golden trophy'],
].map(([
  key, title, description, category, requirementType, requirementTarget,
  requiredCount, progressLogic, reasoningTemplate, lockedHint, badgeKey,
  badgeName, icon, rarity, mascotMood, mascotMotion,
]) => ({
  key, title, description, category, requirementType, requirementTarget,
  requiredCount, progressLogic, reasoningTemplate, lockedHint, badgeKey,
  badgeName, icon, rarity, mascotMood, mascotMotion,
})) as AchievementSeed[];

export async function seedAchievements(prisma: PrismaClient) {
  for (const [index, seed] of seeds.entries()) {
    const achievement = await prisma.achievement.upsert({
      where: { key: seed.key },
      update: {
        title: seed.title,
        description: seed.description,
        category: seed.category,
        requirementType: seed.requirementType,
        requirementTarget: seed.requirementTarget,
        requiredCount: seed.requiredCount,
        progressLogic: seed.progressLogic,
        reasoningTemplate: seed.reasoningTemplate,
        lockedHint: seed.lockedHint,
        active: true,
      },
      create: {
        key: seed.key,
        title: seed.title,
        description: seed.description,
        category: seed.category,
        requirementType: seed.requirementType,
        requirementTarget: seed.requirementTarget,
        requiredCount: seed.requiredCount,
        progressLogic: seed.progressLogic,
        reasoningTemplate: seed.reasoningTemplate,
        lockedHint: seed.lockedHint,
        active: true,
      },
    });

    const theme = rarityTheme[seed.rarity] ?? rarityTheme.Common;
    await prisma.badgeDefinition.upsert({
      where: { key: seed.badgeKey },
      update: {
        achievementId: achievement.id,
        badgeName: seed.badgeName,
        icon: seed.icon,
        rarity: seed.rarity,
        mascotMood: seed.mascotMood,
        mascotMotion: seed.mascotMotion,
        colorTheme: theme,
        lockedVisualState: { opacity: 0.45, treatment: 'muted', border: 'white/10' },
        unlockedVisualState: { glow: theme.glow, accent: theme.accent, treatment: 'reward' },
        displayOrder: index + 1,
        active: true,
      },
      create: {
        key: seed.badgeKey,
        achievementId: achievement.id,
        badgeName: seed.badgeName,
        icon: seed.icon,
        rarity: seed.rarity,
        mascotMood: seed.mascotMood,
        mascotMotion: seed.mascotMotion,
        colorTheme: theme,
        lockedVisualState: { opacity: 0.45, treatment: 'muted', border: 'white/10' },
        unlockedVisualState: { glow: theme.glow, accent: theme.accent, treatment: 'reward' },
        displayOrder: index + 1,
        active: true,
      },
    });
  }
}
