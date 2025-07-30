import {
  type AttributeDefinition,
  type BillingMode,
  type KeySchemaElement,
} from "@aws-sdk/client-dynamodb"

export type TableStructure = {
  attributeDefinitions: AttributeDefinition[]
  keySchema: KeySchemaElement[]
  billingMode: BillingMode
}

export type BackupResult = {
  tableName: string
  status: string
  exportArn: string
  s3Prefix: string
  timestamp: string
}

export type BackupEventDetail = {
  totalTables: number
  successful: number
  failed: number
  results: BackupResult[]
  stage: string
  targetStages?: string[]
}

export type BackupFile = {
  tableName: string
  s3Prefix: string
  exportArn: string
  timestamp: string
}

export type ProcessResult = {
  tableName: string
  status: "success" | "failed" | "in_progress"
  message: string
  importArn?: string
  error?: string
}

export type NotificationEvent = {
  status: "SUCCESS" | "FAILED"
  originalInput?: unknown
  executionArn?: string
  error?: unknown
  processResults?: unknown[]
}

// Event Source Management

export type ManageEventSourcesInput = {
  action: "disable" | "enable"
}

export type EventSourceMapping = {
  UUID: string
  State: string
}

export type ManageEventSourcesOutput = {
  action: string
  processedMappings: EventSourceMapping[]
  totalMappings: number
}
