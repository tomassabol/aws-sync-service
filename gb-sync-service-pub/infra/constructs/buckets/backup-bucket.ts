import { BaseConstruct, type IBaseConstruct } from "@gymbeam/cdk-template"
import * as cdk from "aws-cdk-lib"
import * as iam from "aws-cdk-lib/aws-iam"
import * as s3 from "aws-cdk-lib/aws-s3"

export class BackupBucket extends BaseConstruct {
  public bucket: s3.Bucket

  constructor(
    scope: IBaseConstruct,
    id: string,
    props?: {
      allowedAccounts?: string[]
    },
  ) {
    super(scope, id)

    this.bucket = new s3.Bucket(this, id, {
      bucketName: `gb-sync-service-pub-${this.stageName}-backup-bucket`,
      lifecycleRules: [
        {
          id: "BackupDataLifecycle",
          enabled: true,
          prefix: "table-exports/",
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER_INSTANT_RETRIEVAL,
              transitionAfter: cdk.Duration.days(60),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(150),
            },
            {
              storageClass: s3.StorageClass.DEEP_ARCHIVE,
              transitionAfter: cdk.Duration.days(240),
            },
          ],
        },
      ],
    })

    // Grant cross-account read access if allowed accounts are specified
    if (props?.allowedAccounts && props.allowedAccounts.length > 0) {
      this.bucket.addToResourcePolicy(
        new iam.PolicyStatement({
          sid: "AllowCrossAccountReadAccess",
          effect: iam.Effect.ALLOW,
          principals: props.allowedAccounts.map(
            (accountId) => new iam.AccountPrincipal(accountId),
          ),
          actions: [
            "s3:GetObject",
            "s3:GetObjectVersion",
            "s3:ListBucket",
            "s3:GetBucketLocation",
            "s3:RestoreObject",
          ],
          resources: [this.bucket.bucketArn, `${this.bucket.bucketArn}/*`],
        }),
      )
    }
  }
}
