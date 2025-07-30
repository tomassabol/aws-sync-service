export type BackupResult = {
  tableName: string
  status: "initiated" | "failed"
  exportArn?: string
  s3Prefix: string
  timestamp: string
}
