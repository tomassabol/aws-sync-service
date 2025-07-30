import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { logger } from "@gymbeam/aws-common/utils/logger"
import { type Readable } from "stream"
import * as zlib from "zlib"

import { type TableStructure } from "../../types"

const s3Client = new S3Client()

export async function getTableStructureFromBackup({
  s3Key,
  backupBucketName,
}: {
  s3Key: string
  backupBucketName: string
}): Promise<TableStructure> {
  try {
    logger.info(`Reading table structure from ${s3Key}`)

    const command = new GetObjectCommand({
      Bucket: backupBucketName,
      Key: s3Key,
    })

    const response = await s3Client.send(command)
    const stream = response.Body as Readable

    // Handle gzipped files
    const dataStream = s3Key.endsWith(".gz")
      ? stream.pipe(zlib.createGunzip())
      : stream

    // Read first few lines to get table structure
    const chunks: Buffer[] = []
    let bytesRead = 0
    const maxBytes = 10000 // Read first 10KB to get structure

    for await (const chunk of dataStream) {
      chunks.push(chunk)
      bytesRead += chunk.length
      if (bytesRead > maxBytes) break
    }

    const data = Buffer.concat(chunks).toString("utf-8")
    const lines = data.split("\n").filter((line) => line.trim())

    if (lines.length === 0) {
      throw new Error("No data found in backup file")
    }

    // Parse first item to get structure
    const firstItem = JSON.parse(lines[0])

    // Extract key schema and attribute definitions
    const attributeDefinitions: TableStructure["attributeDefinitions"] = []
    const keySchema: TableStructure["keySchema"] = []

    // Get all attributes from the first item
    if (firstItem.Item) {
      const attributes = Object.keys(firstItem.Item)
      logger.info(`Found attributes in backup: ${attributes.join(", ")}`)

      // Try to detect primary key - common patterns
      const commonPkNames = [
        "id",
        "refId",
        "pk",
        "userId",
        "itemId",
        "key",
        "hashKey",
      ]
      let primaryKey = null

      // Look for common primary key names
      for (const pkName of commonPkNames) {
        if (attributes.includes(pkName)) {
          primaryKey = pkName
          break
        }
      }

      // If no common name found, use the first attribute as primary key
      if (!primaryKey && attributes.length > 0) {
        primaryKey = attributes[0]
        logger.warn(
          `No common primary key found, using first attribute: ${primaryKey}`,
        )
      }

      if (primaryKey) {
        const pkData = firstItem.Item[primaryKey]
        let attributeType = "S" // default to string

        // Detect attribute type from DynamoDB format
        if (pkData.S !== undefined) attributeType = "S"
        else if (pkData.N !== undefined) attributeType = "N"
        else if (pkData.B !== undefined) attributeType = "B"

        attributeDefinitions.push({
          AttributeName: primaryKey,
          AttributeType: attributeType as "S" | "N" | "B",
        })

        keySchema.push({
          AttributeName: primaryKey,
          KeyType: "HASH",
        })

        logger.info(`Detected primary key: ${primaryKey} (${attributeType})`)
      }
    }

    // Ensure we always have a valid key schema
    if (keySchema.length === 0) {
      logger.warn("Could not detect primary key, using default 'id' key")
      attributeDefinitions.push({
        AttributeName: "id",
        AttributeType: "S",
      })
      keySchema.push({
        AttributeName: "id",
        KeyType: "HASH",
      })
    }

    return {
      attributeDefinitions,
      keySchema,
      billingMode: "PAY_PER_REQUEST",
    }
  } catch (error) {
    logger.error("Error reading table structure:", { error })
    // Fallback to default structure
    return {
      attributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
      keySchema: [{ AttributeName: "id", KeyType: "HASH" }],
      billingMode: "PAY_PER_REQUEST",
    }
  }
}
