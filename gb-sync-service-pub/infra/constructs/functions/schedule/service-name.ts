/**
 * Set X-Ray and metrics service name.
 *
 * NOTE:
 * Must be the first import in the lambda handler
 */

import { setServiceName } from "@gymbeam/aws-common/lambda/service-name"

setServiceName("data-export")
