import { VaultFeed } from "@/components/VaultFeed";

type Props = { searchParams: { projectId?: string } };

export default function FeedPage({ searchParams }: Props) {
  return <VaultFeed projectId={searchParams.projectId} />;
}
