variable "resource_group_name" {
  type        = string
  description = "Name of the resource group"
}

variable "location" {
  type        = string
  description = "Azure region for resources"
  default     = "eastus"
}

variable "cluster_name" {
  type        = string
  description = "Name of the AKS cluster"
}

variable "registry_name" {
  type        = string
  description = "Name of the Azure Container Registry"
}

variable "eventhub_namespace_name" {
  type        = string
  description = "Name of the Event Hub Namespace"
}

variable "eventhub_name" {
  type        = string
  description = "Name of the Event Hub"
}
