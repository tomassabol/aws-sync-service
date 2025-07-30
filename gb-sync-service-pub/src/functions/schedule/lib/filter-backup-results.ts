import type { BackupResult } from "../../../types"

export const filterBackupResults = (backupResults: Array<BackupResult>) => {
  const successfulBackups = backupResults.filter(
    (result) => result.status === "initiated",
  )
  const failedBackups = backupResults.filter(
    (result) => result.status === "failed",
  )

  return { successfulBackups, failedBackups } as const
}
