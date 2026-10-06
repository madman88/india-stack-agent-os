variable "name_prefix" {
  description = "Prefix for DynamoDB table names."
  type        = string
}

variable "tags" {
  description = "Resource tags."
  type        = map(string)
  default     = {}
}
