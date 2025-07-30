import { logger } from "@gymbeam/aws-common/utils/logger"

export function mapTableNameToTargetStage({
  tableName,
  sourceStage,
  targetStage,
}: {
  tableName: string
  sourceStage: string
  targetStage: string
}) {
  const stagePattern = new RegExp(`-${sourceStage}-`, "g")
  const mappedTableName = tableName.replace(stagePattern, `-${targetStage}-`)

  logger.info(`Mapping table name: ${tableName} -> ${mappedTableName}`)

  if (mappedTableName === tableName) {
    logger.warn(
      `Table name mapping did not change: ${tableName}. Check if source stage '${sourceStage}' exists in table name.`,
    )
  }

  return mappedTableName
}
