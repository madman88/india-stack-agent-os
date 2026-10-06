# Terraform Local Validation

There are two Terraform stacks:

- `infra/terraform/localstack`: LocalStack-backed parity resources.
- `infra/terraform/aws`: production AWS resources.

## Fast Static Validation

Run this after Terraform edits:

```bash
npm run tf:validate
```

This runs:

- `terraform init -backend=false`
- `terraform fmt -check`
- `terraform validate`

for both LocalStack and AWS stacks.

This catches syntax errors, provider schema errors, invalid references, and
module wiring mistakes. It does not prove that AWS will accept every production
resource at apply time.

## LocalStack Apply Validation

The LocalStack stack is the one intended to be applied locally:

```bash
docker compose up -d localstack
terraform -chdir=infra/terraform/localstack init
terraform -chdir=infra/terraform/localstack apply
DB_DRIVER=dynamodb npm run db:seed
docker compose up -d mock-rails mock-api worker
API_BASE_URL=http://localhost:8787 npm run test:db
API_BASE_URL=http://localhost:8787 npm run test:events
```

This validates the app's AWS-shaped service boundary:

- DynamoDB table shape and repository access.
- SQS event publishing and worker consumption.
- Secrets Manager resource creation.
- S3 proof bucket creation.

## Production AWS Stack Boundary

`infra/terraform/aws` includes production runtime resources that are not a
faithful LocalStack Community target:

- ECS Fargate services and task definitions.
- Application Load Balancer listeners and target groups.
- NAT gateway and real VPC routing.
- ECR repository behavior.
- IAM behavior as enforced by AWS.

For this stack, local validation should be:

```bash
terraform -chdir=infra/terraform/aws init -backend=false
terraform -chdir=infra/terraform/aws fmt -check
terraform -chdir=infra/terraform/aws validate
```

Then, once an AWS account is available:

```bash
terraform -chdir=infra/terraform/aws plan \
  -var 'api_desired_count=0' \
  -var 'worker_desired_count=0'
```

Keep desired counts at zero for the first apply. After the first apply, build
and push the container image to ECR, populate the runtime secret, then scale the
API and worker services.

## Why Not Apply The Production Stack To LocalStack?

Applying `infra/terraform/aws` to LocalStack would not prove production
readiness unless the LocalStack environment supports ECS, ELBv2, NAT gateways,
ECR, IAM, and CloudWatch Logs with behavior close to AWS.

The reliable local strategy is:

1. Apply `infra/terraform/localstack`.
2. Run app DB/event/API smokes against LocalStack.
3. Run `terraform validate` for `infra/terraform/aws`.
4. Run the first real `terraform plan` in the target AWS account before apply.
