import { MessageCircle } from "lucide-react";

const WHATSAPP_NUMBER = "5535999931678";
const WHATSAPP_MESSAGE = "Olá! Tenho uma dúvida sobre o Vtrine Digital.";

export function WhatsAppFloatingButton() {
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Ficou com dúvida? Fale conosco pelo WhatsApp"
      className="fixed bottom-6 right-4 sm:right-8 z-40 inline-flex items-center gap-2 h-12 px-5 rounded-pill bg-gold text-white font-display font-medium text-[14px] hover:bg-gold-hover transition-colors"
    >
      <MessageCircle size={20} />
      Ficou com dúvida?
    </a>
  );
}
