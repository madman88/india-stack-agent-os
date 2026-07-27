terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region                      = "ap-south-1"
  access_key                  = "test"
  secret_key                  = "test"
  s3_use_path_style           = true
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    dynamodb       = "http://localhost:4566"
    s3             = "http://localhost:4566"
    secretsmanager = "http://localhost:4566"
    sqs            = "http://localhost:4566"
  }
}

resource "aws_s3_bucket" "proof_store" {
  bucket = "agent-os-proof-store"
}

resource "aws_sqs_queue" "rail_events" {
  name                       = "agent-os-rail-events"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 86400
}

resource "aws_dynamodb_table" "proof_chain" {
  name         = "agent-os-proof-chain"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "business_id"
  range_key    = "proof_id"

  attribute {
    name = "business_id"
    type = "S"
  }

  attribute {
    name = "proof_id"
    type = "S"
  }
}

resource "aws_dynamodb_table" "business_state" {
  name         = "agent-os-business-state"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "business_id"

  attribute {
    name = "business_id"
    type = "S"
  }
}

resource "aws_dynamodb_table" "approvals" {
  name         = "agent-os-approvals"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "business_id"
  range_key    = "approval_id"

  attribute {
    name = "business_id"
    type = "S"
  }

  attribute {
    name = "approval_id"
    type = "S"
  }
}

resource "aws_dynamodb_table" "event_ledger" {
  name         = "agent-os-event-ledger"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "event_id"

  attribute {
    name = "event_id"
    type = "S"
  }
}

resource "aws_secretsmanager_secret" "rail_adapter_config" {
  name = "agent-os/rail-adapters/mock"
}

resource "aws_secretsmanager_secret_version" "rail_adapter_config" {
  secret_id = aws_secretsmanager_secret.rail_adapter_config.id
  secret_string = jsonencode({
    aa_endpoint        = "mock://aa"
    ondc_endpoint      = "mock://ondc"
    gstn_endpoint      = "mock://gstn"
    ocen_endpoint      = "mock://ocen"
    upi_endpoint       = "mock://upi"
    finternet_endpoint = "mock://finternet"
    contract_version   = "0.1.0"
  })
}

output "proof_store_bucket" {
  value = aws_s3_bucket.proof_store.bucket
}

output "rail_events_queue_url" {
  value = aws_sqs_queue.rail_events.url
}

output "proof_chain_table" {
  value = aws_dynamodb_table.proof_chain.name
}

output "business_state_table" {
  value = aws_dynamodb_table.business_state.name
}

output "approvals_table" {
  value = aws_dynamodb_table.approvals.name
}

output "event_ledger_table" {
  value = aws_dynamodb_table.event_ledger.name
}
