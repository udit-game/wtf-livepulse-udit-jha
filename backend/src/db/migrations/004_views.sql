-- ============================================================
-- GYM HOURLY STATS
-- ============================================================

CREATE MATERIALIZED VIEW gym_hourly_stats AS
SELECT
    gym_id,
    EXTRACT(DOW FROM checked_in)::INTEGER AS day_of_week,
    EXTRACT(HOUR FROM checked_in)::INTEGER AS hour_of_day,
    COUNT(*) AS checkin_count
FROM checkins
WHERE checked_in >= NOW() - INTERVAL '7 days'
GROUP BY
    gym_id,
    day_of_week,
    hour_of_day;

CREATE UNIQUE INDEX idx_gym_hourly_stats
    ON gym_hourly_stats (
        gym_id,
        day_of_week,
        hour_of_day
    );