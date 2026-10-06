locals {
  runtime_environment = [
    { name = "NODE_ENV", value = "production" },
    { name = "PORT", value = "8787" },
    { name = "AWS_REGION", value = var.aws_region },
    { name = "DB_DRIVER", value = "dynamodb" },
    { name = "RAIL_ADAPTER_MODE", value = var.rail_adapter_mode },
    { name = "PROOF_CHAIN_TABLE", value = module.tables.proof_chain_table_name },
    { name = "BUSINESS_STATE_TABLE", value = module.tables.business_state_table_name },
    { name = "APPROVALS_TABLE", value = module.tables.approvals_table_name },
    { name = "EVENT_LEDGER_TABLE", value = module.tables.event_ledger_table_name },
    { name = "AA_CONSENT_TABLE", value = module.tables.aa_consent_table_name },
    { name = "AA_SESSION_TABLE", value = module.tables.aa_session_table_name },
    { name = "AA_AUDIT_LOG_TABLE", value = module.tables.aa_audit_log_table_name },
    { name = "RAIL_EVENTS_QUEUE_URL", value = aws_sqs_queue.rail_events.url },
    { name = "PROOF_STORE_BUCKET", value = aws_s3_bucket.proof_store.bucket }
  ]

  runtime_secrets = [
    { name = "AA_BASE_URL", valueFrom = "${aws_secretsmanager_secret.rail_runtime.arn}:AA_BASE_URL::" },
    { name = "AA_ACCESS_TOKEN", valueFrom = "${aws_secretsmanager_secret.rail_runtime.arn}:AA_ACCESS_TOKEN::" },
    { name = "AA_PRODUCT_INSTANCE_ID", valueFrom = "${aws_secretsmanager_secret.rail_runtime.arn}:AA_PRODUCT_INSTANCE_ID::" },
    { name = "GSTN_BASE_URL", valueFrom = "${aws_secretsmanager_secret.rail_runtime.arn}:GSTN_BASE_URL::" },
    { name = "ONDC_BASE_URL", valueFrom = "${aws_secretsmanager_secret.rail_runtime.arn}:ONDC_BASE_URL::" },
    { name = "OCEN_BASE_URL", valueFrom = "${aws_secretsmanager_secret.rail_runtime.arn}:OCEN_BASE_URL::" },
    { name = "UPI_BASE_URL", valueFrom = "${aws_secretsmanager_secret.rail_runtime.arn}:UPI_BASE_URL::" },
    { name = "FINTERNET_BASE_URL", valueFrom = "${aws_secretsmanager_secret.rail_runtime.arn}:FINTERNET_BASE_URL::" },
    { name = "DIGILOCKER_BASE_URL", valueFrom = "${aws_secretsmanager_secret.rail_runtime.arn}:DIGILOCKER_BASE_URL::" },
    { name = "BBPS_BASE_URL", valueFrom = "${aws_secretsmanager_secret.rail_runtime.arn}:BBPS_BASE_URL::" }
  ]
}
