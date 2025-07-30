import { logger } from "@gymbeam/aws-common/utils/logger"
import { getSsmParameters } from "@gymbeam/aws-services/ssm"

export async function getTablesToBackup() {
  try {
    const stage = process.env.STAGE
    const tables = await getSsmParameters({
      general: `/gb-sync-service-pub/data-export/tables-to-backup/${stage}`,
    })

    const tablesToBackup = tables.general.split(",")

    logger.info("Tables to backup", { tablesToBackup })

    return tablesToBackup
  } catch (error) {
    logger.error("Error getting tables to backup", { error })
    return []
  }
}
