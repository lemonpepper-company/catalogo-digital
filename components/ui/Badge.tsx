import { cn } from "@/lib/utils";

type Tone = "new" | "soldout";

const toneStyles: Record<Tone, string> = {
  new: "bg-gold text-white",
  soldout: "bg-soldout text-white",
};

interface BadgeProps {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ tone, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center h-[22px] px-[10px] rounded-pill",
        "font-body font-medium text-[10px] tracking-[0.08em] uppercase",
        toneStyles[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
