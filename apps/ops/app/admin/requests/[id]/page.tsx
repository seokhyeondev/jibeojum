import { AdminRequestDetailPage } from "@/components/ops/admin-request-detail";

export default async function AdminRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminRequestDetailPage id={id} />;
}
