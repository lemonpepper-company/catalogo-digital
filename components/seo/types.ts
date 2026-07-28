export interface SeoLandingContent {
  h1: string;
  heroSubtitle: string;
  problemSolution: { title: string; body: string };
  benefits: { title: string; desc: string }[];
  faq: { q: string; a: string }[];
  ctaLabel: string;
  relatedLinks: { label: string; href: string }[];
}
