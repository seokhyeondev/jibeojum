"use client";

import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useBack } from "./back-navigation";

interface Props {
  title: string;
  fallbackHref: string;
  action?: ReactNode;
}

export function SimpleHead({ title, fallbackHref, action }: Props) {
  const back = useBack(fallbackHref);
  return (
    <div className="simple-head">
      <button type="button" onClick={back} aria-label="뒤로 가기">
        <ArrowLeft />
      </button>
      <b>{title}</b>
      {action ?? <i />}
    </div>
  );
}
