#!/bin/bash
set -e

# Get ACR login server from terraform output
ACR_LOGIN_SERVER=$(terraform output -raw acr_login_server)

# Build Docker image
echo "Building Docker image..."
docker build --platform linux/amd64 -t eventhub-test:latest ..

# Tag image
echo "Tagging image..."
docker tag eventhub-test:latest "$ACR_LOGIN_SERVER/eventhub-test:latest"

# Get ACR name
ACR_NAME=$(echo $ACR_LOGIN_SERVER | cut -d'.' -f1)

# Login to ACR
echo "Logging into ACR..."
az acr login --name $ACR_NAME

# Push image
echo "Pushing image to ACR..."
docker push "$ACR_LOGIN_SERVER/eventhub-test:latest"
