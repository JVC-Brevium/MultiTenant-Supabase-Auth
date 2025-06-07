output "gke_cluster_name" {
  description = "The name of the created GKE cluster."
  value       = google_container_cluster.primary.name
}

output "load_balancer_ip" {
  description = "The public IP address of the load balancer for the sae-backend service."
  value       = kubernetes_service.sae_backend_service.status[0].load_balancer[0].ingress[0].ip
}