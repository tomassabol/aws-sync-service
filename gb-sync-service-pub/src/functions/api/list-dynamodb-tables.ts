import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb"
import { logger } from "@gymbeam/aws-common/utils/logger"
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"

const dynamoClient = new DynamoDBClient({})

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    logger.info("Listing DynamoDB tables", {
      requestId: event.requestContext.requestId,
    })

    const command = new ListTablesCommand({})
    const response = await dynamoClient.send(command)

    const result = {
      tables: response.TableNames ?? [],
      count: response.TableNames?.length ?? 0,
      requestId: event.requestContext.requestId,
    }

    logger.info("Successfully listed DynamoDB tables", {
      count: result.count,
      requestId: event.requestContext.requestId,
    })

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
      },
      body: JSON.stringify(result),
    }
  } catch (error) {
    logger.error("Error listing DynamoDB tables", {
      error: error instanceof Error ? error.message : String(error),
      requestId: event.requestContext.requestId,
    })

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
      },
      body: JSON.stringify({
        error: "Failed to list DynamoDB tables",
        requestId: event.requestContext.requestId,
      }),
    }
  }
}
