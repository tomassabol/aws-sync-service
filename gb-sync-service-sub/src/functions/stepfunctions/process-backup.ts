import { logger } from "@gymbeam/aws-common/utils/logger"

import { tryCatch } from "../../lib/promise-helpers"
import { type BackupFile, type ProcessResult } from "../../types"
import { checkBackupCompletion } from "../lib/check-backup-completion"
import { checkBackupHasData } from "../lib/check-backup-data"
import { clearOrCreateTable } from "../lib/clear-or-create-table"
import { listS3BackupFiles } from "../lib/list-s3-backup-files"
import { mapTableNameToTargetStage } from "../lib/map-table-name"
import { copyDataFromS3ToTable } from "../lib/migrate-from-s3-to-dynamodb"

const SOURCE_STAGE = process.env.SOURCE_STAGE ?? "prod"
const TARGET_STAGE = process.env.STAGE ?? "test"

export const handler = async (
  backupFile: BackupFile,
): Promise<ProcessResult> => {
  logger.info("Processing backup file:", { backupFile })

  try {
    const completionCheck = await checkBackupCompletion({
      s3Prefix: backupFile.s3Prefix,
      tableName: backupFile.tableName,
    })

    if (!completionCheck.isComplete) {
      logger.warn("Backup not completed:", completionCheck.message)
      return {
        tableName: backupFile.tableName,
        status: "failed",
        message: completionCheck.message,
      }
    }

    logger.info("Backup completion verified:", completionCheck.message)

    const s3Files = await listS3BackupFiles(backupFile.s3Prefix)

    if (s3Files.length === 0) {
      logger.warn("No backup files found in S3")
      return {
        tableName: backupFile.tableName,
        status: "failed",
        message:
          "No backup files found in S3 - this should not happen after completion check",
      }
    }

    const { hasData: hasBackupData, message: backupMessage } =
      await checkBackupHasData({
        s3Files,
        tableName: backupFile.tableName,
      })

    if (!hasBackupData) {
      logger.info("No data found in backup:", backupMessage)
      return {
        tableName: backupFile.tableName,
        status: "success",
        message: `Backup processing skipped - ${backupMessage}`,
      }
    }

    logger.info("Backup data validated:", backupMessage)

    const targetTableName = mapTableNameToTargetStage({
      tableName: backupFile.tableName,
      sourceStage: SOURCE_STAGE,
      targetStage: TARGET_STAGE,
    })

    await clearOrCreateTable({
      tableName: targetTableName,
      s3Prefix: backupFile.s3Prefix,
    })

    // Copy data from S3 backup files to target table
    let totalItemsProcessed = 0
    await Promise.all(
      s3Files.map(async (s3File) => {
        const { data, error } = await tryCatch(
          copyDataFromS3ToTable({
            s3Key: s3File,
            tableName: targetTableName,
          }),
        )

        if (error) {
          logger.error(`Error processing ${s3File}:`, { error })
          return
        }

        totalItemsProcessed += data
        logger.info(`Processed ${data} items from ${s3File}`)
      }),
    )

    return {
      tableName: backupFile.tableName,
      status: "success",
      message: `Successfully imported ${totalItemsProcessed} items: ${backupFile.tableName} -> ${targetTableName}`,
    }
  } catch (error) {
    logger.error("Error processing backup file:", { error })

    return {
      tableName: backupFile.tableName,
      status: "failed",
      message: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
