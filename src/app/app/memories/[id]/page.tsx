import { VaultMemoryDetail } from "@/components/VaultMemoryDetail";

export default function MemoryPage({
  params,
}: {
  params: { id: string };
}) {
  return <VaultMemoryDetail id={params.id} />;
}
