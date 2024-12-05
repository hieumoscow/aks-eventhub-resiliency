#!/bin/bash
set -e

# Get values from Terraform outputs
cd terraform
export RESOURCE_GROUP=$(terraform output -raw resource_group_name)
export CLUSTER_NAME=aks-eventhub-test
export ACR_LOGIN_SERVER=$(terraform output -raw acr_login_server)
export EVENT_HUB_NAME=$(terraform output -raw eventhub_name)
export EVENT_HUB_NAMESPACE=$(terraform output -raw eventhub_namespace)
export AZURE_TENANT_ID=$(terraform output -raw tenant_id)
export AZURE_CLIENT_ID=$(terraform output -raw kubelet_identity_client_id)
cd ..

# Generate timestamp-based tag
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
IMAGE_TAG="eventhub-test:$TIMESTAMP"
FULL_IMAGE_NAME="$ACR_LOGIN_SERVER/$IMAGE_TAG"

# Get AKS credentials
echo "Getting AKS credentials..."
az aks get-credentials --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME --overwrite-existing

# Build and push Docker image
echo "Building Docker image..."
docker build --platform linux/amd64 -t $IMAGE_TAG .

echo "Tagging Docker image..."
docker tag $IMAGE_TAG $FULL_IMAGE_NAME

# Get ACR name from login server
ACR_NAME=$(echo $ACR_LOGIN_SERVER | cut -d'.' -f1)

echo "Logging into ACR..."
az acr login --name $ACR_NAME

echo "Pushing image to ACR..."
docker push $FULL_IMAGE_NAME

# Update image tag in deployment YAML
echo "Updating deployment configuration..."
export IMAGE_NAME=$FULL_IMAGE_NAME
envsubst < k8s/deployment.yaml > k8s/deployment_updated.yaml

# Deploy to Kubernetes
echo "Deploying application..."
kubectl apply -f k8s/deployment_updated.yaml

# Clean up temporary file
rm k8s/deployment_updated.yaml

echo "Deployment complete! Monitor the pods with:"
echo "kubectl get pods -w"
