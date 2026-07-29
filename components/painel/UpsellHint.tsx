import { VTRINE_WHATSAPP_NUMBER } from "@/lib/contact";

interface UpsellHintProps {
  label: string;
  whatsappMessage: string;
}

export function UpsellHint({ label, whatsappMessage }: UpsellHintProps) {
  const href = `https://wa.me/${VTRINE_WHATSAPP_NUMBER}?text=${encodeURIComponent(
    whatsappMessage
  )}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-body text-[13px] text-graphite underline"
    >
      {label}
    </a>
  );
}
