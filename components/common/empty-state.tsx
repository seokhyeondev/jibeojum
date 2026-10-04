import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}

export function EmptyState({ icon, title, description, actionLabel, actionHref }: Props) {
  return (
    <div className="empty-state">
      <i aria-hidden>{icon}</i>
      <h2>{title}</h2>
      <p>{description}</p>
      <Button asChild className="primary wide">
        <Link href={actionHref}>{actionLabel}</Link>
      </Button>
    </div>
  );
}
