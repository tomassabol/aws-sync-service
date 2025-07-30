import {
  BaseConstruct,
  type IBaseConstruct,
  NodeJsFunctionSimplePattern,
} from "@gymbeam/cdk-template"
import { Duration } from "aws-cdk-lib"
import type * as events from "aws-cdk-lib/aws-events"
import * as iam from "aws-cdk-lib/aws-iam"
import type * as lambda from "aws-cdk-lib/aws-lambda"

import { defaultNodeJsFunctionSimplePatternArgs } from "../../defaults/default-lambda-function-props"

export class NotifyCompletionFunction extends BaseConstruct {
  public function: lambda.Function

  constructor(
    scope: IBaseConstruct,
    id: string,
    props: { eventBus: events.IEventBus },
  ) {
    super(scope, id)

    const { eventBus } = props

    const { lambdaFunction: notifyCompletionFunction } =
      new NodeJsFunctionSimplePattern(
        ...defaultNodeJsFunctionSimplePatternArgs(this, "notify-completion", {
          entry: "src/functions/stepfunctions/notify-completion.ts",
          description: "Send completion notifications",
          timeout: Duration.minutes(2),
          memorySize: 256,
          environment: {
            EVENT_BUS_NAME: eventBus.eventBusName,
          },
        }),
      )

    this.function = notifyCompletionFunction

    this.function.addToRolePolicy(
      new iam.PolicyStatement({
        resources: ["*"],
        actions: ["ssm:GetParameters"],
      }),
    )

    eventBus.grantPutEventsTo(notifyCompletionFunction)
  }
}
