output "proof_chain_table_name" {
  value = aws_dynamodb_table.proof_chain.name
}

output "business_state_table_name" {
  value = aws_dynamodb_table.business_state.name
}

output "approvals_table_name" {
  value = aws_dynamodb_table.approvals.name
}

output "event_ledger_table_name" {
  value = aws_dynamodb_table.event_ledger.name
}

output "aa_consent_table_name" {
  value = aws_dynamodb_table.aa_consents.name
}

output "aa_session_table_name" {
  value = aws_dynamodb_table.aa_sessions.name
}

output "aa_audit_log_table_name" {
  value = aws_dynamodb_table.aa_audit_log.name
}

output "table_arns" {
  value = [
    aws_dynamodb_table.proof_chain.arn,
    aws_dynamodb_table.business_state.arn,
    aws_dynamodb_table.approvals.arn,
    aws_dynamodb_table.event_ledger.arn,
    aws_dynamodb_table.aa_consents.arn,
    aws_dynamodb_table.aa_sessions.arn,
    aws_dynamodb_table.aa_audit_log.arn
  ]
}

output "index_arns" {
  value = [
    "${aws_dynamodb_table.aa_consents.arn}/index/consent-id-index",
    "${aws_dynamodb_table.aa_sessions.arn}/index/session-id-index"
  ]
}
