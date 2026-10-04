import { Hydrated } from "@/components/common/hydrated";
import { ListingDetail } from "@/components/listing/listing-detail";

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Hydrated>
      <ListingDetail id={id} />
    </Hydrated>
  );
}
