export function calculateSuggestedSellingPrice(unitCost: number): number {
  return Math.floor(unitCost * 1.25) + 1
}