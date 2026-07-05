"use client";

import { ToggleRow } from "@/components/ui/Switch";
import { PAYMENT_METHODS, DELIVERY_METHODS } from "@/lib/data";

interface PagamentoEntregaFieldsProps {
  paymentMethods: string[];
  onTogglePaymentMethod: (value: string) => void;
  deliveryMethods: string[];
  onToggleDeliveryMethod: (value: string) => void;
}

export function PagamentoEntregaFields({
  paymentMethods,
  onTogglePaymentMethod,
  deliveryMethods,
  onToggleDeliveryMethod,
}: PagamentoEntregaFieldsProps) {
  return (
    <>
      <h3 className="font-body font-medium text-[13px] tracking-[0.04em] uppercase text-graphite mb-1">
        Formas de pagamento aceitas
      </h3>
      <div className="mb-5">
        {PAYMENT_METHODS.map((method) => (
          <ToggleRow
            key={method.value}
            label={method.label}
            checked={paymentMethods.includes(method.value)}
            onChange={() => onTogglePaymentMethod(method.value)}
          />
        ))}
      </div>

      <h3 className="font-body font-medium text-[13px] tracking-[0.04em] uppercase text-graphite mb-1">
        Formas de entrega
      </h3>
      <div>
        {DELIVERY_METHODS.map((method) => (
          <ToggleRow
            key={method.value}
            label={method.label}
            checked={deliveryMethods.includes(method.value)}
            onChange={() => onToggleDeliveryMethod(method.value)}
          />
        ))}
      </div>
    </>
  );
}
