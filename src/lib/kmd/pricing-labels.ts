/** Shared wording for the member pricing categories. */

const CATEGORY_LABEL: Record<string, string> = {
  trial: "Trial Member",
  classic: "Classic Member",
  gold: "Gold Member",
  platinum: "Platinum Member",
  stockist: "City/Municipal Stockist",
};

export function pricingCategoryLabel(category?: string | null): string | null {
  if (!category) return null;
  return CATEGORY_LABEL[category] ?? category;
}

/** "Your Member Price · Classic Member" style wording used beside a figure. */
export function memberPriceLabel(category?: string | null): string | null {
  const label = pricingCategoryLabel(category);
  return label ? `Your Member Price · ${label}` : null;
}
