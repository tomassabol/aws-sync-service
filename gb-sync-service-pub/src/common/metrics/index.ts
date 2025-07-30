/* eslint-disable import/no-unresolved */
import { Metrics } from "@aws-lambda-powertools/metrics"
import { type MetricUnit } from "@aws-lambda-powertools/metrics/types"
import { getServiceName } from "@gymbeam/aws-common/lambda/service-name"

import { type MetricDimension, type MetricName } from "./metrics-names"

export const metrics = createMetrics()

export function createMetrics(): Metrics | undefined {
  if (process.env.STAGE === "prod" || process.env.STAGE === "test") {
    return new Metrics({
      namespace: `gb-sync-service-pub-${process.env.STAGE}`,
      serviceName: getServiceName(),
    })
  }
}

export function addMetric(
  name: MetricName,
  unit: MetricUnit = "Count",
  value = 1,
) {
  metrics?.addMetric(name, unit, value)
}

/**
 * Add metrics with one dimension
 */

export function addDimensionalMetric(
  dimensionName: MetricDimension,
  dimensionValue: string,
  name: MetricName,
  unit: MetricUnit = "Count",
  value = 1,
) {
  if (metrics) {
    const singleMetric = metrics.singleMetric()
    singleMetric.addDimension(dimensionName, dimensionValue)
    singleMetric.addMetric(name, unit, value)
  }
}

export function publishStoredMetrics() {
  metrics?.publishStoredMetrics()
}
