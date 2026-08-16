DROP MATERIALIZED VIEW IF EXISTS gym_hourly_stats CASCADE;

CREATE MATERIALIZED VIEW gym_hourly_stats AS
SELECT
    gym_id,
    EXTRACT(DOW FROM checked_in AT TIME ZONE 'Asia/Kolkata')::INTEGER AS day_of_week,
    EXTRACT(HOUR FROM checked_in AT TIME ZONE 'Asia/Kolkata')::INTEGER AS hour_of_day,
    ROUND(COUNT(*)::NUMERIC / 13, 0)::INTEGER AS checkin_count
FROM checkins
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