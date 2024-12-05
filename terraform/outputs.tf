output "acr_login_server" {
  value = azurerm_container_registry.acr.login_server
  description = "The login server URL for Azure Container Registry"
}

output "eventhub_name" {
  value = azurerm_eventhub.eh.name
  description = "The name of the Event Hub"
}

output "eventhub_namespace" {
  value = "${azurerm_eventhub_namespace.ehn.name}.servicebus.windows.net"
  description = "The fully qualified Event Hub namespace"
}

output "eventhub_connection_string" {
  value     = azurerm_eventhub_namespace.ehn.default_primary_connection_string
  sensitive = true
}

output "resource_group_name" {
  value = azurerm_resource_group.rg.name
  description = "The name of the resource group"
}

output "kubelet_identity_object_id" {
  value = azurerm_kubernetes_cluster.aks.kubelet_identity[0].object_id
  description = "The object ID of the AKS kubelet identity"
}

output "kubelet_identity_client_id" {
  value = azurerm_kubernetes_cluster.aks.kubelet_identity[0].client_id
  description = "The client ID of the AKS kubelet identity"
}

output "tenant_id" {
  value = data.azurerm_client_config.current.tenant_id
  description = "The Azure tenant ID"
}
