/**
 * The Home hero's welcome art re-letters its pill with the headline number ("100% up to" / "₱5,000"). A promotion's
 * value is free text, so: a trailing peso amount is the headline ("100% up to ₱5,000"); else a leading percentage or
 * amount is ("10% back every Monday"); else the whole value is.
 */
export function splitPromotionValue(value: string): { lead: string; amount: string } {
  const v = value.trim();
  const trailing = /^(.*?)\s*(₱\s?[\d.,]+[KkMm]?)$/.exec(v);
  if (trailing?.[1]) return { lead: trailing[1], amount: trailing[2]! };
  const leading = /^([+]?[\d.,]+%|₱\s?[\d.,]+[KkMm]?)\s+(.+)$/.exec(v);
  if (leading) return { lead: leading[2]!, amount: leading[1]! };
  return { lead: "", amount: v };
}
