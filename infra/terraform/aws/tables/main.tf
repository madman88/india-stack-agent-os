resource "aws_dynamodb_table" "proof_chain" {
  name         = "${var.name_prefix}-proof-chain"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "business_id"
  range_key    = "proof_id"

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  attribute {
    name = "business_id"
    type = "S"
  }

  attribute {
    name = "proof_id"
    type = "S"
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-proof-chain" })
}

resource "aws_dynamodb_table" "business_state" {
  name         = "${var.name_prefix}-business-state"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "business_id"

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  attribute {
    name = "business_id"
    type = "S"
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-business-state" })
}

resource "aws_dynamodb_table" "approvals" {
  name         = "${var.name_prefix}-approvals"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "business_id"
  range_key    = "approval_id"

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  attribute {
    name = "business_id"
    type = "S"
  }

  attribute {
    name = "approval_id"
    type = "S"
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-approvals" })
}

resource "aws_dynamodb_table" "event_ledger" {
  name         = "${var.name_prefix}-event-ledger"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "event_id"

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  attribute {
    name = "event_id"
    type = "S"
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-event-ledger" })
}

resource "aws_dynamodb_table" "aa_consents" {
  name         = "${var.name_prefix}-aa-consents"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "business_id"
  range_key    = "consent_id"

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  attribute {
    name = "business_id"
    type = "S"
  }

  attribute {
    name = "consent_id"
    type = "S"
  }

  global_secondary_index {
    name            = "consent-id-index"
    hash_key        = "consent_id"
    projection_type = "ALL"
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-aa-consents" })
}

resource "aws_dynamodb_table" "aa_sessions" {
  name         = "${var.name_prefix}-aa-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "business_id"
  range_key    = "session_id"

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  attribute {
    name = "business_id"
    type = "S"
  }

  attribute {
    name = "session_id"
    type = "S"
  }

  global_secondary_index {
    name            = "session-id-index"
    hash_key        = "session_id"
    projection_type = "ALL"
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-aa-sessions" })
}

resource "aws_dynamodb_table" "aa_audit_log" {
  name         = "${var.name_prefix}-aa-audit-log"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "business_id"
  range_key    = "entry_id"

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  attribute {
    name = "business_id"
    type = "S"
  }

  attribute {
    name = "entry_id"
    type = "S"
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-aa-audit-log" })
}
