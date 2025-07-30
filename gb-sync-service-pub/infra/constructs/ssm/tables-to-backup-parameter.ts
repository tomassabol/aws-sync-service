import { BaseConstruct, type IBaseConstruct } from "@gymbeam/cdk-template"
import * as iam from "aws-cdk-lib/aws-iam"
import * as ssm from "aws-cdk-lib/aws-ssm"

export class TablesToBackupParameter extends BaseConstruct {
  public parameter: ssm.StringParameter
  public crossAccountRole?: iam.Role

  constructor(
    scope: IBaseConstruct,
    id: string,
    props: {
      tables: string[]
      allowedAccounts?: string[]
    },
  ) {
    super(scope, id)

    const { tables, allowedAccounts } = props

    this.parameter = new ssm.StringParameter(this, "Parameter", {
      parameterName: `/gb-sync-service-pub/data-export/tables-to-backup/${this.stageName}`,
      stringValue: tables.join(","),
      description: `List of tables to backup for ${this.stageName} stage`,
      tier: ssm.ParameterTier.STANDARD,
    })

    if (allowedAccounts && allowedAccounts.length > 0) {
      this.crossAccountRole = new iam.Role(this, "CrossAccountReadRole", {
        roleName: `gb-sync-service-pub-${this.stageName}-ssm-read-role`,
        description: `Cross-account read access role for SSM parameters in ${this.stageName} stage`,
        assumedBy: new iam.CompositePrincipal(
          ...allowedAccounts.map(
            (accountId) => new iam.AccountPrincipal(accountId),
          ),
        ),
        inlinePolicies: {
          SSMParameterReadAccess: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                sid: "AllowSSMParameterRead",
                effect: iam.Effect.ALLOW,
                actions: [
                  "ssm:GetParameter",
                  "ssm:GetParameters",
                  "ssm:GetParametersByPath",
                  "ssm:DescribeParameters",
                ],
                resources: [this.parameter.parameterArn],
              }),
            ],
          }),
        },
      })
    }
  }

  public grantRead(grantee: iam.IGrantable): iam.Grant {
    return iam.Grant.addToPrincipal({
      grantee,
      actions: ["ssm:GetParameter", "ssm:GetParameters"],
      resourceArns: [this.parameter.parameterArn],
    })
  }
}
