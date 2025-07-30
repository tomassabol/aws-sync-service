# Sync service publisher

## Quick start

### Tables to backup

The tables to backup are now managed via Infrastructure as Code in the CDK stack. The default tables are configured in `infra/stacks/app-stack.ts`.

To update the tables for a specific stage, modify the `tables` array in the `TablesToBackupParameter` construct:

```typescript
new TablesToBackupParameter(this, "tables-to-backup-parameter", {
  tables: ["your-table-1", "your-table-2", "your-table-3"],
  allowedAccounts: ALLOWED_ACCOUNTS,
})
```

You can also update tables to backup manually in AWS Console (SSM Parameter Store).

#### Cross-account access

The SSM parameter is automatically configured for cross-account read access. Other AWS accounts can access the parameter by assuming the cross-account role:

```sh
# From another AWS account, assume the cross-account role
aws sts assume-role \
  --role-arn "arn:aws:iam::<ACCOUNT-ID>:role/gb-sync-service-pub-<STAGE>-ssm-read-role" \
  --role-session-name "ssm-parameter-access"

# Then use the temporary credentials to read the parameter
aws ssm get-parameter \
  --name "/gb-sync-service-pub/data-export/tables-to-backup/<STAGE>" \
  --region <AWS-REGION>
```

### Slack notifications

The Slack notifications are sent to the `general` channel.

```sh
aws ssm put-parameter \
  --profile {AWS_PROFILE} \
  --name /gb-sync-service-pub/slack/hook/general/{STAGE} \
  --value "https://example.org" \
  --type String
```

## Installation

```
npm install
```

## Deployment

Application

```
./scripts/cdk.sh deploy app --profile <AWS-PROFILE> --stage <STAGE>
```

Deployment pipeline

```
./scripts/cdk.sh deploy app-pipeline --profile <AWS-PROFILE> --stage <STAGE>
```
