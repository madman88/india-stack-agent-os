# Production Infrastructure

This repo now has a production AWS Terraform stack under `infra/terraform/aws`.
It is intentionally separate from `infra/terraform/localstack`.

## What The AWS Stack Creates

- VPC with public and private subnets across two availability zones.
- Internet gateway, NAT gateway, and route tables.
- Public Application Load Balancer for `/v1/*` API traffic.
- ECS Fargate cluster, API service, and event worker service.
- ECR repository for the application image.
- DynamoDB tables for:
  - business state
  - proof chain
  - approvals
  - event ledger
  - AA consents
  - AA sessions
  - AA audit log
- SQS rail event queue plus dead-letter queue.
- S3 proof store bucket with versioning, encryption, and public access blocked.
- Secrets Manager secret for rail runtime credentials.
- CloudWatch log groups.
- IAM roles and least-privilege task policies for the app runtime.

The ECS service desired counts default to `0`, so the infrastructure can be
created before the production image and rail credentials are ready.

## AWS Access Needed

When an AWS account is available, use one of these:

- an AWS profile with admin permissions for the first apply, or
- an assumable deploy role with permissions for VPC, ECS, ECR, ELB, IAM,
  DynamoDB, SQS, S3, CloudWatch Logs, and Secrets Manager.

Recommended region is `ap-south-1` unless the pilot or provider callbacks need
another region.

## First Apply

Before using a real account, run local Terraform checks:

```bash
npm run tf:validate
```

For LocalStack apply validation, use `docs/terraform-local-validation.md`.

From the repo root:

```bash
cd infra/terraform/aws
terraform init
terraform plan \
  -var 'environment=prod' \
  -var 'api_desired_count=0' \
  -var 'worker_desired_count=0'
terraform apply \
  -var 'environment=prod' \
  -var 'api_desired_count=0' \
  -var 'worker_desired_count=0'
```

Important outputs:

- `ecr_repository_url`
- `api_http_url`
- `rail_runtime_secret_arn`
- `rail_events_queue_url`
- `dynamodb_tables`

## Build And Push The App Image

After the first apply creates ECR:

```bash
AWS_REGION=ap-south-1
ECR_REPOSITORY_URL="$(terraform output -raw ecr_repository_url)"

aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "${ECR_REPOSITORY_URL%/*}"

docker build -t india-stack-agent-os:prod .
docker tag india-stack-agent-os:prod "$ECR_REPOSITORY_URL:latest"
docker push "$ECR_REPOSITORY_URL:latest"
```

## Configure Runtime Secrets

Populate the `rail_runtime_secret_arn` secret before scaling tasks above zero.
Use JSON so ECS can inject individual keys:

```json
{
  "AA_BASE_URL": "https://fiu-sandbox.setu.co",
  "AA_ACCESS_TOKEN": "",
  "AA_PRODUCT_INSTANCE_ID": "",
  "GSTN_BASE_URL": "",
  "ONDC_BASE_URL": "",
  "OCEN_BASE_URL": "",
  "UPI_BASE_URL": "",
  "FINTERNET_BASE_URL": "",
  "DIGILOCKER_BASE_URL": "",
  "BBPS_BASE_URL": ""
}
```

For fixture-mode smoke testing, provider values may stay empty and services can
start with:

```bash
terraform apply \
  -var 'rail_adapter_mode=fixture' \
  -var 'api_desired_count=1' \
  -var 'worker_desired_count=1'
```

For Setu sandbox:

```bash
terraform apply \
  -var 'rail_adapter_mode=sandbox' \
  -var 'api_desired_count=1' \
  -var 'worker_desired_count=1'
```

## HTTPS And Callback Readiness

The stack can expose HTTP immediately through `api_http_url`.

Before using real provider callbacks, add:

1. ACM certificate in the same region.
2. DNS record pointing the chosen backend domain to the ALB.
3. `certificate_arn` variable on Terraform apply.
4. Provider callback URL using the HTTPS domain.
5. Callback authentication verification in the app before acting on callbacks.

Do not point Setu or other regulated providers at the HTTP URL.

## Validation After Deploy

Run:

```bash
API_BASE_URL="$(terraform output -raw api_http_url)" npm run test:contracts
API_BASE_URL="$(terraform output -raw api_http_url)" npm run test:db
```

For fixture mode, these prove the deployed API, DynamoDB tables, SQS queue, and
worker wiring are reachable. For sandbox mode, run rail-specific sandbox tests
only after credentials and test identities are configured.

## Cost Notes

This stack includes an ALB, NAT gateway, DynamoDB on-demand tables, SQS, S3, ECR,
CloudWatch logs, and ECS Fargate services. The NAT gateway and ALB have hourly
costs even when ECS desired counts are zero.
