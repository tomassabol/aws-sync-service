import {
  IncomingWebhook,
  type IncomingWebhookSendArguments,
} from "@slack/webhook"

const channelNames = ["general"] as const
type ChannelName = (typeof channelNames)[number]

export type ChannelUrls = Record<ChannelName, string>
type ChannelWebhooks = Partial<Record<ChannelName, IncomingWebhook>>

export class SlackService {
  protected channels: ChannelWebhooks = {}

  constructor(urls: ChannelUrls) {
    Object.entries(urls).forEach(([key, url]) => {
      this.channels[key as ChannelName] = new IncomingWebhook(url)
    })
  }

  private createBaseMessage(): IncomingWebhookSendArguments {
    return {
      username: "Sync Service - pub",
    }
  }

  private async sendToChannel({
    channel,
    message,
  }: {
    channel: ChannelName
    message: IncomingWebhookSendArguments
  }) {
    await this.channels[channel]?.send(message)
  }

  public async sendDataSyncStartedNotification({
    tablesToBackup,
  }: {
    tablesToBackup: string[]
  }) {
    const message = this.createBaseMessage()
    message.icon_emoji = ":arrows_clockwise:"

    const tablesList =
      tablesToBackup.length > 0
        ? tablesToBackup.map((table) => `• ${table}`).join("\n")
        : "No tables to process"

    message.attachments = [
      {
        color: "#0066cc",
        fields: [
          {
            title: "Data Backup Initiated",
            value: `Initiating backup for ${tablesToBackup.length} tables`,
          },
          {
            title: "Tables to Backup",
            value: tablesList,
            short: false,
          },
        ],
      },
    ]

    await this.sendToChannel({ channel: "general", message })
  }

  public async sendDataSyncSuccessNotification({
    successfulTables,
    totalTables,
  }: {
    successfulTables: string[]
    totalTables: number
  }) {
    const message = this.createBaseMessage()
    message.icon_emoji = ":white_check_mark:"

    const tablesList =
      successfulTables.length > 0
        ? successfulTables.map((table) => `• ${table}`).join("\n")
        : "No tables processed"

    const summary = `Successfully backed up ${successfulTables.length}/${totalTables} tables`

    message.attachments = [
      {
        color: "#36a64f",
        fields: [
          {
            title: "Data Backup Completed Successfully",
            value: summary,
          },
          {
            title: "Backed Up Tables",
            value: tablesList,
            short: false,
          },
        ],
      },
    ]

    await this.sendToChannel({ channel: "general", message })
  }

  public async sendDataSyncFailureNotification({
    successfulTables,
    failedTables,
  }: {
    successfulTables: string[]
    failedTables: string[]
  }) {
    const message = this.createBaseMessage()
    message.icon_emoji = ":x:"

    const totalTables = successfulTables.length + failedTables.length
    const summary = `Data backup completed with ${failedTables.length} failures out of ${totalTables} tables`

    const successList =
      successfulTables.length > 0
        ? successfulTables.map((table) => `• ${table}`).join("\n")
        : "None"

    const failureList =
      failedTables.length > 0
        ? failedTables.map((table) => `• ${table}`).join("\n")
        : "None"

    message.attachments = [
      {
        color: "#ff0000",
        fields: [
          {
            title: "Data Backup Completed with Errors",
            value: summary,
          },
          {
            title: "Successfully Backed Up",
            value: successList,
            short: true,
          },
          {
            title: "Failed to Back Up",
            value: failureList,
            short: true,
          },
        ],
      },
    ]

    await this.sendToChannel({ channel: "general", message })
  }
}
