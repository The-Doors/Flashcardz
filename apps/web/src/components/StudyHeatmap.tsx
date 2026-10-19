import { useMemo } from "react";
import { Flame } from "lucide-react";
import type { ActivityData } from "./types";
import "./StudyHeatmap.css";

type HeatmapDay = { iso: string; count: number } | null;

const HEATMAP_WEEKS = 16;

const toISO = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// 0 = no activity, 4 = heaviest
const levelFor = (count: number): number => {
  if (count <= 0) return 0;
  if (count < 5) return 1;
  if (count < 15) return 2;
  if (count < 30) return 3;
  return 4;
};

/**
 * Builds columns of weeks (Sun -> Sat) ending with the current week.
 * Future days in the current week are returned as `null` so they render blank.
 */
const buildWeeks = (activity: ActivityData): HeatmapDay[][] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay() - (HEATMAP_WEEKS - 1) * 7);

  const weeks: HeatmapDay[][] = [];
  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    const days: HeatmapDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      if (date > today) {
        days.push(null);
      } else {
        const iso = toISO(date);
        days.push({ iso, count: activity[iso] || 0 });
      }
    }
    weeks.push(days);
  }
  return weeks;
};

const computeStreak = (activity: ActivityData): number => {
  const day = new Date();
  // Don't break the streak just because today hasn't been studied yet.
  if (!activity[toISO(day)]) day.setDate(day.getDate() - 1);
  let streak = 0;
  while (activity[toISO(day)] > 0) {
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return streak;
};

// Deterministic placeholder data so the demo heat map doesn't flicker.
export const buildDemoActivity = (): ActivityData => {
  const data: ActivityData = {};
  const today = new Date();
  let seed = 7;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < HEATMAP_WEEKS * 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (rand() > 0.45) data[toISO(d)] = Math.floor(rand() * 40);
  }
  return data;
};

type StudyHeatmapProps = {
  activity: ActivityData;
};

/** Renders nothing when there is no study activity at all. */
export default function StudyHeatmap({ activity }: StudyHeatmapProps) {
  const weeks = useMemo(() => buildWeeks(activity), [activity]);
  const total = useMemo(
    () => weeks.flat().reduce((sum, d) => sum + (d ? d.count : 0), 0),
    [weeks],
  );
  const streak = useMemo(() => computeStreak(activity), [activity]);

  if (total === 0) return null;

  return (
    <section className="fc-heatmap" aria-label="Study activity">
      <div className="fc-heatmap-head">
        <span className="fc-heatmap-title">Study activity</span>
        <span className="fc-heatmap-streak" title="Current streak">
          <Flame size={14} aria-hidden="true" />
          {streak}d
        </span>
      </div>

      <div
        className="fc-heatmap-grid"
        role="img"
        aria-label={`${total} cards studied in the last ${HEATMAP_WEEKS} weeks`}
      >
        {weeks.map((week, wi) => (
          <div className="fc-heatmap-col" key={wi}>
            {week.map((day, di) =>
              day ? (
                <span
                  key={di}
                  className={`fc-cell lvl-${levelFor(day.count)}`}
                  title={`${day.count} card${day.count === 1 ? "" : "s"} on ${day.iso}`}
                />
              ) : (
                <span key={di} className="fc-cell empty" />
              ),
            )}
          </div>
        ))}
      </div>

      <div className="fc-heatmap-foot">
        <span>
          {total} cards in {HEATMAP_WEEKS} weeks
        </span>
        <span className="fc-legend" aria-hidden="true">
          Less
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className={`fc-cell lvl-${l}`} />
          ))}
          More
        </span>
      </div>
    </section>
  );
}
