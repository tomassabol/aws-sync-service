# Sync service subscriber

## Quick start

### Slack notifications

The Slack notifications are sent to the `general` channel.

```sh
aws ssm put-parameter \
  --profile {AWS_PROFILE} \
  --name /gb-sync-service-sub/slack/hook/general/{STAGE} \
  --value "https://example.org" \
  --type String
```

## Installation

### Install dependencies

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
