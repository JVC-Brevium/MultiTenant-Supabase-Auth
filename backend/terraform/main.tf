terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.20"
    }
  }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

# 1. Create a GKE cluster
resource "google_container_cluster" "primary" {
  name     = "${var.gcp_project_id}-gke-cluster"
  location = var.gcp_region

  # We can start with a small, cost-effective cluster
  initial_node_count = 1
  node_config {
    machine_type = "e2-small"
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]
  }
}

# 2. Configure the Kubernetes provider to connect to the new GKE cluster
provider "kubernetes" {
  host                   = "https://{data.google_container_cluster.primary.endpoint}"
  token                  = data.google_client_config.default.access_token
  cluster_ca_certificate = base64decode(data.google_container_cluster.primary.master_auth[0].cluster_ca_certificate)
}

# Required for the Kubernetes provider to authenticate
data "google_client_config" "default" {}

data "google_container_cluster" "primary" {
  name     = google_container_cluster.primary.name
  location = google_container_cluster.primary.location
}