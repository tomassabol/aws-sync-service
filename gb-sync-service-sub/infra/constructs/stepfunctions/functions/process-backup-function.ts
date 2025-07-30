import {
  BaseConstruct,
  type IBaseConstruct,
  NodeJsFunctionSimplePattern,
} from "@gymbeam/cdk-template"
import { Duration } from "aws-cdk-lib"
import type * as events from "aws-cdk-lib/aws-events"
import * as iam from "aws-cdk-lib/aws-iam"
import type * as lambda from "aws-cdk-lib/aws-lambda"
import type * as s3 from "aws-cdk-lib/aws-s3"

import { defaultNodeJsFunctionSimplePatternArgs } from "../../defaults/default-lambda-function-props"

export class ProcessBackupFunction extends BaseConstruct {
  public function: lambda.Function

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

    const { lambdaFunction: processBackupFunction } =
      new NodeJsFunctionSimplePattern(
        ...defaultNodeJsFunctionSimplePatternArgs(this, "process-backup", {
          entry: "src/functions/stepfunctions/process-backup.ts",
          description: "Process individual backup file from S3",
          timeout: Duration.minutes(15),
          memorySize: 1024,
          environment: {
            BACKUP_BUCKET_NAME: backupBucket.bucketName,
            EVENT_BUS_NAME: eventBus.eventBusName,
            SOURCE_STAGE: "prod",
            TARGET_STAGE: this.stageName,
          },
        }),
      )

    this.function = processBackupFunction

    backupBucket.grantRead(this.function)
    eventBus.grantPutEventsTo(this.function)

    this.function.addToRolePolicy(
      new iam.PolicyStatement({
        resources: ["*"],
        actions: [
          "dynamodb:CreateTable",
          "dynamodb:DescribeTable",
          "dynamodb:DeleteTable",
          "dynamodb:PutItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:Scan",
        ],
      }),
    )

    // Add S3 permissions for cross-account bucket access
    this.function.addToRolePolicy(
      new iam.PolicyStatement({
        resources: [backupBucket.bucketArn, `${backupBucket.bucketArn}/*`],
        actions: [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:ListBucket",
          "s3:GetBucketLocation",
        ],
      }),
    )

    this.function.addToRolePolicy(
      new iam.PolicyStatement({
        resources: ["*"],
        actions: ["ssm:GetParameters"],
      }),
    )
  }
}
