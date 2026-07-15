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
}
