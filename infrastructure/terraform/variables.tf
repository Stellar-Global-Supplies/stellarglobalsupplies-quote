variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for stellarglobalsupplies.com"
  type        = string
  # Pass via TF_VAR_route53_zone_id or terraform.tfvars
}

variable "certificate_arn" {
  description = "ACM certificate ARN for *.stellarglobalsupplies.com (must be in us-east-1)"
  type        = string
  # Pass via TF_VAR_certificate_arn or terraform.tfvars
}

variable "supabase_url" {
  description = "Supabase project URL"
  type        = string
  sensitive   = true
}

variable "supabase_anon_key" {
  description = "Supabase anon/public key"
  type        = string
  sensitive   = true
}

variable "gmail_client_id" {
  description = "Google OAuth2 client ID"
  type        = string
  sensitive   = true
}

variable "gmail_client_secret" {
  description = "Google OAuth2 client secret"
  type        = string
  sensitive   = true
}

variable "gmail_refresh_token" {
  description = "Google OAuth2 refresh token"
  type        = string
  sensitive   = true
}
