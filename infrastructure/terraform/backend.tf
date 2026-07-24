# ─── IAM Role for Lambda ─────────────────────────────────────────────────────

resource "aws_iam_role" "lambda" {
  name = "${local.app_name}-lambda-role"
  tags = local.tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_ssm" {
  name = "${local.app_name}-ssm-policy"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Resource = "arn:aws:ssm:${var.aws_region}:*:parameter/sgs-quote/*"
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = "*"
      }
    ]
  })
}

# ─── SSM Parameter Store for secrets ─────────────────────────────────────────

resource "aws_ssm_parameter" "gmail_client_id" {
  name  = "/sgs-quote/gmail_client_id"
  type  = "SecureString"
  value = var.gmail_client_id
  tags  = local.tags
}

resource "aws_ssm_parameter" "gmail_client_secret" {
  name  = "/sgs-quote/gmail_client_secret"
  type  = "SecureString"
  value = var.gmail_client_secret
  tags  = local.tags
}

resource "aws_ssm_parameter" "gmail_refresh_token" {
  name  = "/sgs-quote/gmail_refresh_token"
  type  = "SecureString"
  value = var.gmail_refresh_token
  tags  = local.tags
}

resource "aws_ssm_parameter" "supabase_url" {
  name  = "/sgs-quote/supabase_url"
  type  = "SecureString"
  value = var.supabase_url
  tags  = local.tags
}

resource "aws_ssm_parameter" "supabase_anon_key" {
  name  = "/sgs-quote/supabase_anon_key"
  type  = "SecureString"
  value = var.supabase_anon_key
  tags  = local.tags
}

# ─── Lambda Package ──────────────────────────────────────────────────────────

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.root}/../../backend/lambda"
  output_path = "${path.root}/../../backend/lambda_package.zip"
  excludes    = ["__pycache__", "*.pyc", "tests/"]
}

# ─── Lambda Functions ─────────────────────────────────────────────────────────

resource "aws_lambda_function" "send_email" {
  function_name    = "${local.app_name}-send-email"
  role             = aws_iam_role.lambda.arn
  handler          = "send_email.handler"
  runtime          = "python3.12"
  timeout          = 30
  memory_size      = 256
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  tags             = local.tags

  environment {
    variables = merge(
      local.otel_env_vars,
      {}
    )
  }
}

resource "aws_lambda_function" "save_customer" {
  function_name    = "${local.app_name}-save-customer"
  role             = aws_iam_role.lambda.arn
  handler          = "save_customer.handler"
  runtime          = "python3.12"
  timeout          = 15
  memory_size      = 128
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  tags             = local.tags

  environment {
    variables = merge(
      local.otel_env_vars,
      {}
    )
  }
}

resource "aws_lambda_function" "get_customers" {
  function_name    = "${local.app_name}-get-customers"
  role             = aws_iam_role.lambda.arn
  handler          = "get_customers.handler"
  runtime          = "python3.12"
  timeout          = 15
  memory_size      = 128
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  tags             = local.tags

  environment {
    variables = merge(
      local.otel_env_vars,
      {}
    )
  }
}

resource "aws_lambda_function" "save_quote" {
  function_name    = "${local.app_name}-save-quote"
  role             = aws_iam_role.lambda.arn
  handler          = "save_quote.handler"
  runtime          = "python3.12"
  timeout          = 20 # increased from 15 to allow ~1.5s for telemetry flush
  memory_size      = 128
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  tags             = local.tags

  environment {
    variables = merge(
      local.otel_env_vars,
      {}
    )
  }
}

resource "aws_lambda_function" "get_quotes" {
  function_name    = "${local.app_name}-get-quotes"
  role             = aws_iam_role.lambda.arn
  handler          = "get_quotes.handler"
  runtime          = "python3.12"
  timeout          = 15
  memory_size      = 128
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  tags             = local.tags

  environment {
    variables = merge(
      local.otel_env_vars,
      {}
    )
  }
}

# ─── API Gateway ─────────────────────────────────────────────────────────────

resource "aws_apigatewayv2_api" "main" {
  name          = "${local.app_name}-api"
  protocol_type = "HTTP"
  tags          = local.tags

  cors_configuration {
    allow_headers = ["Content-Type", "Authorization", "X-Api-Key"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_origins = ["https://${local.domain}"]
    max_age       = 3600
  }
}

resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true
  tags        = local.tags
}

