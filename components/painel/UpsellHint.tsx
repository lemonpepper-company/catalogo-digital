import { vtrineWhatsAppHref } from "@/lib/contact";

interface UpsellHintProps {
  label: string;
  whatsappMessage: string;
}

export function UpsellHint({ label, whatsappMessage }: UpsellHintProps) {
  const href = vtrineWhatsAppHref(whatsappMessage);

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
