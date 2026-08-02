import { Lock } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";

interface RecursoBloqueadoProps {
  titulo: string;
  descricao: string;
}

/**
 * Estado bloqueado de um recurso de plano pago. Recebe apenas texto: nenhum
 * dado real do recurso (pedido, contagem, total) chega até aqui (ORD-28).
 */
export function RecursoBloqueado({ titulo, descricao }: RecursoBloqueadoProps) {
  return (
    <Card className="py-12 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-24 h-24 rounded-full bg-linen flex items-center justify-center text-gold">
          <Lock size={38} />
        </div>
        <div>
          <span className="font-body font-medium text-[11px] tracking-[0.08em] uppercase text-gold">
            Disponível a partir do plano Starter
          </span>
          <div className="font-display font-semibold text-[20px] text-obsidian mt-2">
            {titulo}
          </div>
          <p className="font-body text-[15px] text-graphite mt-2 max-w-sm mx-auto">
            {descricao}
          </p>
        </div>
        <Link
          href="/painel/assinatura"
          className="font-display font-semibold text-[15px] text-gold hover:underline"
        >
          Fazer upgrade →
        </Link>
      </div>
    </Card>
  );
}
