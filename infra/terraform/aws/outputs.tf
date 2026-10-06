output "api_load_balancer_dns_name" {
  value = aws_lb.api.dns_name
}

output "api_http_url" {
  value = "http://${aws_lb.api.dns_name}"
}

output "api_https_enabled" {
  value = var.certificate_arn != null
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}

output "api_service_name" {
  value = aws_ecs_service.api.name
}

output "worker_service_name" {
  value = aws_ecs_service.worker.name
}

output "rail_events_queue_url" {
  value = aws_sqs_queue.rail_events.url
}

output "rail_events_dlq_url" {
  value = aws_sqs_queue.rail_events_dlq.url
}

output "proof_store_bucket" {
  value = aws_s3_bucket.proof_store.bucket
}

output "rail_runtime_secret_arn" {
  value = aws_secretsmanager_secret.rail_runtime.arn
}

output "dynamodb_tables" {
  value = {
    proof_chain    = module.tables.proof_chain_table_name
    business_state = module.tables.business_state_table_name
    approvals      = module.tables.approvals_table_name
    event_ledger   = module.tables.event_ledger_table_name
    aa_consents    = module.tables.aa_consent_table_name
    aa_sessions    = module.tables.aa_session_table_name
    aa_audit_log   = module.tables.aa_audit_log_table_name
  }
}
