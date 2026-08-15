import { Sparkles, CookingPot, Baby, HeartHandshake, Shirt, SprayCan, LucideIcon } from "lucide-react";

export const ICON_MAP: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  "cooking-pot": CookingPot,
  baby: Baby,
  "heart-handshake": HeartHandshake,
  shirt: Shirt,
  "spray-can": SprayCan,
};

/** Backend category slugs -> icon key. Falls back to "sparkles" for any
 * category not in this list, so new categories added via the admin panel
 * still render something sensible. */
const SLUG_ICON_MAP: Record<string, string> = {
  "home-cleaning": "sparkles",
  "deep-cleaning": "spray-can",
  "cooking-help": "cooking-pot",
  cooking: "cooking-pot",
  "baby-sitting": "baby",
  "baby-care": "baby",
  "elderly-care": "heart-handshake",
  "laundry-ironing": "shirt",
};

export function getIconKeyForSlug(slug: string): string {
  return SLUG_ICON_MAP[slug] || "sparkles";
}

export function getIconForSlug(slug: string): LucideIcon {
  return ICON_MAP[getIconKeyForSlug(slug)] || Sparkles;
}
