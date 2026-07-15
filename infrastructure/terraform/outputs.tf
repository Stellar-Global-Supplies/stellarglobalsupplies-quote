output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (needed for cache invalidation in CI/CD)"
  value       = aws_cloudfront_distribution.frontend.id
}

output "frontend_bucket_name" {
  description = "S3 bucket name for frontend deployment"
  value       = aws_s3_bucket.frontend.bucket
}

output "api_endpoint" {
  description = "API Gateway custom domain endpoint"
  value       = "https://api-quote.stellarglobalsupplies.com"
}

output "app_url" {
  description = "Application URL"
  value       = "https://${local.domain}"
}
