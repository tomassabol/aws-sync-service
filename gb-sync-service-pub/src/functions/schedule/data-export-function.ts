import {
  DynamoDBClient,
  ExportTableToPointInTimeCommand,
} from "@aws-sdk/client-dynamodb"
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts"
import { logger } from "@gymbeam/aws-common/utils/logger"
import { sendEvent } from "@gymbeam/aws-services/eventbridge"
import assert from "assert"

import { publishStoredMetrics } from "../../common/metrics"
import { getSlackService } from "../../service/slack/slack-client"
import { type BackupResult } from "../../types"
import { filterBackupResults } from "./lib/filter-backup-results"
import { getTablesToBackup } from "./lib/get-tables-to-backup"

const dynamoDbClient = new DynamoDBClient()
const stsClient = new STSClient()

type DataExportEvent = Partial<{
  tablesToBackup: string[]
  targetStages: string[]
}>

export const handler = async (event: DataExportEvent) => {
  event.targetStages ??= ["test", "canary", "qa"] // eslint-disable-line no-param-reassign
  logger.info("Data export function", { event })

  try {
    await handlerWithMetrics(event)
  } catch (error) {
    logger.error("Data export function failed", { error })
    throw error
  } finally {
    publishStoredMetrics()
  }
}

const handlerWithMetrics = async (event: DataExportEvent) => {
  const { Account: accountId } = await stsClient.send(
    new GetCallerIdentityCommand(),
  )

  const {
    BACKUP_BUCKET_NAME: backupBucketName,
    EVENT_BUS_NAME: eventBusName,
    STAGE: stage,
    AWS_REGION: region,
  } = process.env

  assert(backupBucketName, "BACKUP_BUCKET_NAME environment variable is not set")
  assert(eventBusName, "EVENT_BUS_NAME environment variable is not set")
  assert(accountId, "Unable to determine AWS account ID")
  assert(region, "Unable to determine AWS region")

  const tablesToBackup = Array.from(
    new Set(event.tablesToBackup ?? (await getTablesToBackup())),
  )

  const slackClient = await getSlackService()
  await slackClient.sendDataSyncStartedNotification({ tablesToBackup })

  if (tablesToBackup.length === 0) {
    logger.warn("No tables to backup found")
    await slackClient.sendDataSyncSuccessNotification({
      successfulTables: [],
      totalTables: 0,
    })
    return { status: "success", message: "No tables to backup" }
  }

  logger.info("Starting backup process", {
    tablesToBackup,
    backupBucketName,
    tableCount: tablesToBackup.length,
    targetStages: event.targetStages,
  })

  const backupResults: Array<BackupResult> = []

  const currentTime = new Date()
  const timestamp = currentTime.toISOString().replace(/[:.]/g, "-") // example: 2025-07-27T10-00-00-000Z

  await Promise.all(
    tablesToBackup.map(async (tableName) => {
      const s3Prefix = `table-exports/${stage}/${tableName}/${timestamp}/`
      const tableArn = `arn:aws:dynamodb:${region}:${accountId}:table/${tableName}`

      try {
        logger.info("Starting backup for table", { tableName, s3Prefix })

        const exportCommand = new ExportTableToPointInTimeCommand({
          TableArn: tableArn,
          S3Bucket: backupBucketName,
          S3Prefix: s3Prefix,
          ExportFormat: "DYNAMODB_JSON",
        })

        const response = await dynamoDbClient.send(exportCommand)

        backupResults.push({
          tableName,
          status: "initiated",
          exportArn: response.ExportDescription?.ExportArn,
          s3Prefix,
          timestamp,
        })

        logger.info("Export initiated successfully", {
          tableName,
          exportArn: response.ExportDescription?.ExportArn,
          exportStatus: response.ExportDescription?.ExportStatus,
          s3Prefix,
        })
      } catch (error) {
        backupResults.push({
          tableName,
          status: "failed",
          s3Prefix,
          timestamp,
        })

        logger.error("Failed to backup table", { tableName, error })
      }
    }),
  )

  const { successfulBackups, failedBackups } =
    filterBackupResults(backupResults)

  logger.info("Backup process completed", {
    totalTables: tablesToBackup.length,
    successful: successfulBackups.length,
    failed: failedBackups.length,
    results: backupResults,
    targetStages: event.targetStages,
  })

  const promises: Array<Promise<void>> = []

  if (failedBackups.length > 0) {
    promises.push(
      slackClient.sendDataSyncFailureNotification({
        successfulTables: successfulBackups.map(({ tableName }) => tableName),
        failedTables: failedBackups.map(({ tableName }) => tableName),
      }),
    )
  } else {
    promises.push(
      slackClient.sendDataSyncSuccessNotification({
        successfulTables: successfulBackups.map(({ tableName }) => tableName),
        totalTables: tablesToBackup.length,
      }),
    )
  }

  promises.push(
    sendEvent({
      eventBusName,
      source: "gb-sync-service-pub",
      eventType: "table-backup-initiated",
      event: {
        totalTables: tablesToBackup.length,
        successful: successfulBackups.length,
        failed: failedBackups.length,
        results: backupResults,
        stage,
        targetStages: event.targetStages,
      },
    }),
  )

  await Promise.all(promises)

  return {
    status: "completed",
    totalTables: tablesToBackup.length,
    successful: successfulBackups.length,
    failed: failedBackups.length,
    results: backupResults,
    targetStages: event.targetStages,
  } as const
}
