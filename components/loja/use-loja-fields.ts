"use client";

import { useState } from "react";
import { compressImage } from "@/lib/image-compress";

export interface LojaFieldsInit {
  whatsapp: string | null;
  monogram: string | null;
  storeDescription: string | null;
  instagram: string | null;
  accentColor: string;
  paymentMethods: string[];
  deliveryMethods: string[];
}

export function useLojaFields(init: LojaFieldsInit) {
  const [whatsapp, setWhatsapp] = useState(init.whatsapp ?? "");
  const [monogram, setMonogram] = useState(init.monogram ?? "");
  const [storeDescription, setStoreDescription] = useState(init.storeDescription ?? "");
  const [instagram, setInstagram] = useState(init.instagram ?? "");
  const [accent, setAccent] = useState(init.accentColor);
  const [paymentMethods, setPaymentMethods] = useState<string[]>(init.paymentMethods);
  const [deliveryMethods, setDeliveryMethods] = useState<string[]>(init.deliveryMethods);
  const [logo, setLogoState] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const togglePaymentMethod = (value: string) => {
    setPaymentMethods((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const toggleDeliveryMethod = (value: string) => {
    setDeliveryMethods((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const setLogo = async (file: File | null) => {
    const compressed = file ? await compressImage(file) : null;
    setLogoState(compressed);
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return compressed ? URL.createObjectURL(compressed) : null;
    });
  };

  return {
    whatsapp,
    setWhatsapp,
    monogram,
    setMonogram,
    storeDescription,
    setStoreDescription,
    instagram,
    setInstagram,
    accent,
    setAccent,
    paymentMethods,
    togglePaymentMethod,
    deliveryMethods,
    toggleDeliveryMethod,
    logo,
    logoPreview,
    setLogo,
  };
}
