import Link from "next/link";

interface UpsellHintProps {
  label: string;
}

export function UpsellHint({ label }: UpsellHintProps) {
  return (
    <Link
      href="/painel/assinatura"
      className="font-body text-[13px] text-graphite underline"
    >
      {label}
    </Link>
  );
}
