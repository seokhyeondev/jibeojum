import { notFound } from "next/navigation";
import { Hydrated } from "@/components/common/hydrated";
import { ListingDetail } from "@/components/listing/listing-detail";
import { getListing, getListingIds } from "@/lib/api/listings";

export function generateStaticParams() {
  return getListingIds().map((id) => ({ id }));
}

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getListing(id)) notFound();
  return (
    <Hydrated>
      <ListingDetail id={id} />
    </Hydrated>
  );
}
