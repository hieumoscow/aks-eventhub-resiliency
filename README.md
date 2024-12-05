# Azure Event Hub Test Application

A test application demonstrating AKS to Event Hub integration using Managed Identity.

## Components
- AKS cluster with managed identity
- Event Hub for message ingestion
- Container Registry for images

## Features
- Connection pooling with auto-cleanup
- Error handling with retries
- Health checks and monitoring
- Detailed event tracking

## Prerequisites
- Azure CLI
- Terraform
- Docker
- kubectl

## Deploy

1. Configure Azure
```bash
az login
az account set --subscription <your-subscription-id>
```

2. Deploy Infrastructure
```bash
cd terraform
terraform init
terraform apply
```

3. Deploy Application
```bash
./deploy.sh
```

## Implementation Improvements

### Previous Implementation
The original Event Hub client had several limitations that could impact reliability and maintainability:

1. **Connection Management**
   - Used static connection pool with no health verification
   - Relied on connection strings, requiring secure storage and rotation
   - No automatic cleanup of stale connections
   - Manual intervention needed for client recreation

2. **Error Handling**
   - Basic retry mechanism with fixed delays
   - No distinction between transient and permanent failures
   - Limited error context in logs
   - No health status tracking

3. **Monitoring**
   - Minimal logging of operations
   - No tracking of client lifecycle
   - Limited visibility into connection status
   - No metrics for events published

### Current Implementation
The new implementation addresses these limitations with several key improvements:

1. **Robust Client Management**
   - Single client instance with automatic recreation on failure
   - Managed Identity authentication for better security
   - Built-in health checks to verify client status
   - Smart connection management that detects and recovers from stale states
   - Automatic client recreation when connection issues are detected

2. **Enhanced Error Handling**
   - Detailed error tracking with full stack traces
   - Comprehensive logging with consistent timestamp format
   - Clear distinction between connection and publishing errors
   - Automatic recovery from transient failures
   - Health status reporting for monitoring and debugging

3. **Improved Testing Capabilities**
   - Automatic publishing simulation for load testing
   - Stale connection simulation for verifying recovery
   - Sequence tracking for event ordering
   - Health check endpoints for monitoring
   - Easy-to-use test endpoints for verification

4. **Operational Improvements**
   - Total events published tracking
   - Max 30 message publishing limit per pod, delete for reset
   - Client creation timestamp tracking
   - Real-time connection status monitoring
   - Detailed health status reporting
   - Consistent logging format for better debugging

## Cleanup
```bash
terraform destroy
