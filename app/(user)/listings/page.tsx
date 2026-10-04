import { Hydrated } from "@/components/common/hydrated";
import { ListingResults } from "@/components/listing/listing-results";

export default function ListingsPage() {
  return (
    <Hydrated>
      <ListingResults />
    </Hydrated>
  );
}
