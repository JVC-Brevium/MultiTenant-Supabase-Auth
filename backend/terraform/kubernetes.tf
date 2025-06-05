# 1. Create a Kubernetes Secret to hold environment variables
resource "kubernetes_secret" "supabase_creds" {
  metadata {
    name = "supabase-credentials"
  }
  data = {
    SUPABASE_URL                     = var.supabase_url
    SUPABASE_SERVICE_ROLE_KEY      = var.supabase_service_role_key
    REGISTER_NO_CONFIRMATION_EMAIL = var.register_no_confirmation_email
  }
}

# 2. Create the Kubernetes Deployment
resource "kubernetes_deployment" "sae_backend" {
  metadata {
    name = "sae-backend-deployment"
    labels = {
      app = "sae-backend"
    }
  }

  spec {
    replicas = 2 # Start with two replicas for high availability

    selector {
      match_labels = {
        app = "sae-backend"
      }
    }

    template {
      metadata {
        labels = {
          app = "sae-backend"
        }
      }

      spec {
        container {
          image = var.docker_image_name
          name  = "sae-backend"
          ports {
            container_port = 3000
          }

          # Mount the secrets as environment variables
          env_from {
            secret_ref {
              name = kubernetes_secret.supabase_creds.metadata[0].name
            }
          }

          # Define the health check for Kubernetes liveness/readiness probes
          liveness_probe {
            http_get {
              path = "/health"
              port = 3000
            }
            initial_delay_seconds = 40
            period_seconds      = 30
          }
          readiness_probe {
            http_get {
              path = "/health"
              port = 3000
            }
            initial_delay_seconds = 15
            period_seconds      = 10
          }
        }
      }
    }
  }
}

# 3. Create a Service to expose the deployment
resource "kubernetes_service" "sae_backend_service" {
  metadata {
    name = "sae-backend-service"
  }
  spec {
    selector = {
      app = kubernetes_deployment.sae_backend.spec[0].template[0].metadata[0].labels.app
    }
    port {
      port        = 80
      target_port = 3000
    }
    type = "LoadBalancer" # This will provision a Google Cloud Load Balancer
  }
}