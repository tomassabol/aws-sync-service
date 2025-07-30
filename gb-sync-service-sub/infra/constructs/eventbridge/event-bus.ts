import { BaseConstruct, type IBaseConstruct } from "@gymbeam/cdk-template"
import * as cdk from "aws-cdk-lib"
import * as events from "aws-cdk-lib/aws-events"

export class EventBus extends BaseConstruct {
  public eventBus: events.IEventBus

  constructor(scope: IBaseConstruct, id: string) {
    super(scope, id)

    const eventBus = events.EventBus.fromEventBusName(
      this,
      "EventBus",
      `gb-event-bus-${this.stageName}`,
    )

    this.eventBus = eventBus

    new cdk.CfnOutput(this, "EventBusName", {
      value: this.eventBus.eventBusName,
    }).overrideLogicalId("EventBusName")
  }
}