# Helper to create Lambda integration + route
locals {
  lambda_functions = {
    send_email    = aws_lambda_function.send_email
    save_customer = aws_lambda_function.save_customer
    get_customers = aws_lambda_function.get_customers
    save_quote    = aws_lambda_function.save_quote
    get_quotes    = aws_lambda_function.get_quotes
  }
}

# Lambda integrations
resource "aws_apigatewayv2_integration" "send_email" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.send_email.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "save_customer" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.save_customer.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "get_customers" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.get_customers.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "save_quote" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.save_quote.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "get_quotes" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.get_quotes.invoke_arn
  payload_format_version = "2.0"
}

# Routes
resource "aws_apigatewayv2_route" "send_email" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/email/send"
  target    = "integrations/${aws_apigatewayv2_integration.send_email.id}"
}

resource "aws_apigatewayv2_route" "save_customer" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/customers"
  target    = "integrations/${aws_apigatewayv2_integration.save_customer.id}"
}

resource "aws_apigatewayv2_route" "get_customers" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/customers"
  target    = "integrations/${aws_apigatewayv2_integration.get_customers.id}"
}

resource "aws_apigatewayv2_route" "save_quote" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/quotes"
  target    = "integrations/${aws_apigatewayv2_integration.save_quote.id}"
}

resource "aws_apigatewayv2_route" "get_quotes" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/quotes"
  target    = "integrations/${aws_apigatewayv2_integration.get_quotes.id}"
}

# Lambda permissions for API Gateway
resource "aws_lambda_permission" "send_email" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.send_email.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "save_customer" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.save_customer.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "get_customers" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_customers.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "save_quote" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.save_quote.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "get_quotes" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_quotes.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# Custom domain for API Gateway
resource "aws_apigatewayv2_domain_name" "main" {
  domain_name = "api-quote.stellarglobalsupplies.com"
  tags        = local.tags

  domain_name_configuration {
    certificate_arn = var.certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "aws_apigatewayv2_api_mapping" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  domain_name = aws_apigatewayv2_domain_name.main.id
  stage       = aws_apigatewayv2_stage.main.id
}

resource "aws_route53_record" "api" {
  zone_id = var.route53_zone_id
  name    = "api-quote.stellarglobalsupplies.com"
  type    = "A"

  alias {
    name                   = aws_apigatewayv2_domain_name.main.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.main.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

# ── SKU search Lambda ──────────────────────────────────────────────────────────
resource "aws_lambda_function" "get_skus" {
  function_name    = "${local.app_name}-get-skus"
  role             = aws_iam_role.lambda.arn
  handler          = "get_skus.handler"
  runtime          = "python3.12"
  timeout          = 15
  memory_size      = 128
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  tags             = local.tags

  environment {
    variables = merge(
      local.otel_env_vars,
      {}
    )
  }
}

resource "aws_apigatewayv2_integration" "get_skus" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.get_skus.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "get_skus" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/skus"
  target    = "integrations/${aws_apigatewayv2_integration.get_skus.id}"
}

resource "aws_lambda_permission" "get_skus" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_skus.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# Service role key — used by Lambda only, never passed to browser
resource "aws_ssm_parameter" "supabase_service_role_key" {
  name  = "/sgs-quote/supabase_service_role_key"
  type  = "SecureString"
  value = var.supabase_service_role_key
  tags  = local.tags
}

# ── Delete quote Lambda ───────────────────────────────────────────────────────
resource "aws_lambda_function" "delete_quote" {
  function_name    = "${local.app_name}-delete-quote"
  role             = aws_iam_role.lambda.arn
  handler          = "delete_quote.handler"
  runtime          = "python3.12"
  timeout          = 15
  memory_size      = 128
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  tags             = local.tags
  environment {
    variables = merge(
      local.otel_env_vars,
      {}
    )
  }
}

resource "aws_apigatewayv2_integration" "delete_quote" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.delete_quote.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "delete_quote" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "DELETE /api/quotes/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.delete_quote.id}"
}

resource "aws_apigatewayv2_route" "update_quote_status" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "PATCH /api/quotes/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.delete_quote.id}" # reuses same Lambda
}

resource "aws_lambda_permission" "delete_quote" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.delete_quote.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
