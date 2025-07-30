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
      username: "Sync Service - sub",
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
    message.icon_emoji = ":recycle:"

    const tablesList =
      tablesToBackup.length > 0
        ? tablesToBackup.map((table) => `• ${table}`).join("\n")
        : "No tables to process"

    message.attachments = [
      {
        color: "#0066cc",
        fields: [
          {
            title: `Data Sync Started (${process.env.STAGE})`,
            value: `Initiating synchronization for ${tablesToBackup.length} tables`,
          },
          {
            title: "Tables to Sync",
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
    message.icon_emoji = ":heavy_check_mark:"

    const tablesList =
      successfulTables.length > 0
        ? successfulTables.map((table) => `• ${table}`).join("\n")
        : "No tables processed"

    const summary = `Successfully synchronized ${successfulTables.length}/${totalTables} tables`

    message.attachments = [
      {
        color: "#36a64f",
        fields: [
          {
            title: `Data Sync Completed Successfully (${process.env.STAGE})`,
            value: summary,
          },
          {
            title: "Synchronized Tables",
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
    message.icon_emoji = ":exclamation:"

    const totalTables = successfulTables.length + failedTables.length
    const summary = `Data sync completed with ${failedTables.length} failures out of ${totalTables} tables`

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
            title: `Data Sync Completed with Errors (${process.env.STAGE})`,
            value: summary,
          },
          {
            title: "Successfully Synchronized",
            value: successList,
            short: true,
          },
          {
            title: "Failed to Synchronize",
            value: failureList,
            short: true,
          },
        ],
      },
    ]

    await this.sendToChannel({ channel: "general", message })
  }

  public async sendStreamDisablingNotification() {
    const message = this.createBaseMessage()
    message.icon_emoji = ":stop_sign:"

    message.attachments = [
      {
        color: "#ffa500",
        fields: [
          {
            title: `Disabling DynamoDB Streams (${process.env.STAGE})`,
            value:
              "Temporarily disabling DynamoDB Stream event triggers. Initiating data sync.",
          },
        ],
      },
    ]

    await this.sendToChannel({ channel: "general", message })
  }

  public async sendStreamEnablingNotification() {
    const message = this.createBaseMessage()
    message.icon_emoji = ":arrow_forward:"

    message.attachments = [
      {
        color: "#36a64f",
        fields: [
          {
            title: `Enabling DynamoDB Streams (${process.env.STAGE})`,
            value:
              "Re-enabling DynamoDB Stream event triggers. Data sync is completed.",
          },
        ],
      },
    ]

    await this.sendToChannel({ channel: "general", message })
  }

  public async sendDataImportInitiatedNotification({
    tableName,
    recordCount,
  }: {
    tableName: string
    recordCount: number
  }) {
    const message = this.createBaseMessage()
    message.icon_emoji = ":inbox_tray:"

    message.attachments = [
      {
        color: "#0066cc",
        fields: [
          {
            title: `Data Import Initiated (${process.env.STAGE})`,
            value: `Starting data import for table: ${tableName}`,
          },
          {
            title: "Records to Import",
            value: `${recordCount.toLocaleString()} records will be imported`,
            short: false,
          },
        ],
      },
    ]

    await this.sendToChannel({ channel: "general", message })
  }

  public async sendDataImportCompletedNotification() {
    const message = this.createBaseMessage()
    message.icon_emoji = ":heavy_check_mark:"

    message.attachments = [
      {
        color: "#36a64f",
        fields: [
          {
            title: `Data Import Completed (${process.env.STAGE})`,
            value: "Data import completed successfully",
          },
        ],
      },
    ]

    await this.sendToChannel({ channel: "general", message })
  }

  public async sendDataImportErrorNotification() {
    const message = this.createBaseMessage()
    message.icon_emoji = ":warning:"

    message.attachments = [
      {
        color: "#ff0000",
        fields: [
          {
            title: `Data Import Error (${process.env.STAGE})`,
            value: `Error importing data`,
          },
        ],
      },
    ]

    await this.sendToChannel({ channel: "general", message })
  }
}
