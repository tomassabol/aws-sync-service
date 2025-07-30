import {
  type APIGatewayProxyEvent,
  type Callback,
  type Context,
} from "aws-lambda"

export function createApiEventFixture(
  id: string,
  options: {
    httpMethod?: string
    path?: string
    body?: string
    query?: Record<string, string>
    requestId?: string
    awsRequestId?: string
  } = {},
): {
  event: APIGatewayProxyEvent
  context: Context
  callback: Callback
} {
  const {
    httpMethod = "POST",
    path = `/resource/${id}`,
    body = '{"test":"value"}',
    query = null,
    requestId = `request${id}`,
    awsRequestId = `awsrequest${id}`,
  } = options

  const event = {
    resource: "/{proxy+}",
    path,
    httpMethod,
    headers: {
      Accept: "*/*",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      "Content-Type": "application/json",
      Host: "elgio1ojgj.execute-api.eu-central-1.amazonaws.com",
    },
    multiValueHeaders: {
      Accept: ["*/*"],
      "Accept-Encoding": ["gzip, deflate, br"],
      "Cache-Control": ["no-cache"],
      "Content-Type": ["application/json"],
      Host: ["elgio1ojgj.execute-api.eu-central-1.amazonaws.com"],
    },
    queryStringParameters: query,
    multiValueQueryStringParameters: null,
    pathParameters: { proxy: path },
    stageVariables: null,
    requestContext: {
      resourceId: "1b7ve4",
      resourcePath: "/orders/{proxy+}",
      httpMethod: "POST",
      extendedRequestId: "AonuQEQqFiAFjbQ=",
      requestTime: "20/Feb/2023:11:01:59 +0000",
      path: "/rs/orders/12345/reservations",
      accountId: "055951622116",
      protocol: "HTTP/1.1",
      stage: "rs",
      domainPrefix: "elgio1ojgj",
      requestTimeEpoch: 1676890919783,
      requestId,
      identity: {
        cognitoIdentityPoolId: null,
        accountId: null,
        cognitoIdentityId: null,
        caller: null,
        sourceIp: "88.103.234.192",
        principalOrgId: null,
        accessKey: null,
        cognitoAuthenticationType: null,
        cognitoAuthenticationProvider: null,
        userArn: null,
        userAgent: "PostmanRuntime/7.30.1",
        user: null,
        apiKey: null,
        apiKeyId: null,
        clientCert: null,
      },
      domainName: "elgio1ojgj.execute-api.eu-central-1.amazonaws.com",
      apiId: "elgio1ojgj",
      authorizer: null,
    },
    body,
    isBase64Encoded: false,
  } satisfies APIGatewayProxyEvent

  const context = {
    callbackWaitsForEmptyEventLoop: true,
    functionVersion: "$LATEST",
    functionName: "gb-wms-app-v1-rs-reservationapi",
    memoryLimitInMB: "1024",
    logGroupName: "/aws/lambda/gb-wms-app-v1-rs-reservationapi",
    logStreamName: "2023/02/20/[$LATEST]c52b0c08b5254efab5aa43b8b478270b",
    invokedFunctionArn:
      "arn:aws:lambda:eu-central-1:055951622116:function:gb-wms-app-v1-rs-reservationapi",
    awsRequestId,
    getRemainingTimeInMillis: jest.fn(),
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
  } satisfies Context

  const callback = () => {
    throw new Error("Callback mock not supported")
  }
  return { event, context, callback }
}

export function createApiResponseFixture(statusCode: number, body: object) {
  return {
    body: JSON.stringify(body),
    statusCode,
    isBase64Encoded: false,
    multiValueHeaders: {
      "access-control-allow-headers": [
        "Content-Type, Authorization, Content-Length, X-Requested-With",
      ],
      "access-control-allow-methods": ["GET, PUT, POST, DELETE, OPTIONS"],
      "access-control-allow-origin": ["*"],
      "content-type": ["application/json"],
    },
  }
}
