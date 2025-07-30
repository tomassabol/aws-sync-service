import { type S3Event } from "aws-lambda"

export function createS3EventFixture({
  name,
  key,
}: {
  name: string
  key: string
}): S3Event {
  return {
    Records: [
      {
        eventVersion: "2.1",
        eventSource: "aws:s3",
        awsRegion: "us-west-2",
        eventTime: "1970-01-01T00:00:00.000Z",
        eventName: "ObjectCreated:Put",
        userIdentity: {
          principalId: "EXAMPLE",
        },
        requestParameters: {
          sourceIPAddress: "10.10.10.12",
        },
        responseElements: {
          "x-amz-request-id": "EXAMPLE123456789",
          "x-amz-id-2":
            "EXAMPLE123/5678abcdefghijklmno/123456789abcdefghijklmno/123456789abcdefghijklmno",
        },
        s3: {
          s3SchemaVersion: "1.0",
          configurationId: "testConfigRule",
          bucket: {
            name,
            ownerIdentity: {
              principalId: "EXAMPLE",
            },
            arn: "arn:aws:s3:::example-bucket",
          },
          object: {
            key,
            size: 1024,
            eTag: "0123456789abcdef0123456789abcdef",
            sequencer: "0A1B2C3D4E5F678901",
          },
        },
      },
    ],
  }
}
