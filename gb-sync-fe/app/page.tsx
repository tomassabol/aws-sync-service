import { Suspense } from "react";
import { ZapIcon } from "lucide-react";
import { getTableList } from "~/actions/get-tables";
import { DataSyncClient } from "~/components/data-sync-client";
import { TableListSkeleton } from "~/components/table-list-skeleton";

async function DataSyncServer() {
  const tableData = await getTableList();

  return <DataSyncClient tableData={tableData} />;
}

export default function DataSyncApp() {
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 inline-flex items-center gap-2">
          <ZapIcon className="size-8 text-blue-400" />
          Data Sync Service
        </h1>
        <p className="text-muted-foreground">
          Sync data from production to test environments
        </p>
      </div>

      <Suspense fallback={<TableListSkeleton />}>
        <DataSyncServer />
      </Suspense>
    </div>
  );
}
