import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3"
import { logger } from "@gymbeam/aws-common/utils/logger"

const s3Client = new S3Client()
const BACKUP_BUCKET_NAME = process.env.BACKUP_BUCKET_NAME!

export async function listS3BackupFiles(s3Prefix: string): Promise<string[]> {
  try {
    const command = new ListObjectsV2Command({
      Bucket: BACKUP_BUCKET_NAME,
      Prefix: s3Prefix,
      MaxKeys: 10,
    })

    const response = await s3Client.send(command)
    return (
      response.Contents?.map((obj) => obj.Key!).filter((key) =>
        key.endsWith(".gz"),
      ) || []
    )
  } catch (error) {
    logger.error("Error listing S3 files:", { error })
    throw error
  }
}
