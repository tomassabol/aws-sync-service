import {
  type AppContext,
  BaseStack,
  type StackConfig,
} from "@gymbeam/cdk-template"
import { CfnEventBusPolicy, CfnRule } from "aws-cdk-lib/aws-events"
import * as iam from "aws-cdk-lib/aws-iam"
import * as s3 from "aws-cdk-lib/aws-s3"

import { prodAccountId } from "../constants"
import { EventBus } from "../constructs/eventbridge/event-bus"
import { DataSyncStateMachine } from "../constructs/stepfunctions/data-sync-state-machine"
import { ManageEventSourceFunction } from "../constructs/stepfunctions/functions/manage-event-source-function"
import { NotifyCompletionFunction } from "../constructs/stepfunctions/functions/notify-completion-function"
import { ProcessBackupFunction } from "../constructs/stepfunctions/functions/process-backup-function"

export class AppStack extends BaseStack {
  constructor(appContext: AppContext, stackConfig: StackConfig) {
    super(appContext, stackConfig, {
      description: `Sync service - sub - [${appContext.stageName}]`,
    })

    const { region } = this

    /**
     * S3 Buckets - Import from production account
     */
    const backupBucket = s3.Bucket.fromBucketArn(
      this,
      "backup-bucket",
      `arn:aws:s3:::gb-sync-service-pub-prod-backup-bucket`,
    )

    /**
     * Event Bus - Use custom event bus in test account for local rules
     */
    const { eventBus } = new EventBus(this, "event-bus")

    // Add cross-account permissions to test account event bus
    new CfnEventBusPolicy(this, "TestEventBusPolicy", {
      eventBusName: eventBus.eventBusName,
      statementId: `AllowProductionAccountAccess-${appContext.stageName}`,
      statement: {
        Sid: `AllowProductionAccountAccess-${appContext.stageName}`,
        Effect: "Allow",
        Principal: {
          AWS: `arn:aws:iam::${prodAccountId}:root`,
        },
        Action: "events:PutEvents",
        Resource: `arn:aws:events:${region}:${this.account}:event-bus/${eventBus.eventBusName}`,
      },
    })

    /**
     * Production Event Bus ARNs
     */
    const prodEventBusArn = `arn:aws:events:${region}:${prodAccountId}:event-bus/gb-sync-service-pub-prod-event-bus`

    /**
     * Functions
     */
    const { function: processBackupFunction } = new ProcessBackupFunction(
      this,
      "process-backup-function",
      { eventBus, backupBucket },
    )

    const { function: notifyCompletionFunction } = new NotifyCompletionFunction(
      this,
      "notify-completion-function",
      { eventBus },
    )

    const { function: manageEventSourcesFunction } =
      new ManageEventSourceFunction(this, "manage-event-sources-function")

    /**
     * State Machines - Create with local event bus for triggering
     */
    new DataSyncStateMachine(this, "data-sync-state-machine", {
      eventBus,
      processBackupFunction,
      notifyCompletionFunction,
      manageEventSourcesFunction,
    })

    // Create IAM role for cross-account EventBridge forwarding
    const crossAccountEventRole = new iam.Role(this, "CrossAccountEventRole", {
      assumedBy: new iam.ServicePrincipal("events.amazonaws.com"),
      inlinePolicies: {
        EventBusForwarding: new iam.PolicyDocument({
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

    // Create EventBridge rule on production event bus that forwards to test account's custom event bus
    new CfnRule(this, "CrossAccountForwardingRule", {
      name: `gb-sync-sub-${appContext.stageName}-forwarder`,
      description: "Forward backup events from production to test account",
      eventBusName: prodEventBusArn,
      eventPattern: {
        source: ["gb-sync-service-pub"],
        "detail-type": ["table-backup-initiated"],
      },
      state: "ENABLED",
      targets: [
        {
          id: "TestAccountEventBusTarget",
          arn: eventBus.eventBusArn,
          roleArn: crossAccountEventRole.roleArn,
        },
      ],
    })
  }
}
