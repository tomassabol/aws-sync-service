import {
  type AppContext,
  BaseStack,
  type StackConfig,
} from "@gymbeam/cdk-template"
import * as cdk from "aws-cdk-lib"
import * as logs from "aws-cdk-lib/aws-logs"

import { ALLOWED_ACCOUNTS } from "../constants"
import { ApiGateway } from "../constructs/api/api-gateway"
import { BackupBucket } from "../constructs/buckets/backup-bucket"
import { EventBus } from "../constructs/eventbridge/event-bus"
import { ListTablesFunction } from "../constructs/functions/api/list-tables-function"
import { DataExportFunction } from "../constructs/functions/schedule/data-export-function"
import { TablesToBackupParameter } from "../constructs/ssm/tables-to-backup-parameter"

export class AppStack extends BaseStack {
  constructor(appContext: AppContext, stackConfig: StackConfig) {
    super(appContext, stackConfig, {
      description: `Sync service - pub - [${appContext.stageName}]`,
    })

    /**
     * SSM Parameters
     */
    const { parameter: tablesToBackupParameter } = new TablesToBackupParameter(
      this,
      "tables-to-backup-parameter",
      {
        tables: ["gb-shipping-info-app-prod-deadlines-table"], // Default tables - can be updated via config
        allowedAccounts: ALLOWED_ACCOUNTS,
      },
    )

    /**
     * S3 Buckets
     */
    const { bucket: backupBucket } = new BackupBucket(this, "backup-bucket", {
      allowedAccounts: ALLOWED_ACCOUNTS,
    })

    /**
     * Event Bus
     */
    const { eventBus } = new EventBus(this, "event-bus", {
      eventBusName: `${appContext.projectName}-${appContext.stageName}-event-bus`,
      archiveRetention: cdk.Duration.days(7),
      logRetention: logs.RetentionDays.ONE_MONTH,
      allowedAccounts: ALLOWED_ACCOUNTS,
    })

    /**
     * Data Export Function
     */
    const { fn: dataExportFunction } = new DataExportFunction(
      this,
      "data-export-function",
      { eventBus, backupBucket },
    )

    tablesToBackupParameter.grantRead(dataExportFunction)

    /**
     * List Tables Function
     */
    const { fn: listTablesFunction } = new ListTablesFunction(
      this,
      "list-tables-function",
    )

    /**
     * API Gateway
     */
    const { api, apiKeySecret } = new ApiGateway(this, "api-gateway", {
      eventBus,
      listTablesFunction,
    })

    // Output the API Gateway URL
    new cdk.CfnOutput(this, "ApiGatewayUrl", {
      value: api.url,
      description: "API Gateway URL for triggering data export",
      exportName: `${appContext.projectName}-${appContext.stageName}-api-url`,
    })

    // Output the API key secret ARN
    new cdk.CfnOutput(this, "ApiKeySecretArn", {
      value: apiKeySecret.secretArn,
      description: "ARN of the secret containing the API key",
      exportName: `${appContext.projectName}-${appContext.stageName}-api-key-secret-arn`,
    })
  }
}
