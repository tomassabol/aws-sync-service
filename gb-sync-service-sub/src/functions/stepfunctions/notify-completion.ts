import { logger } from "@gymbeam/aws-common/utils/logger"

import { getSlackService } from "../../service/slack/slack-client"
import { type NotificationEvent } from "../../types"

export const handler = async (event: NotificationEvent): Promise<void> => {
  logger.info("Sending completion notification:", { event })

  try {
    const { status } = event
    const slackClient = await getSlackService()

    if (status === "SUCCESS") {
      await slackClient.sendDataImportCompletedNotification()
    } else {
      await slackClient.sendDataImportErrorNotification()
    }

    logger.info(`${status} notification sent successfully`)
  } catch (notificationError) {
    logger.error("Error sending notification:", { notificationError })
  }
}
