import {
  BaseConstruct,
  type IBaseConstruct,
  NodeJsFunctionSimplePattern,
} from "@gymbeam/cdk-template"
import { Duration } from "aws-cdk-lib"
import * as iam from "aws-cdk-lib/aws-iam"
import type * as lambda from "aws-cdk-lib/aws-lambda"

import { defaultNodeJsFunctionSimplePatternArgs } from "../../defaults/default-lambda-function-props"

export class ListTablesFunction extends BaseConstruct {
  public fn: lambda.Function

  constructor(scope: IBaseConstruct, id: string) {
    super(scope, id)

    const { lambdaFunction } = new NodeJsFunctionSimplePattern(
      ...defaultNodeJsFunctionSimplePatternArgs(this, id, {
        entry: "src/functions/api/list-dynamodb-tables.ts",
        description: "List all DynamoDB tables in the account",
        timeout: Duration.seconds(30),
        memorySize: 256,
        warmUp: false,
      }),
    )

    this.fn = lambdaFunction

    // Grant permission to list DynamoDB tables
    this.fn.addToRolePolicy(
      new iam.PolicyStatement({
        resources: ["*"],
        actions: ["dynamodb:ListTables"],
      }),
    )
  }
}
