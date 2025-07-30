import { BatchWriteItemCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { logger } from "@gymbeam/aws-common/utils/logger"
import { type Readable } from "stream"
import * as zlib from "zlib"

const s3Client = new S3Client()
const dynamoClient = new DynamoDBClient()

const BACKUP_BUCKET_NAME = process.env.BACKUP_BUCKET_NAME!

export async function copyDataFromS3ToTable({
  s3Key,
  tableName,
}: {
  s3Key: string
  tableName: string
}): Promise<number> {
  logger.info(`Copying data from ${s3Key} to ${tableName}`)

  const command = new GetObjectCommand({
    Bucket: BACKUP_BUCKET_NAME,
    Key: s3Key,
  })

  const s3Response = await s3Client.send(command)
  const stream = s3Response.Body as Readable

  const dataStream = s3Key.endsWith(".gz")
    ? stream.pipe(zlib.createGunzip())
    : stream

  const chunks: Buffer[] = []
  for await (const chunk of dataStream) {
    chunks.push(chunk)
  }

  const rows = Buffer.concat(chunks)
    .toString("utf-8")
    .split("\n")
    .filter((line) => line.trim())

  let itemsProcessed = 0
  const batchSize = 25 // DynamoDB batch write limit

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)

    if (batch.length > 0) {
      const batchWriteCommand = new BatchWriteItemCommand({
        RequestItems: {
          [tableName]: batch.map((row) => {
            const item = JSON.parse(row)
            return {
              PutRequest: {
                Item: item.Item,
              },
            }
          }),
        },
      })

      await dynamoClient.send(batchWriteCommand)
      itemsProcessed += batch.length
    }
  }

  return itemsProcessed
}
