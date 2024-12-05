terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

data "azurerm_client_config" "current" {}

resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

locals {
  suffix = random_string.suffix.result
}

resource "azurerm_resource_group" "rg" {
  name     = "${var.resource_group_name}-${local.suffix}"
  location = var.location
}

resource "azurerm_kubernetes_cluster" "aks" {
  name                = "${var.cluster_name}-${local.suffix}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  dns_prefix         = "${var.cluster_name}-${local.suffix}"

  default_node_pool {
    name       = "default"
    node_count = 1
    vm_size    = "Standard_D4s_v3"
    
    upgrade_settings {
      max_surge = "10%"
    }
  }

  identity {
    type = "SystemAssigned"
  }

  oidc_issuer_enabled = true
}

resource "azurerm_container_registry" "acr" {
  name                = "${var.registry_name}${local.suffix}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                = "Standard"
  admin_enabled      = true
}

resource "azurerm_role_assignment" "aks_to_acr" {
  principal_id                     = azurerm_kubernetes_cluster.aks.kubelet_identity[0].object_id
  role_definition_name            = "AcrPull"
  scope                          = azurerm_container_registry.acr.id
  skip_service_principal_aad_check = true
}

resource "azurerm_eventhub_namespace" "ehn" {
  name                = "${var.eventhub_namespace_name}-${local.suffix}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                = "Standard"
  capacity           = 1
}

resource "azurerm_eventhub" "eh" {
  name                = "${var.eventhub_name}-${local.suffix}"
  namespace_name      = azurerm_eventhub_namespace.ehn.name
  resource_group_name = azurerm_resource_group.rg.name
  partition_count     = 2
  message_retention   = 1
}

resource "azurerm_role_assignment" "aks_to_eventhub" {
  principal_id         = azurerm_kubernetes_cluster.aks.kubelet_identity[0].object_id
  role_definition_name = "Azure Event Hubs Data Sender"
  scope               = azurerm_eventhub.eh.id
}

output "aks_id" {
  value = azurerm_kubernetes_cluster.aks.id
}

output "acr_id" {
  value = azurerm_container_registry.acr.id
}

output "eventhub_namespace_id" {
  value = azurerm_eventhub_namespace.ehn.id
}

output "eventhub_id" {
  value = azurerm_eventhub.eh.id
}
