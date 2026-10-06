variable "aws_region" {
  description = "AWS region for production infrastructure."
  type        = string
  default     = "ap-south-1"
}

variable "availability_zones" {
  description = "Two or more availability zones in aws_region."
  type        = list(string)
  default     = ["ap-south-1a", "ap-south-1b"]
}

variable "name_prefix" {
  description = "Prefix for production resource names."
  type        = string
  default     = "india-stack-agent-os"
}

variable "environment" {
  description = "Deployment environment label."
  type        = string
  default     = "prod"
}

variable "app_image_uri" {
  description = "Container image URI containing this repository and production dependencies. Defaults to this stack's ECR repo :latest tag."
  type        = string
  default     = null
}

variable "api_desired_count" {
  description = "Desired ECS task count for the API service. Keep 0 until the production image and secrets are ready."
  type        = number
  default     = 0
}

variable "worker_desired_count" {
  description = "Desired ECS task count for the event worker. Keep 0 until the production image and secrets are ready."
  type        = number
  default     = 0
}

variable "rail_adapter_mode" {
  description = "Adapter mode for deployed runtime."
  type        = string
  default     = "fixture"

  validation {
    condition     = contains(["fixture", "mock-http", "sandbox", "prod"], var.rail_adapter_mode)
    error_message = "rail_adapter_mode must be fixture, mock-http, sandbox, or prod."
  }
}

variable "certificate_arn" {
  description = "Optional ACM certificate ARN for HTTPS ALB listener."
  type        = string
  default     = null
}

variable "proof_store_bucket_name" {
  description = "Optional globally unique S3 bucket name for proof payloads."
  type        = string
  default     = null
}

variable "container_cpu" {
  description = "CPU units for each ECS task."
  type        = number
  default     = 512
}

variable "container_memory" {
  description = "Memory MiB for each ECS task."
  type        = number
  default     = 1024
}

variable "tags" {
  description = "Additional resource tags."
  type        = map(string)
  default     = {}
}
