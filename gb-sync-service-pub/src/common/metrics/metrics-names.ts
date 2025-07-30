export const MetricNames = {} as const

/**
 * Dimension names for metrics
 */

export const MetricDimensions = {} as const

export type MetricName = (typeof MetricNames)[keyof typeof MetricNames]
export type MetricDimension =
  (typeof MetricDimensions)[keyof typeof MetricDimensions]
