import { cn } from "@/lib/utils";

type Tone = "default" | "soldout";

interface StatCardProps {
  value: number | string;
  label: string;
  tone?: Tone;
}

export function StatCard({ value, label, tone = "default" }: StatCardProps) {
  return (
    <div className="bg-linen border border-sand/50 rounded-card p-6 flex flex-col gap-1">
      <span
        className={cn(
          "font-display font-semibold text-[36px] leading-none",
          tone === "soldout" ? "text-soldout" : "text-obsidian"
        )}
      >
        {value}
      </span>
      <span className="font-body text-[13px] text-graphite">{label}</span>
    </div>
  );
}
