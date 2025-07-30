import { logger } from "@gymbeam/aws-common/utils/logger"

import type {
  ManageEventSourcesInput,
  ManageEventSourcesOutput,
} from "../../types"
import { disableDynamoDbEventSources } from "../lib/event-sources/disable-event-sources"
import { enableDynamoDbEventSources } from "../lib/event-sources/enable-event-sources"

export const handler = async (
  event: ManageEventSourcesInput,
): Promise<ManageEventSourcesOutput> => {
  logger.info("Managing event source mappings", { event })

  const { action } = event

  try {
    switch (action) {
      case "disable":
        return await disableDynamoDbEventSources()
      case "enable":
        return await enableDynamoDbEventSources()
      default:
        throw new Error(
          `Invalid action: ${action}. Must be 'disable' or 'enable'`,
        )
    }
  } catch (error) {
    logger.error("Error managing event source mappings", { error })
    throw error
  }
}
