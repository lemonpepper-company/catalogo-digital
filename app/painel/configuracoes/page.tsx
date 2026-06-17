import { redirect } from "next/navigation";
import { getCurrentStore } from "@/lib/server/store";
import { ConfiguracoesClient } from "./ConfiguracoesClient";

export default async function ConfiguracoesPage() {
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  return <ConfiguracoesClient settings={store} />;
}
