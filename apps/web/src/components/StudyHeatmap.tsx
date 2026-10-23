import { useMemo } from "react";
import { Flame } from "lucide-react";
import type { ActivityData } from "./types";
import "./StudyHeatmap.css";

type CalendarDay = {
  iso: string;
  dayNum: number;
  count: number;
  isFuture: boolean;
  isToday: boolean;
} | null;

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

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
 * Builds rows of weeks (Sun -> Sat) for the current calendar month.
 * Days outside the current month (leading/trailing) are returned as `null`.
 */
const buildCurrentMonth = (activity: ActivityData): {
  monthLabel: string;
  weeks: CalendarDay[][];
} => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = toISO(today);

  const year = today.getFullYear();
  const month = today.getMonth();

  const monthLabel = today.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)

  const cells: CalendarDay[] = [];

  // Leading empty slots before the 1st of the month
  for (let i = 0; i < startOffset; i++) {
    cells.push(null);
  }

  // Actual days of the month
  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const date = new Date(year, month, dayNum);
    const iso = toISO(date);
    cells.push({
      iso,
      dayNum,
      count: activity[iso] || 0,
      isFuture: date > today,
      isToday: iso === todayIso,
    });
  }

  // Trailing empty slots to complete the final 7-day week row
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  // Chunk into 7-day rows
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return { monthLabel, weeks };
};

const computeStreak = (activity: ActivityData): number => {
  const day = new Date();
  if (!activity[toISO(day)]) day.setDate(day.getDate() - 1);
  let streak = 0;
  while (activity[toISO(day)] > 0) {
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return streak;
};

type StudyHeatmapProps = {
  activity?: ActivityData;
};

const EMPTY_ACTIVITY: ActivityData = {};

export default function StudyHeatmap({ activity = EMPTY_ACTIVITY }: StudyHeatmapProps) {
  const { monthLabel, weeks } = useMemo(() => buildCurrentMonth(activity), [activity]);
  
  const total = useMemo(
    () => weeks.flat().reduce((sum, d) => sum + (d ? d.count : 0), 0),
    [weeks],
  );
  const streak = useMemo(() => computeStreak(activity), [activity]);

  return (
    <section className="fc-heatmap" aria-label="Study activity">
      <div className="fc-heatmap-head">
        <span className="fc-heatmap-title">{monthLabel}</span>
        <span className="fc-heatmap-streak" title="Current streak">
          <Flame size={14} aria-hidden="true" />
          {streak}d
        </span>
      </div>

      <div
        className="fc-calendar"
        role="img"
        aria-label={`${total} cards studied in ${monthLabel}`}
      >
        <div className="fc-calendar-weekdays" aria-hidden="true">
          {WEEKDAYS.map((day, i) => (
            <span key={i} className="fc-weekday">
              {day}
            </span>
          ))}
        </div>

        <div className="fc-calendar-grid">
          {weeks.flat().map((day, idx) =>
            day ? (
              <span
                key={day.iso}
                className={[
                  "fc-cell",
                  "fc-cal-cell",
                  day.isFuture ? "future" : `lvl-${levelFor(day.count)}`,
                  day.isToday ? "today" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                title={`${day.count} card${day.count === 1 ? "" : "s"} on ${day.iso}`}
              >
                {day.dayNum}
              </span>
            ) : (
              <span key={`pad-${idx}`} className="fc-cell fc-cal-cell empty" />
            ),
          )}
        </div>
      </div>

      <div className="fc-heatmap-foot">
        <span>{total} cards this month</span>
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