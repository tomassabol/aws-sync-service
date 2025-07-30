import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { logger } from "@gymbeam/aws-common/utils/logger"
import { type Readable } from "stream"
import * as zlib from "zlib"

import { tryCatchSync } from "../../lib/promise-helpers"

const s3Client = new S3Client()
const BACKUP_BUCKET_NAME = process.env.BACKUP_BUCKET_NAME!

export async function checkBackupHasData({
  s3Files,
  tableName,
}: {
  s3Files: string[]
  tableName: string
}): Promise<{
  hasData: boolean
  totalItems: number
  message: string
}> {
  try {
    logger.info(
      `Checking backup data for ${tableName} across ${s3Files.length} files`,
    )

    if (s3Files.length === 0) {
      return {
        hasData: false,
        totalItems: 0,
        message: `No backup files found for ${tableName}`,
      }
    }

    let totalItemsEstimate = 0
    const maxFilesToCheck = Math.min(s3Files.length, 3) // Sample first 3 files for efficiency

    for (let i = 0; i < maxFilesToCheck; i++) {
      const s3Key = s3Files[i]

      try {
        const command = new GetObjectCommand({
          Bucket: BACKUP_BUCKET_NAME,
          Key: s3Key,
        })

        const response = await s3Client.send(command)
        const stream = response.Body as Readable

        const dataStream = s3Key.endsWith(".gz")
          ? stream.pipe(zlib.createGunzip())
          : stream

        const chunks: Buffer[] = []
        let bytesRead = 0
        const maxSampleBytes = 50000 // Read first 50KB to estimate data volume

        for await (const chunk of dataStream) {
          chunks.push(chunk)
          bytesRead += chunk.length
          if (bytesRead > maxSampleBytes) break
        }

        const content = Buffer.concat(chunks).toString("utf-8")
        const lines = content.split("\n").filter((line) => line.trim())

        if (lines.length === 0) {
          logger.warn(`File ${s3Key} appears to be empty`)
          continue
        }

        let validItems = 0
        for (const line of lines) {
          const { data, error } = tryCatchSync(
            () => JSON.parse(line) as { Item: Record<string, unknown> },
          )
          if (error) {
            continue
          }

          if (data?.Item && Object.keys(data.Item).length > 0) {
            validItems += 1
          }
        }

        const fileSize = response.ContentLength ?? 0
        const sampledRatio = bytesRead / Math.max(fileSize, 1)
        const estimatedItemsInFile = Math.round(
          validItems / Math.max(sampledRatio, 0.01),
        )

        totalItemsEstimate += estimatedItemsInFile

        logger.info(
          `File ${s3Key}: ${validItems} items in sample, estimated ${estimatedItemsInFile} total items`,
        )
      } catch (error) {
        logger.error(`Error checking data in file ${s3Key}:`, { error })
      }
    }

    if (s3Files.length > maxFilesToCheck && totalItemsEstimate > 0) {
      const avgItemsPerFile = totalItemsEstimate / maxFilesToCheck
      totalItemsEstimate = Math.round(avgItemsPerFile * s3Files.length)
    }

    if (totalItemsEstimate === 0) {
      return {
        hasData: false,
        totalItems: 0,
        message: `No valid data items found in backup files for ${tableName}`,
      }
    }

    logger.info(
      `Backup data check completed for ${tableName}: estimated ${totalItemsEstimate} items`,
    )

    return {
      hasData: true,
      totalItems: totalItemsEstimate,
      message: `Backup contains approximately ${totalItemsEstimate} data items for ${tableName}`,
    }
  } catch (error) {
    logger.error(`Error checking backup data for ${tableName}:`, { error })
    return {
      hasData: false,
      totalItems: 0,
      message: `Error checking backup data: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}
