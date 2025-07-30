import { getSsmParameters } from "@gymbeam/aws-services/ssm"
import assert from "assert"

import { type ChannelUrls, SlackService } from "./slack-service"

let pending: Promise<SlackService> | undefined

export async function getSlackService(): Promise<SlackService> {
  if (pending === undefined) {
    pending = createService()
  }

  const client = await pending
  return client
}

async function createService() {
  const stage = process.env.STAGE
  assert(stage, "Environment variable `STAGE` is not defined")

  const channelUrls: ChannelUrls = await getSsmParameters({
    general: `/gb-sync-service-sub/slack/hook/general/${stage}`,
  })

  return new SlackService(channelUrls)
}
