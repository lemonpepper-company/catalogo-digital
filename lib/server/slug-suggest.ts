export function buildSlugCandidates(slug: string): string[] {
  return Array.from({ length: 9 }, (_, i) => `${slug}-${i + 2}`);
}

export function pickAvailableSlug(
  candidates: string[],
  takenSlugs: string[]
): string | undefined {
  const taken = new Set(takenSlugs);
  return candidates.find((candidate) => !taken.has(candidate));
}
