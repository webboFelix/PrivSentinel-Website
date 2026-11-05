const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const timeUnits = [
  { unit: "year" as const, seconds: 31_536_000 },
  { unit: "month" as const, seconds: 2_628_000 },
  { unit: "week" as const, seconds: 604_800 },
  { unit: "day" as const, seconds: 86_400 },
  { unit: "hour" as const, seconds: 3_600 },
  { unit: "minute" as const, seconds: 60 },
  { unit: "second" as const, seconds: 1 },
];

export function formatTimeAgo(value: string, now = Date.now()) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Date not provided";

  const difference = Math.round((timestamp - now) / 1000);
  const timeUnit = timeUnits.find(({ seconds }) => Math.abs(difference) >= seconds) ?? timeUnits[timeUnits.length - 1];
  return relativeTime.format(Math.round(difference / timeUnit.seconds), timeUnit.unit);
}
