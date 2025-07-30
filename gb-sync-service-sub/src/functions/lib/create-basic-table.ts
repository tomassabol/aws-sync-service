import {
  CreateTableCommand,
  DynamoDBClient,
  waitUntilTableExists,
} from "@aws-sdk/client-dynamodb"
import { logger } from "@gymbeam/aws-common/utils/logger"

import { getTableStructureFromBackup } from "./get-table-structure-from-backup"
import { listS3BackupFiles } from "./list-s3-backup-files"

const dynamoClient = new DynamoDBClient()
const BACKUP_BUCKET_NAME = process.env.BACKUP_BUCKET_NAME!

export async function createBasicTable({
  tableName,
  s3Prefix,
}: {
  tableName: string
  s3Prefix: string
}): Promise<void> {
  const s3Files = await listS3BackupFiles(s3Prefix)

  if (s3Files.length === 0) {
    throw new Error(
      `Cannot create table ${tableName}: no backup files found to determine structure`,
    )
  }

  const tableStructure = await getTableStructureFromBackup({
    s3Key: s3Files[0],
    backupBucketName: BACKUP_BUCKET_NAME,
  })

  logger.info(`Creating table ${tableName} with structure:`, tableStructure)

  const createCommand = new CreateTableCommand({
    TableName: tableName,
    AttributeDefinitions: tableStructure.attributeDefinitions,
    KeySchema: tableStructure.keySchema,
    BillingMode: tableStructure.billingMode,
  })

  await dynamoClient.send(createCommand)

  // Wait for table to be active
  await waitUntilTableExists(
    { client: dynamoClient, maxWaitTime: 300 },
    { TableName: tableName },
  )

  logger.info(`Table ${tableName} created successfully`)
}
