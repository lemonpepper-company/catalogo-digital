import { Sidebar } from "@/components/painel/Sidebar";

export const metadata = {
  title: "Painel — Catálogo Digital",
};

const TRIAL_DAYS = 12;

export default function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen flex flex-col bg-ivory overflow-hidden">
      {/* Trial banner */}
      <div className="flex-shrink-0 h-10 flex items-center justify-center gap-2 bg-linen border-b border-sand/50 font-body text-[13.5px] text-gold whitespace-nowrap">
        <span className="font-semibold tracking-[0.02em]">Trial Pro</span>
        <span className="opacity-55">·</span>
        <span>{TRIAL_DAYS} dias restantes</span>
        <span className="opacity-55">·</span>
        <a
          href="/escolha-de-plano"
          className="font-display font-semibold text-[13.5px] text-gold hover:underline"
        >
          Assinar agora →
        </a>
      </div>

      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="px-12 py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
