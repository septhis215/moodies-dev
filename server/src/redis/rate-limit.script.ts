/** Atomic multi-budget token bucket, using Redis time to avoid replica clock skew. */
export const RATE_LIMIT_SCRIPT = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local tokens = {}
local selected = 1
local lowest = 2
for i, key in ipairs(KEYS) do
  local capacity = tonumber(ARGV[(i - 1) * 2 + 1])
  local window = tonumber(ARGV[(i - 1) * 2 + 2])
  local old = redis.call('HMGET', key, 'tokens', 'at')
  local available = capacity
  if old[1] and old[2] then
    available = math.min(capacity, tonumber(old[1]) + math.max(0, now - tonumber(old[2])) * capacity / window)
  end
  if available < 1 then
    return {0, i, 0, math.ceil((1 - available) * window / capacity)}
  end
  tokens[i] = available - 1
  if tokens[i] / capacity < lowest then selected = i; lowest = tokens[i] / capacity end
end
for i, key in ipairs(KEYS) do
  local window = tonumber(ARGV[(i - 1) * 2 + 2])
  redis.call('HSET', key, 'tokens', tokens[i], 'at', now)
  redis.call('PEXPIRE', key, math.ceil(window * 2))
end
local capacity = tonumber(ARGV[(selected - 1) * 2 + 1])
local window = tonumber(ARGV[(selected - 1) * 2 + 2])
return {1, selected, math.floor(tokens[selected]), math.ceil((capacity - tokens[selected]) * window / capacity)}
`;

export type RateLimitBucket = { key: string; points: number; windowMs: number };
export type RateLimitResult = {
  allowed: boolean;
  index: number;
  remaining: number;
  retryMs: number;
};
