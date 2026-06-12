import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  pad?: number | string;
}

export function Card({ children, className, pad }: CardProps) {
  return (
    <div
      className={cn(
        "bg-white border border-sand/50 rounded-card",
        !pad && "p-6",
        className
      )}
      style={pad !== undefined ? { padding: pad } : undefined}
    >
      {children}
    </div>
  );
}
