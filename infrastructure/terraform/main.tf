terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }

  backend "s3" {
    bucket         = "stellarglobalsupplies-backend-config"
    key            = "stellar-global-quote/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "stellarglobalsupplies-backend-db-config"
  }
}

provider "aws" {
  region = var.aws_region
}

# Provider in us-east-1 for ACM (CloudFront requires certs in us-east-1)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

locals {
  app_name = "sgs-quote-app"
  domain   = "quote.stellarglobalsupplies.com"
  tags = {
    Project     = "SGS-Quote-App"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
  
  # OpenTelemetry configuration for New Relic EU
  otel_env_vars = {
    SSM_PREFIX                         = "/sgs-quote"
    ENVIRONMENT                        = var.environment
    OTEL_SERVICE_NAME                  = "sgs-quote-app"
    OTEL_RESOURCE_ATTRIBUTES           = "deployment.environment.name=${var.environment},cloud.provider=aws,cloud.region=${var.aws_region}"
    OTEL_TRACES_SAMPLER                = "parentbased_traceidratio"
    OTEL_TRACES_SAMPLER_ARG            = "0.05"  # 5% sampling for cost control
    OTEL_EXPORTER_OTLP_PROTOCOL        = "http/protobuf"
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = "https://otlp.eu01.nr-data.net/v1/traces"
  }
}
