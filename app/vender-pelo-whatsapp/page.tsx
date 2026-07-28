import type { Metadata } from "next";
import { SeoLandingPage } from "@/components/seo/SeoLandingPage";
import { content } from "./data";

export const metadata: Metadata = {
  title: "Como Vender Pelo WhatsApp de Forma Organizada | Vtrine Digital",
  description:
    "Aprenda a vender pelo WhatsApp sem perder pedido, sem cliente perguntando 'ainda tem?'. Catálogo online organizado, venda continua no seu WhatsApp.",
  openGraph: {
    title: "Como Vender Pelo WhatsApp de Forma Organizada | Vtrine Digital",
    description:
      "Aprenda a vender pelo WhatsApp sem perder pedido, sem cliente perguntando 'ainda tem?'. Catálogo online organizado, venda continua no seu WhatsApp.",
    url: "/vender-pelo-whatsapp",
  },
};

export default function VenderPeloWhatsappPage() {
  return <SeoLandingPage content={content} />;
}
