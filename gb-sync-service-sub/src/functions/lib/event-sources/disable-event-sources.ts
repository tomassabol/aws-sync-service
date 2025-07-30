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

export async function disableDynamoDbEventSources() {
  const slackClient = await getSlackService()
  await slackClient.sendStreamDisablingNotification()

  const processedMappings: EventSourceMapping[] = []
  const dynamoDbMappings = await listDynamoDbEventSources()

  for (const mapping of dynamoDbMappings) {
    if (mapping.UUID) {
      processedMappings.push({
        UUID: mapping.UUID,
        State: mapping.State ?? "Disabled",
      })
    }
  }

  const enabledDynamoDbMappings = dynamoDbMappings.filter(
    (mapping) => mapping.State === "Enabled",
  )

  // Disable only the enabled DynamoDB ones
  await Promise.all(
    enabledDynamoDbMappings.map(async (mapping) => {
      if (!mapping.UUID) {
        return
      }

      const { error } = await tryCatch(
        lambdaClient.send(
          new UpdateEventSourceMappingCommand({
            UUID: mapping.UUID,
            Enabled: false,
          }),
        ),
      )

      if (error) {
        return logger.error(
          `Failed to disable DynamoDB event source mapping: ${mapping.UUID}`,
          {
            error,
          },
        )
      }

      processedMappings.push({
        UUID: mapping.UUID,
        State: "Disabled",
      })
    }),
  )

  return {
    action: "disable",
    processedMappings,
    totalMappings: dynamoDbMappings.length,
  } satisfies ManageEventSourcesOutput
}
