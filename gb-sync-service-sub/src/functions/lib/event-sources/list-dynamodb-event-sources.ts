import {
  LambdaClient,
  ListEventSourceMappingsCommand,
} from "@aws-sdk/client-lambda"
import { logger } from "@gymbeam/aws-common/utils/logger"

const lambdaClient = new LambdaClient()

export async function listDynamoDbEventSources() {
  const listResponse = await lambdaClient.send(
    new ListEventSourceMappingsCommand(),
  )
  const allMappings = listResponse.EventSourceMappings ?? []

  // Filter for DynamoDB Streams event sources only
  const dynamoDbMappings = allMappings.filter(
    (mapping) =>
      mapping.EventSourceArn?.includes("dynamodb") &&
      mapping.EventSourceArn?.includes(process.env.STAGE!),
  )

  logger.info(
    `Found ${dynamoDbMappings.length} DynamoDB event source mappings out of ${allMappings.length} total`,
  )

  return dynamoDbMappings
}
