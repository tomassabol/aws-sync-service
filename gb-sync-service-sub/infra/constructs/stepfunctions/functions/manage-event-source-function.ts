import {
  BaseConstruct,
  type IBaseConstruct,
  NodeJsFunctionSimplePattern,
} from "@gymbeam/cdk-template"
import { Duration } from "aws-cdk-lib"
import * as iam from "aws-cdk-lib/aws-iam"
import type * as lambda from "aws-cdk-lib/aws-lambda"

import { defaultNodeJsFunctionSimplePatternArgs } from "../../defaults/default-lambda-function-props"

export class ManageEventSourceFunction extends BaseConstruct {
  public function: lambda.Function

  constructor(scope: IBaseConstruct, id: string) {
    super(scope, id)

    const { lambdaFunction: manageEventSourcesFunction } =
      new NodeJsFunctionSimplePattern(
        ...defaultNodeJsFunctionSimplePatternArgs(
          this,
          "manage-event-sources",
          {
            entry: "src/functions/stepfunctions/manage-event-sources.ts",
            description: "Disable/enable Lambda event source mappings",
            timeout: Duration.minutes(5),
            memorySize: 512,
          },
        ),
      )

    this.function = manageEventSourcesFunction

    this.function.addToRolePolicy(
      new iam.PolicyStatement({
        resources: ["*"],
        actions: [
          "lambda:ListEventSourceMappings",
          "lambda:UpdateEventSourceMapping",
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
