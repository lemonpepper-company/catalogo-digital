import { redirect } from "next/navigation";
import { getCurrentStore } from "@/lib/server/store";
import { PersonalizacaoClient } from "./PersonalizacaoClient";

export default async function PersonalizacaoPage() {
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  return <PersonalizacaoClient settings={store} />;
}
