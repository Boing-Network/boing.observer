import { Suspense } from "react";
import { ItemTypeView } from "@/components/item-type-view";

export default function ItemTypePage() {
  return (
    <Suspense fallback={null}>
      <ItemTypeView />
    </Suspense>
  );
}
