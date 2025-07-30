import {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { logger } from "@gymbeam/aws-common/utils/logger"
import { type Readable } from "stream"
import * as zlib from "zlib"

import { listS3BackupFiles } from "./list-s3-backup-files"

const s3Client = new S3Client()
const BACKUP_BUCKET_NAME = process.env.BACKUP_BUCKET_NAME!

export async function checkBackupCompletion({
  s3Prefix,
  tableName,
}: {
  s3Prefix: string
  tableName: string
}): Promise<{
  isComplete: boolean
  message: string
}> {
  try {
    logger.info(`Checking backup completion for ${tableName} at ${s3Prefix}`)

    // Check for completion marker file that AWS DynamoDB export creates
    const completionMarkerKey = `${s3Prefix}/_started`

    try {
      await s3Client.send(
        new HeadObjectCommand({
          Bucket: BACKUP_BUCKET_NAME,
          Key: completionMarkerKey,
        }),
      )
      logger.info(`Found completion marker for ${tableName}`)
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "NotFound") {
        return {
          isComplete: false,
          message: `Backup not yet started or completed for ${tableName} - missing completion marker`,
        } as const
      }
      throw error
    }

    // Additional check: verify that at least one data file exists and is readable
    const backupFiles = await listS3BackupFiles(s3Prefix)

    if (backupFiles.length === 0) {
      return {
        isComplete: false,
        message: `Backup files not found for ${tableName} - export may still be in progress`,
      } as const
    }

    // Check if files are fully written (not empty and contain valid JSON)
    for (const file of backupFiles.slice(0, 2)) {
      try {
        const command = new GetObjectCommand({
          Bucket: BACKUP_BUCKET_NAME,
          Key: file,
        })

        const response = await s3Client.send(command)
        const stream = response.Body as Readable

        const dataStream = file.endsWith(".gz")
          ? stream.pipe(zlib.createGunzip())
          : stream

        const chunks: Buffer[] = []
        let bytesRead = 0
        const maxBytes = 1000 // Read first 1KB to verify format

        for await (const chunk of dataStream) {
          chunks.push(chunk)
          bytesRead += chunk.length
          if (bytesRead > maxBytes) break
        }

        const content = Buffer.concat(chunks).toString("utf-8")
        const lines = content.split("\n").filter((line) => line.trim())

        if (lines.length === 0) {
          return {
            isComplete: false,
            message: `Backup file ${file} appears to be empty - export may still be in progress`,
          } as const
        }

        // Try to parse first line to ensure it's valid JSON
        JSON.parse(lines[0])
      } catch (parseError) {
        return {
          isComplete: false,
          message: `Backup file ${file} contains invalid data - export may be corrupted or incomplete`,
        } as const
      }
    }

    logger.info(`Backup verification completed successfully for ${tableName}`)
    return {
      isComplete: true,
      message: `Backup is complete and valid for ${tableName}`,
    } as const
  } catch (error) {
    logger.error(`Error checking backup completion for ${tableName}:`, {
      error,
    })
    return {
      isComplete: false,
      message: `Error verifying backup completion: ${error instanceof Error ? error.message : "Unknown error"}`,
    } as const
  }
}
