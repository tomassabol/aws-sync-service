import {
  type AttributeValue,
  BatchWriteItemCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ScanCommand,
  type ScanCommandOutput,
} from "@aws-sdk/client-dynamodb"
import { logger } from "@gymbeam/aws-common/utils/logger"

import { createBasicTable } from "./create-basic-table"

const dynamoClient = new DynamoDBClient()

export async function clearOrCreateTable({
  tableName,
  s3Prefix,
}: {
  tableName: string
  s3Prefix: string
}): Promise<void> {
  try {
    // Check if table exists and get its schema
    const describeCommand = new DescribeTableCommand({ TableName: tableName })
    const tableDescription = await dynamoClient.send(describeCommand)

    if (!tableDescription.Table) {
      throw new Error(`Table description not found for ${tableName}`)
    }

    logger.info(`Table ${tableName} exists, clearing all data`)

    // Get key attributes for proper deletion
    const keySchema = tableDescription.Table.KeySchema || []
    const keyAttributes = keySchema
      .map((key) => key.AttributeName!)
      .filter(Boolean)

    if (keyAttributes.length === 0) {
      throw new Error(`No key attributes found for table ${tableName}`)
    }

    logger.info(
      `Table ${tableName} key attributes: ${keyAttributes.join(", ")}`,
    )

    // Scan and delete all items with pagination
    let totalItemsDeleted = 0
    let lastEvaluatedKey = undefined

    do {
      // Scan table to get items (only key attributes needed)
      const scanCommand: ScanCommand = new ScanCommand({
        TableName: tableName,
        ProjectionExpression: keyAttributes.join(", "),
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 25, // Process in batches of 25 (DynamoDB batch limit)
      })

      const scanResponse: ScanCommandOutput =
        await dynamoClient.send(scanCommand)

      if (scanResponse.Items && scanResponse.Items.length > 0) {
        // Create delete requests with only key attributes
        const deleteRequests = scanResponse.Items.map(
          (item: Record<string, AttributeValue>) => {
            const key: Record<string, AttributeValue> = {}
            keyAttributes.forEach((attr) => {
              if (item[attr]) {
                key[attr] = item[attr]
              }
            })

            return {
              DeleteRequest: {
                Key: key,
              },
            }
          },
        )

        // Batch delete items
        const batchWriteCommand = new BatchWriteItemCommand({
          RequestItems: {
            [tableName]: deleteRequests,
          },
        })

        await dynamoClient.send(batchWriteCommand)
        totalItemsDeleted += deleteRequests.length
      }

      lastEvaluatedKey = scanResponse.LastEvaluatedKey
    } while (lastEvaluatedKey)

    logger.info(
      `Successfully cleared ${totalItemsDeleted} total items from ${tableName}`,
    )
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "ResourceNotFoundException") {
      // Table doesn't exist - create a simple one
      // In practice, you might want to create with proper schema or fail here
      logger.info(
        `Table ${tableName} doesn't exist. Creating basic table for import.`,
      )
      await createBasicTable({ tableName, s3Prefix })
    } else {
      logger.error(`Error ensuring table ${tableName} is ready:`, { error })
      throw error
    }
  }
}
