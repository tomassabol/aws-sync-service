import {
  LambdaClient,
  UpdateEventSourceMappingCommand,
} from "@aws-sdk/client-lambda"
import { logger } from "@gymbeam/aws-common/utils/logger"

import { tryCatch } from "../../../lib/promise-helpers"
import { getSlackService } from "../../../service/slack/slack-client"
import {
  type EventSourceMapping,
  type ManageEventSourcesOutput,
} from "../../../types"
import { listDynamoDbEventSources } from "./list-dynamodb-event-sources"

const lambdaClient = new LambdaClient()

export async function enableDynamoDbEventSources() {
  const slackClient = await getSlackService()
  await slackClient.sendStreamEnablingNotification()

  const processedMappings: EventSourceMapping[] = []
  const mappings = await listDynamoDbEventSources()

  logger.info(`Enabling all ${mappings.length} event source mappings`)

  await Promise.all(
    mappings.map(async (mapping) => {
      if (!mapping.UUID) {
        return
      }

      const { error } = await tryCatch(
        lambdaClient.send(
          new UpdateEventSourceMappingCommand({
            UUID: mapping.UUID,
            Enabled: true,
          }),
        ),
      )

      if (error) {
        return logger.error(
          `Failed to enable event source mapping: ${mapping.UUID}`,
          {
            error,
          },
        )
      }

      processedMappings.push({
        UUID: mapping.UUID,
        State: "Enabled",
      })
    }),
  )

  return {
    action: "enable",
    processedMappings,
    totalMappings: mappings.length,
  } satisfies ManageEventSourcesOutput
}
