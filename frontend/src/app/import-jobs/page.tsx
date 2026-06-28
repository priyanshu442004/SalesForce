import { Suspense } from "react";
import ImportJobsPage from "@/component/pages/ImportJobsPage";

export default function Page() {
  return (
    <Suspense>
      <ImportJobsPage />
    </Suspense>
  );
}
