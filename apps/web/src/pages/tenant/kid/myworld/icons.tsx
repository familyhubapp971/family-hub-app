import { Award, CheckCircle, Heart, Sparkles, Star, Zap, type LucideIcon } from 'lucide-react';

// FHS-376: the API stores a habit's icon as a STRING name. Map it to a lucide
// component for the kid's habit cards. Unknown / missing names fall back to Star
// so a card never renders the literal word (the FHS-374 class of bug).
const ICON_BY_NAME: Record<string, LucideIcon> = {
  heart: Heart,
  star: Star,
  magic: Sparkles,
  sparkles: Sparkles,
  trophy: Award,
  award: Award,
  lightning: Zap,
  zap: Zap,
  check: CheckCircle,
  checkcircle: CheckCircle,
};

export function habitIcon(name: string | null | undefined): LucideIcon {
  return ICON_BY_NAME[(name ?? '').toLowerCase()] ?? Star;
}

// "JUN 8 to JUN 14": the week banner range. Start is the week's Monday; the
// range spans Mon..Sun (start + 6 days). Uppercased to match the banner style.
export function weekRangeLabel(startDate: string): string {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  return `${fmt(start)} to ${fmt(end)}`;
}
