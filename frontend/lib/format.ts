/** Compact display value for stat tiles: 1,284 / 12.9K / 4.2M. */
export function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (abs >= 10_000) return `${trim(value / 1_000)}K`;
  if (abs < 100 && !Number.isInteger(value)) return value.toFixed(2);
  return Math.round(value).toLocaleString();
}

function trim(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

/** Terms that must keep their canonical casing rather than being sentence-cased. */
const ACRONYMS: Record<string, string> = {
  mrr: "MRR",
  aov: "AOV",
  ctr: "CTR",
  ga4: "GA4",
  gsc: "GSC",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  hubspot: "HubSpot",
  ads: "ads",
};

/** 'screenPageViews' → 'Screen page views'; 'mrr' → 'MRR' (tile-contract sentence case). */
export function humanizeMetric(name: string): string {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
    .split(" ");
  const cased = words.map((w, i) => {
    const acronym = ACRONYMS[w];
    if (acronym) return acronym;
    return i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w;
  });
  return cased.join(" ");
}

/** 'meta_ads' → 'Meta ads'; 'ga4' → 'GA4'; 'tiktok_ads' → 'TikTok ads'. */
export function humanizeSource(name: string): string {
  const words = name.split("_");
  return words
    .map((w, i) => {
      const acronym = ACRONYMS[w.toLowerCase()];
      if (acronym) return acronym;
      return i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    })
    .join(" ");
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

/** Signed percent change, or null when the baseline is zero. */
export function percentChange(from: number, to: number): number | null {
  if (from === 0) return null;
  return Math.round(((to - from) / from) * 1000) / 10;
}
