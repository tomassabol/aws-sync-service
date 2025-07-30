import {
  BaseConstruct,
  type IBaseConstruct,
  resourceName,
} from "@gymbeam/cdk-template"
import { Duration } from "aws-cdk-lib"
import * as events from "aws-cdk-lib/aws-events"
import * as targets from "aws-cdk-lib/aws-events-targets"
import type * as lambda from "aws-cdk-lib/aws-lambda"
import * as sfn from "aws-cdk-lib/aws-stepfunctions"
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks"

export class DataSyncStateMachine extends BaseConstruct {
  public stateMachine: sfn.StateMachine

  constructor(
    scope: IBaseConstruct,
    id: string,
    props: {
      eventBus: events.IEventBus
      processBackupFunction: lambda.IFunction
      notifyCompletionFunction: lambda.IFunction
      manageEventSourcesFunction: lambda.IFunction
    },
  ) {
    super(scope, id)

    const {
      eventBus,
      processBackupFunction,
      notifyCompletionFunction,
      manageEventSourcesFunction,
    } = props

    const processBackupTask = new tasks.LambdaInvoke(
      this,
      "ProcessBackupTask",
      {
        lambdaFunction: processBackupFunction,
        inputPath: "$",
        resultPath: "$.processResult",
      },
    )

    const disableEventSourcesTask = new tasks.LambdaInvoke(
      this,
      "DisableEventSourcesTask",
      {
        lambdaFunction: manageEventSourcesFunction,
        payload: sfn.TaskInput.fromObject({
          action: "disable",
        }),
        resultPath: "$.disabledEventSources",
      },
    )

    const enableEventSourcesAfterProcessing = new tasks.LambdaInvoke(
      this,
      "EnableEventSourcesAfterProcessing",
      {
        lambdaFunction: manageEventSourcesFunction,
        payload: sfn.TaskInput.fromObject({
          action: "enable",
        }),
        resultPath: "$.enabledEventSources",
      },
    )

    const enableEventSourcesAfterSkip = new tasks.LambdaInvoke(
      this,
      "EnableEventSourcesAfterSkip",
      {
        lambdaFunction: manageEventSourcesFunction,
        payload: sfn.TaskInput.fromObject({
          action: "enable",
        }),
        resultPath: "$.enabledEventSources",
      },
    )

    const notifySuccessTask = new tasks.LambdaInvoke(
      this,
      "NotifySuccessTask",
      {
        lambdaFunction: notifyCompletionFunction,
        payload: sfn.TaskInput.fromObject({
          status: "SUCCESS",
          "originalInput.$": "$$.Execution.Input",
          "executionArn.$": "$$.Execution.Name",
          "processResults.$": "$.processResults",
        }),
      },
    )

    const notifyFailureTask = new tasks.LambdaInvoke(
      this,
      "NotifyFailureTask",
      {
        lambdaFunction: notifyCompletionFunction,
        payload: sfn.TaskInput.fromObject({
          status: "FAILED",
          "originalInput.$": "$$.Execution.Input",
          "executionArn.$": "$$.Execution.Name",
          "error.$": "$.Error",
        }),
      },
    )

    const parseEventDetail = new sfn.Pass(this, "ParseEventDetail", {
      parameters: {
        "detail.$": "$.detail",
        "source.$": "$.source",
        "detail-type.$": "$['detail-type']",
      },
    })

    // Wait for backup export to complete (typically takes 5-15 minutes)
    const waitForExportCompletion = new sfn.Wait(
      this,
      "WaitForExportCompletion",
      {
        time: sfn.WaitTime.duration(Duration.minutes(15)),
      },
    )

    const processBackupsMap = new sfn.Map(this, "ProcessBackupsMap", {
      itemsPath: "$.detail.results",
      maxConcurrency: 3,
      resultPath: "$.processResults",
    })
    processBackupsMap.iterator(processBackupTask)

    // Ensure event sources are re-enabled even on failure - with retry logic
    const enableEventSourcesOnGlobalFailure = new tasks.LambdaInvoke(
      this,
      "EnableEventSourcesOnGlobalFailure",
      {
        lambdaFunction: manageEventSourcesFunction,
        payload: sfn.TaskInput.fromObject({
          action: "enable",
        }),
        resultPath: "$.enabledEventSourcesOnFailure",
      },
    ).addRetry({
      errors: ["States.ALL"],
      interval: Duration.seconds(2),
      maxAttempts: 3,
      backoffRate: 2,
    })

    // Add error handling to the enable tasks as well
    const enableEventSourcesAfterProcessingWithRetry =
      enableEventSourcesAfterProcessing.addRetry({
        errors: ["States.ALL"],
        interval: Duration.seconds(2),
        maxAttempts: 3,
        backoffRate: 2,
      })

    const enableEventSourcesAfterSkipWithRetry =
      enableEventSourcesAfterSkip.addRetry({
        errors: ["States.ALL"],
        interval: Duration.seconds(2),
        maxAttempts: 3,
        backoffRate: 2,
      })

    // Update the choice to use the error-handled version
    const hasBackupResultsWithErrorHandling = new sfn.Choice(
      this,
      "HasBackupResultsWithErrorHandling",
    )
      .when(
        sfn.Condition.isPresent("$.detail.results[0]"),
        processBackupsMap
          .next(enableEventSourcesAfterProcessingWithRetry)
          .next(notifySuccessTask),
      )
      .otherwise(
        new sfn.Pass(this, "NoBackupResultsWithErrorHandling", {
          result: sfn.Result.fromString("No backup results found"),
        })
          .next(enableEventSourcesAfterSkipWithRetry)
          .next(notifySuccessTask),
      )

    const mainWorkflowWithErrorHandling = new sfn.Parallel(
      this,
      "MainWorkflowWithErrorHandling",
      {
        resultPath: "$.workflowResult",
      },
    ).branch(
      parseEventDetail
        .next(waitForExportCompletion)
        .next(disableEventSourcesTask)
        .next(hasBackupResultsWithErrorHandling),
    )

    const definition = mainWorkflowWithErrorHandling.addCatch(
      enableEventSourcesOnGlobalFailure.next(notifyFailureTask),
      {
        errors: ["States.ALL"],
        resultPath: "$.Error",
      },
    )

    this.stateMachine = new sfn.StateMachine(this, "StateMachine", {
      stateMachineName: resourceName(this, "data-sync", "state-machine"),
      definition,
      timeout: Duration.hours(2),
      tracingEnabled: true,
    })

    processBackupFunction.grantInvoke(this.stateMachine.role)
    notifyCompletionFunction.grantInvoke(this.stateMachine.role)
    manageEventSourcesFunction.grantInvoke(this.stateMachine.role)

    const triggerRule = new events.Rule(this, "BackupInitiatedRule", {
      ruleName: resourceName(this, "table-backup-initiated", "rule"),
      eventBus,
      description:
        "Trigger data sync state machine when table backup is initiated",
      eventPattern: {
        source: ["gb-sync-service-pub"],
        detailType: ["table-backup-initiated"],
        detail: {
          $or: [
            { targetStages: [{ exists: false }] },
            { targetStages: [this.stageName] },
          ],
        },
      },
    })

    triggerRule.addTarget(
      new targets.SfnStateMachine(this.stateMachine, {
        input: events.RuleTargetInput.fromEventPath("$"),
      }),
    )
  }
}
