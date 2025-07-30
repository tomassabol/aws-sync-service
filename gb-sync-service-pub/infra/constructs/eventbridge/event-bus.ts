import { BaseConstruct, type IBaseConstruct } from "@gymbeam/cdk-template"
import * as cdk from "aws-cdk-lib"
import * as events from "aws-cdk-lib/aws-events"
import * as targets from "aws-cdk-lib/aws-events-targets"
import * as logs from "aws-cdk-lib/aws-logs"

export class EventBus extends BaseConstruct {
  public eventBus: events.IEventBus

  constructor(
    scope: IBaseConstruct,
    id: string,
    props: {
      eventBusName: string
      archiveRetention?: cdk.Duration
      logRetention?: logs.RetentionDays
      allowedAccounts?: string[]
    },
  ) {
    super(scope, id)

    const { eventBusName, logRetention, archiveRetention, allowedAccounts } =
      props

    const eventBus = new events.EventBus(this, "EventBus", {
      eventBusName,
    })

    this.eventBus = eventBus

    // Add cross-account permissions for rule creation and management
    if (allowedAccounts && allowedAccounts.length > 0) {
      new events.CfnEventBusPolicy(this, "CrossAccountReadPolicy", {
        eventBusName: eventBus.eventBusName,
        statementId: "AllowCrossAccountReadAccess",
        statement: {
          Sid: "AllowCrossAccountReadAccess",
          Effect: "Allow",
          Principal: {
            AWS: allowedAccounts.map(
              (account) => `arn:aws:iam::${account}:root`,
            ),
          },
          Action: [
            "events:DescribeRule",
            "events:ListRules",
            "events:ListTargetsByRule",
            "events:DescribeEventBus",
            "events:PutRule",
            "events:DeleteRule",
            "events:PutTargets",
            "events:RemoveTargets",
          ],
          Resource: [
            `arn:aws:events:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:event-bus/${eventBusName}`,
            `arn:aws:events:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:rule/${eventBusName}/*`,
          ],
        },
      })
    }

    eventBus.archive("Archive", {
      archiveName: `${eventBusName}-archive`,
      description: "Event bus archive",
      eventPattern: {
        account: [cdk.Stack.of(this).account],
      },
      retention: archiveRetention,
    })

    const eventLoggerRule = new events.Rule(this, "EventLoggerRule", {
      description: "Log all events",
      eventBus: this.eventBus,
      eventPattern: {
        region: [cdk.Stack.of(this).region],
      },
    })

    const logGroup = new logs.LogGroup(this, "EventLogGroup", {
      logGroupName: `/aws/events/${eventBusName}`,
      retention: logRetention,
    })

    eventLoggerRule.addTarget(new targets.CloudWatchLogGroup(logGroup))
  }
}
