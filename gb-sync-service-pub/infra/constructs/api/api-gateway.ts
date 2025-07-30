import {
  BaseConstruct,
  type IBaseConstruct,
  resourceName,
} from "@gymbeam/cdk-template"
import * as apigateway from "aws-cdk-lib/aws-apigateway"
import type * as events from "aws-cdk-lib/aws-events"
import * as iam from "aws-cdk-lib/aws-iam"
import type * as lambda from "aws-cdk-lib/aws-lambda"
import * as logs from "aws-cdk-lib/aws-logs"
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager"

export class ApiGateway extends BaseConstruct {
  public api: apigateway.RestApi
  public apiKeySecret: secretsmanager.Secret

  constructor(
    scope: IBaseConstruct,
    id: string,
    props: {
      eventBus: events.IEventBus
      listTablesFunction: lambda.IFunction
    },
  ) {
    super(scope, id)

    const { eventBus, listTablesFunction } = props

    // Create CloudWatch log group for API Gateway
    const logGroup = new logs.LogGroup(this, "api-gateway-logs", {
      logGroupName: resourceName(this, "api-gateway", "logs"),
      retention: logs.RetentionDays.ONE_MONTH,
    })

    // Create IAM role for API Gateway to publish to EventBridge
    const eventBridgeRole = new iam.Role(this, "eventbridge-role", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      inlinePolicies: {
        EventBridgePolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["events:PutEvents"],
              resources: [eventBus.eventBusArn],
            }),
          ],
        }),
      },
    })

    // Create API Gateway
    this.api = new apigateway.RestApi(this, "api", {
      restApiName: resourceName(this, "data-export", "api"),
      description: "API for triggering data export operations",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ["GET", "POST", "OPTIONS"],
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
          "X-Amz-Security-Token",
        ],
      },
      deployOptions: {
        stageName: this.stageName,
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: false,
        metricsEnabled: true,
      },
      cloudWatchRole: true,
    })

    // Create request validator
    const requestValidator = new apigateway.RequestValidator(
      this,
      "request-validator",
      {
        restApi: this.api,
        requestValidatorName: resourceName(this, "data-export", "validator"),
        validateRequestParameters: true,
        validateRequestBody: true,
      },
    )

    // Create request model for validation
    const requestModel = new apigateway.Model(this, "request-model", {
      restApi: this.api,
      modelName: "DataExportRequest",
      contentType: "application/json",
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          tablesToBackup: {
            type: apigateway.JsonSchemaType.ARRAY,
            items: {
              type: apigateway.JsonSchemaType.STRING,
            },
          },
          targetStages: {
            type: apigateway.JsonSchemaType.ARRAY,
            items: {
              type: apigateway.JsonSchemaType.STRING,
            },
          },
        },
        additionalProperties: false,
      },
    })

    // --- MINIMAL, SAFE EVENTBRIDGE MAPPING ---

    // ... previous code omitted for brevity ...

    const eventBridgeIntegration = new apigateway.AwsIntegration({
      service: "events",
      action: "PutEvents",
      options: {
        credentialsRole: eventBridgeRole,
        requestParameters: {
          "integration.request.header.X-Amz-Target": "'AWSEvents.PutEvents'",
          "integration.request.header.Content-Type":
            "'application/x-amz-json-1.1'",
        },
        requestTemplates: {
          "application/json": `{
    "Entries": [
      {
        "Source": "gb-sync-api",
        "DetailType": "data-export-requested",
        "Detail": "$util.escapeJavaScript($input.body)",
        "EventBusName": "${eventBus.eventBusName}"
      }
    ]
  }`,
        },
        integrationResponses: [
          {
            statusCode: "202",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": "'*'",
            },
            responseTemplates: {
              "application/json": `{
            "message": "Data export triggered successfully",
            "requestId": "$context.requestId",
            "triggeredAt": "$context.requestTime"
          }`,
            },
          },
          {
            statusCode: "400",
            selectionPattern: "4\\d{2}",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": "'*'",
            },
            responseTemplates: {
              "application/json": `{
            "error": "Bad Request",
            "requestId": "$context.requestId"
          }`,
            },
          },
          {
            statusCode: "500",
            selectionPattern: "5\\d{2}",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": "'*'",
            },
            responseTemplates: {
              "application/json": `{
            "error": "Internal Server Error",
            "requestId": "$context.requestId"
          }`,
            },
          },
        ],
      },
    })

    // ...rest of your code...

    // Generate API key and store in Secrets Manager
    this.apiKeySecret = new secretsmanager.Secret(this, "api-key-secret", {
      secretName: resourceName(this, "data-export-api", "key"),
      description: "API key for data export API Gateway",
      generateSecretString: {
        secretStringTemplate: "{}",
        generateStringKey: "apiKey",
        excludeCharacters: " %+~`#$&*()|[]{}:;<>?!'/@\"\\",
        includeSpace: false,
        passwordLength: 32,
      },
    })

    // Create API key
    const apiKey = new apigateway.ApiKey(this, "api-key", {
      apiKeyName: resourceName(this, "data-export", "key"),
      description: "API key for data export operations",
      value: this.apiKeySecret.secretValueFromJson("apiKey").unsafeUnwrap(),
    })

    // Create usage plan with rate limiting and throttling
    const usagePlan = new apigateway.UsagePlan(this, "usage-plan", {
      name: resourceName(this, "data-export", "usage-plan"),
      description: "Usage plan for data export API",
      throttle: {
        rateLimit: 10, // 10 requests per second
        burstLimit: 20, // 20 concurrent requests
      },
      quota: {
        limit: 1000, // 1000 requests per day
        period: apigateway.Period.DAY,
      },
      apiStages: [
        {
          api: this.api,
          stage: this.api.deploymentStage,
        },
      ],
    })

    // Associate API key with usage plan
    usagePlan.addApiKey(apiKey)

    // Create /trigger-export resource
    const triggerExportResource = this.api.root.addResource("trigger-export")

    // Add POST method with EventBridge integration
    triggerExportResource.addMethod("POST", eventBridgeIntegration, {
      apiKeyRequired: true, // Require API key
      requestValidator,
      requestModels: {
        "application/json": requestModel,
      },
      requestParameters: {
        "method.request.querystring.targetStages": false,
        "method.request.header.x-api-key": true, // Require x-api-key header
      },
      methodResponses: [
        {
          statusCode: "202",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
        {
          statusCode: "400",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
        {
          statusCode: "401",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
        {
          statusCode: "403",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
        {
          statusCode: "429",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
        {
          statusCode: "500",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
      ],
    })

    // Create /tables resource for listing DynamoDB tables
    const tablesResource = this.api.root.addResource("tables")

    // Create Lambda integration for list tables function
    const listTablesIntegration = new apigateway.LambdaIntegration(
      listTablesFunction,
      { proxy: true },
    )

    // Add GET method for listing tables
    tablesResource.addMethod("GET", listTablesIntegration, {
      apiKeyRequired: true, // Require API key
      requestParameters: {
        "method.request.header.x-api-key": true, // Require x-api-key header
      },
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
        {
          statusCode: "401",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
        {
          statusCode: "403",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
        {
          statusCode: "429",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
        {
          statusCode: "500",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
      ],
    })
  }
}
