terraform {
  required_version = "= 1.13.4"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.20.0"
    }
  }
}

provider "aws" {
  region                      = "us-east-1"
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  skip_region_validation      = true

  endpoints {
    apigateway   = "http://127.0.0.1:4566"
    apigatewayv2 = "http://127.0.0.1:4566"
    ec2          = "http://127.0.0.1:4566"
    elbv2        = "http://127.0.0.1:4566"
    rds          = "http://127.0.0.1:4566"
    sts          = "http://127.0.0.1:4566"
  }
}

variable "database_password" {
  type      = string
  sensitive = true
  validation {
    condition     = length(var.database_password) >= 20
    error_message = "Supply the generated local database password."
  }
}

variable "enable_second_api" {
  type    = bool
  default = false
}

resource "aws_vpc" "local" {
  cidr_block           = "10.70.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "kwartrack-api-local" }
}

resource "aws_subnet" "local" {
  count             = 2
  vpc_id            = aws_vpc.local.id
  cidr_block        = "10.70.${count.index}.0/24"
  availability_zone = "us-east-1${count.index == 0 ? "a" : "b"}"
  tags              = { Name = "kwartrack-api-local-${count.index}" }
}

resource "aws_security_group" "local" {
  name        = "kwartrack-api-local"
  description = "Local emulator topology only; not a real network boundary"
  vpc_id      = aws_vpc.local.id
}

resource "aws_db_subnet_group" "local" {
  name       = "kwartrack-api-local"
  subnet_ids = aws_subnet.local[*].id
}

resource "aws_db_instance" "local" {
  identifier                 = "kwartrack-api-local"
  db_name                    = "kwartrack_api"
  engine                     = "postgres"
  engine_version             = "16.6"
  instance_class             = "db.t3.micro"
  allocated_storage          = 20
  username                   = "kwartrack"
  password                   = var.database_password
  db_subnet_group_name       = aws_db_subnet_group.local.name
  vpc_security_group_ids     = [aws_security_group.local.id]
  publicly_accessible        = false
  skip_final_snapshot        = true
  deletion_protection        = false
  backup_retention_period    = 0
  auto_minor_version_upgrade = false
  apply_immediately          = true
}

resource "aws_lb" "local" {
  name               = "kwartrack-api-local"
  internal           = true
  load_balancer_type = "application"
  subnets            = aws_subnet.local[*].id
  security_groups    = [aws_security_group.local.id]
}

resource "aws_lb_target_group" "api" {
  name        = "kwartrack-api-local"
  port        = 3000
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.local.id

  health_check {
    path                = "/health/ready"
    port                = "traffic-port"
    protocol            = "HTTP"
    interval            = 5
    timeout             = 2
    healthy_threshold   = 2
    unhealthy_threshold = 2
    matcher             = "200"
  }
}

resource "aws_lb_target_group_attachment" "api" {
  for_each          = var.enable_second_api ? { first = "172.29.240.10", second = "172.29.240.11" } : { first = "172.29.240.10" }
  target_group_arn  = aws_lb_target_group.api.arn
  target_id         = each.value
  port              = 3000
  availability_zone = "all"
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.local.arn
  port              = 8080
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

resource "aws_apigatewayv2_vpc_link" "local" {
  name               = "kwartrack-api-local"
  security_group_ids = [aws_security_group.local.id]
  subnet_ids         = aws_subnet.local[*].id
}

resource "aws_apigatewayv2_api" "local" {
  name          = "kwartrack-api-local"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "local" {
  api_id                 = aws_apigatewayv2_api.local.id
  integration_type       = "HTTP_PROXY"
  integration_method     = "ANY"
  integration_uri        = aws_lb_listener.http.arn
  connection_type        = "VPC_LINK"
  connection_id          = aws_apigatewayv2_vpc_link.local.id
  payload_format_version = "1.0"
}

resource "aws_apigatewayv2_route" "proxy" {
  api_id    = aws_apigatewayv2_api.local.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.local.id}"
}

resource "aws_apigatewayv2_stage" "local" {
  api_id      = aws_apigatewayv2_api.local.id
  name        = "$default"
  auto_deploy = true
}

output "database_endpoint" {
  value = aws_db_instance.local.endpoint
}

output "database_port" {
  value = aws_db_instance.local.port
}

output "api_id" {
  value = aws_apigatewayv2_api.local.id
}

output "alb_dns_name" {
  value = aws_lb.local.dns_name
}

output "target_group_arn" {
  value = aws_lb_target_group.api.arn
}
