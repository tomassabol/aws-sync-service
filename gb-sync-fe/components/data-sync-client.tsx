"use client";

import { useState, useTransition } from "react";
import {
  Database,
  RefreshCw,
  Play,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { syncTablesToEnvironments } from "~/actions/sync-tables";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Separator } from "~/components/ui/separator";
import { useToast } from "~/hooks/use-toast";
import { type TableListResponse } from "~/actions/get-tables";
import { tryCatch } from "~/lib/try-catch";

const environments = [
  { id: "test", name: "Test", color: "bg-blue-500" },
  { id: "canary", name: "Canary", color: "bg-yellow-500" },
  { id: "qa", name: "QA", color: "bg-green-500" },
] as const;

type SyncJob = {
  id: string;
  tables: string[];
  environments: string[];
  status: "pending" | "running" | "completed" | "failed";
  startTime: string;
  endTime?: string;
  progress: number;
};

export function DataSyncClient({
  tableData,
}: Readonly<{
  tableData: TableListResponse;
}>) {
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [selectedEnvironments, setSelectedEnvironments] = useState<string[]>(
    []
  );
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleTableSelection = ({
    tableName,
    checked,
  }: {
    tableName: string;
    checked: boolean;
  }) => {
    if (checked) {
      setSelectedTables((prev) => [...prev, tableName]);
    } else {
      setSelectedTables((prev) => prev.filter((t) => t !== tableName));
    }
  };

  const handleSelectAllTables = () => {
    if (selectedTables.length === tableData.tables.length) {
      setSelectedTables([]);
    } else {
      setSelectedTables(tableData.tables);
    }
  };

  const handleEnvironmentSelection = (envId: string, checked: boolean) => {
    if (checked) {
      setSelectedEnvironments((prev) => [...prev, envId]);
    } else {
      setSelectedEnvironments((prev) => prev.filter((e) => e !== envId));
    }
  };

  const initiateSync = () => {
    if (selectedTables.length === 0 || selectedEnvironments.length === 0) {
      toast({
        title: "Selection Required",
        description: "Please select at least one table and one environment",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      const { data, error } = await tryCatch(
        syncTablesToEnvironments({
          tables: selectedTables,
          environments: selectedEnvironments,
        })
      );

      if (error) {
        toast({
          title: "Sync Failed",
          description: "Failed to start sync operation. Please try again.",
          variant: "destructive",
        });
      }

      if (data) {
        toast({
          title: "Sync Initiated",
          description: `Started syncing ${selectedTables.length} tables to ${selectedEnvironments.length} environments`,
        });
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Production Tables
                </CardTitle>
                <CardDescription>
                  Select tables to sync from production database
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAllTables}
                  disabled={isPending}
                >
                  {selectedTables.length === tableData.tables.length
                    ? "Deselect All"
                    : "Select All"}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary">{tableData.count} tables</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin" />
                <span className="ml-2">Loading tables...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {tableData.tables.map((tableName, index) => (
                  <div
                    key={tableName}
                    className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <Checkbox
                      id={tableName}
                      checked={selectedTables.includes(tableName)}
                      onCheckedChange={(checked) =>
                        handleTableSelection({
                          tableName,
                          checked:
                            checked === "indeterminate" ? false : checked,
                        })
                      }
                    />
                    <div className="flex-1">
                      <label
                        htmlFor={tableName}
                        className="text-sm font-medium cursor-pointer flex items-center gap-3"
                      >
                        <span className="text-xs text-muted-foreground w-8">
                          {index + 1}
                        </span>
                        <span>{tableName}</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Total tables: {tableData.count}</span>
                <span>
                  Total selected: {selectedTables.length} / {tableData.count}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Target Environments</CardTitle>
            <CardDescription>
              Select environments to sync data to
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {environments.map((env) => (
                <div key={env.id} className="flex items-center space-x-3">
                  <Checkbox
                    id={env.id}
                    checked={selectedEnvironments.includes(env.id)}
                    onCheckedChange={(checked) =>
                      handleEnvironmentSelection(env.id, checked as boolean)
                    }
                  />
                  <label
                    htmlFor={env.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <div className={`w-3 h-3 rounded-full ${env.color}`} />
                    {env.name}
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sync Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-muted-foreground">
                  Selected Tables:
                </span>
                <div className="font-medium">
                  {selectedTables.length} tables
                </div>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">
                  Target Environments:
                </span>
                <div className="font-medium">
                  {selectedEnvironments.length} environments
                </div>
              </div>
              <Separator />
              <Button
                onClick={initiateSync}
                disabled={
                  isPending ||
                  selectedTables.length === 0 ||
                  selectedEnvironments.length === 0
                }
                className="w-full"
              >
                <Play className="w-4 h-4 mr-2" />
                {isPending ? "Starting Sync..." : "Start Sync"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
