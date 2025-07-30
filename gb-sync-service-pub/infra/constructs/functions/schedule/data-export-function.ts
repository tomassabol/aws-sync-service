import {
  BaseConstruct,
  type IBaseConstruct,
  NodeJsFunctionSimplePattern,
  resourceName,
} from "@gymbeam/cdk-template"
import { Duration } from "aws-cdk-lib"
import * as events from "aws-cdk-lib/aws-events"
import * as targets from "aws-cdk-lib/aws-events-targets"
import * as iam from "aws-cdk-lib/aws-iam"
import type * as lambda from "aws-cdk-lib/aws-lambda"
import type * as s3 from "aws-cdk-lib/aws-s3"

import { defaultNodeJsFunctionSimplePatternArgs } from "../../defaults/default-lambda-function-props"

export class DataExportFunction extends BaseConstruct {
  public fn: lambda.Function

  constructor(
    scope: IBaseConstruct,
    id: string,
    props: {
      eventBus: events.IEventBus
      backupBucket: s3.IBucket
    },
  ) {
    super(scope, id)

    const { eventBus, backupBucket } = props

    const { lambdaFunction } = new NodeJsFunctionSimplePattern(
      ...defaultNodeJsFunctionSimplePatternArgs(this, id, {
        entry: "src/functions/schedule/data-export-function.ts",
        description: "Data export function",
        timeout: Duration.minutes(15),
        memorySize: 1024,
        warmUp: false,
        environment: {
          BACKUP_BUCKET_NAME: backupBucket.bucketName,
          EVENT_BUS_NAME: eventBus.eventBusName,
        },
      }),
    )

    this.fn = lambdaFunction

    eventBus.grantPutEventsTo(lambdaFunction)
    backupBucket.grantWrite(lambdaFunction)

    this.fn.addToRolePolicy(
      new iam.PolicyStatement({
        resources: ["*"],
        actions: ["ssm:GetParameters"],
      }),
    )

    this.fn.addToRolePolicy(
      new iam.PolicyStatement({
        resources: ["*"],
        actions: [
          "dynamodb:ExportTableToPointInTime",
          "dynamodb:DescribeTable",
          "dynamodb:DescribeExport",
        ],
      }),
    )

    /**
     * Every Sunday at 1am
     */
    new events.Rule(this, "rule", {
      ruleName: resourceName(this, "data-export-schedule", "rule"),
      schedule: events.Schedule.cron({
        minute: "0",
        hour: "1",
        weekDay: "SUN",
      }),
    }).addTarget(new targets.LambdaFunction(lambdaFunction))

    /**
     * EventBridge rule to handle API-triggered data exports
     */
    new events.Rule(this, "api-trigger-rule", {
      ruleName: resourceName(this, "data-export-api-trigger", "rule"),
      eventBus,
      eventPattern: {
        source: ["gb-sync-api"],
        detailType: ["data-export-requested"],
      },
      description: "Rule to trigger data export when requested via API",
    }).addTarget(
      new targets.LambdaFunction(lambdaFunction, {
        event: events.RuleTargetInput.fromEventPath("$.detail"),
      }),
    )
  }
}
