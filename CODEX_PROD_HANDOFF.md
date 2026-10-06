# Codex Production Handoff

Last updated: 2026-10-05 America/Los_Angeles.

This file is for future Codex sessions. It records the current AWS production state and the remaining steps before treating this as production.

## Current State

- Git branch: `main`
- Latest pushed commit: `2e36133 Use ECS task role credentials in AWS runtime`
- AWS account used: `453995432066`
- AWS region: `ap-south-1`
- Terraform stack: `infra/terraform/aws`
- Deployed API URL:
  - `http://india-stack-agent-os-prod-api-1428179298.ap-south-1.elb.amazonaws.com`
- ECR image deployed:
  - `453995432066.dkr.ecr.ap-south-1.amazonaws.com/india-stack-agent-os-prod:2e36133`
- ECS cluster:
  - `india-stack-agent-os-prod`
- ECS services:
  - `india-stack-agent-os-prod-api`, desired `1`, running `1`
  - `india-stack-agent-os-prod-worker`, desired `1`, running `1`
- Runtime mode:
  - `rail_adapter_mode=fixture`
- HTTPS:
  - Not enabled yet. `api_https_enabled=false`

## What Has Been Validated

Local repo validation passed:

```bash
npm run tf:validate
npm test
npm audit --omit=dev
git diff --check
```

Live AWS validation passed against the ALB:

```bash
API_BASE_URL=http://india-stack-agent-os-prod-api-1428179298.ap-south-1.elb.amazonaws.com npm run test:contracts
API_BASE_URL=http://india-stack-agent-os-prod-api-1428179298.ap-south-1.elb.amazonaws.com npm run test:db
API_BASE_URL=http://india-stack-agent-os-prod-api-1428179298.ap-south-1.elb.amazonaws.com npm run test:events
```

Health check result:

```json
{"status":"ok","service":"mock-api","db":"dynamodb","eventBus":"sqs"}
```

## Critical Security Follow-Up

The initial deployment used a root access key from:

```text
/mnt/c/Users/2025/Downloads/rootkey.csv
```

Do not keep using this for production work.

Remaining security bootstrap:

1. Create an IAM deploy role or IAM user for Terraform and image deploys.
2. Grant only the required permissions for VPC, ECS, ECR, ELBv2, IAM, DynamoDB, SQS, S3, CloudWatch Logs, and Secrets Manager.
3. Configure local AWS CLI with a non-root profile, for example `india-stack-prod`.
4. Delete the root access key from AWS IAM root credentials.
5. Delete the local CSV after confirming the non-root credentials work.

Future Codex sessions should not print, commit, or copy AWS secret values.

## Remaining Steps To Production

1. Move Terraform state off local disk.
   - Create an S3 backend bucket and DynamoDB lock table.
   - Migrate `infra/terraform/aws/terraform.tfstate` to the remote backend.
   - Document the backend in `docs/production-infrastructure.md`.

2. Replace root credentials with deploy credentials.
   - Use a dedicated IAM role/user.
   - Re-run:

   ```bash
   AWS_PROFILE=india-stack-prod aws sts get-caller-identity
   AWS_PROFILE=india-stack-prod terraform -chdir=infra/terraform/aws plan \
     -var 'environment=prod' \
     -var 'rail_adapter_mode=fixture' \
     -var 'api_desired_count=1' \
     -var 'worker_desired_count=1'
   ```

3. Add HTTPS.
   - Choose the API domain.
   - Create/validate an ACM certificate in `ap-south-1`.
   - Add DNS alias to the ALB.
   - Apply Terraform with `certificate_arn`.
   - Move provider callback URLs to HTTPS only.

4. Lock down public HTTP.
   - After HTTPS works, redirect HTTP to HTTPS or remove public HTTP if callbacks and clients no longer need it.
   - Update ALB listener Terraform accordingly.

5. Configure real rail credentials.
   - Current secret:
     - `arn:aws:secretsmanager:ap-south-1:453995432066:secret:india-stack-agent-os-prod/rail-runtime-lhyFPx`
   - Populate real sandbox/prod values for Setu AA and other rails.
   - Keep `fixture` until sandbox credentials are confirmed.

6. Run sandbox-mode deployment.
   - Apply:

   ```bash
   terraform -chdir=infra/terraform/aws apply \
     -var 'environment=prod' \
     -var 'rail_adapter_mode=sandbox' \
     -var 'api_desired_count=1' \
     -var 'worker_desired_count=1'
   ```

   - Then run Setu AA sandbox checks and API smoke tests.

7. Add CI/CD guardrails.
   - CI should run:

   ```bash
   npm run tf:validate
   npm test
   npm audit --omit=dev
   docker build -t india-stack-agent-os:ci .
   ```

   - Add a gated Terraform plan job for `infra/terraform/aws`.
   - Do not auto-apply production from CI until credentials, state backend, and approvals are in place.

8. Add IaC policy checks.
   - Add Checkov or OPA/Conftest.
   - Enforce:
     - no public S3
     - encrypted storage
     - no wildcard app task permissions beyond intentional scope
     - no plaintext secrets
     - HTTPS required before real rail callbacks

9. Add observability.
   - CloudWatch alarms for:
     - ECS service running count below desired
     - ALB 5xx
     - target group unhealthy hosts
     - SQS DLQ messages visible
     - worker errors in logs
   - Add dashboards for API latency, target health, queue depth, and task restarts.

10. Add backup and retention decisions.
    - DynamoDB PITR is already enabled.
    - Decide S3 proof-store lifecycle/retention policy.
    - Decide CloudWatch log retention beyond the current 30 days.

11. Review cost posture.
    - The live stack includes an ALB and NAT Gateway, which incur hourly cost.
    - If pausing work, scale ECS to zero or destroy the stack.
    - To scale down while keeping infra:

    ```bash
    terraform -chdir=infra/terraform/aws apply \
      -var 'environment=prod' \
      -var 'api_desired_count=0' \
      -var 'worker_desired_count=0'
    ```

12. Production readiness review.
    - Confirm HTTPS.
    - Confirm non-root credentials.
    - Confirm remote Terraform state.
    - Confirm sandbox rail credentials and callbacks.
    - Confirm monitoring and rollback procedure.
    - Confirm data retention and deletion policy.

## Useful Commands

Load root CSV credentials only if no safer credentials exist:

```bash
creds_file=/mnt/c/Users/2025/Downloads/rootkey.csv
export AWS_ACCESS_KEY_ID="$(awk -F, 'NR==2 { gsub(/\r/, "", $1); print $1 }' "$creds_file")"
export AWS_SECRET_ACCESS_KEY="$(awk -F, 'NR==2 { gsub(/\r/, "", $2); print $2 }' "$creds_file")"
export AWS_REGION=ap-south-1
export AWS_DEFAULT_REGION=ap-south-1
```

Check current AWS identity:

```bash
aws sts get-caller-identity
```

Check ECS services:

```bash
cluster="$(terraform -chdir=infra/terraform/aws output -raw ecs_cluster_name)"
api_service="$(terraform -chdir=infra/terraform/aws output -raw api_service_name)"
worker_service="$(terraform -chdir=infra/terraform/aws output -raw worker_service_name)"
aws ecs describe-services \
  --cluster "$cluster" \
  --services "$api_service" "$worker_service" \
  --query 'services[].{name:serviceName,desired:desiredCount,running:runningCount,pending:pendingCount}'
```

Run live smoke tests:

```bash
export API_BASE_URL="$(terraform -chdir=infra/terraform/aws output -raw api_http_url)"
npm run test:contracts
npm run test:db
npm run test:events
```

