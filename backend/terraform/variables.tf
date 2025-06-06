variable "gcp_project_id" {
  description = "The GCP project ID to deploy resources into."
  type        = string
}

variable "gcp_region" {
  description = "The GCP region for the GKE cluster."
  type        = string
  default     = "us-central1"
}

variable "docker_image_name" {
  description = "The full name of the Docker image in Artifact Registry (e.g. us-central1-docker.pkg.dev/your-project-id/sae-repo/sae-backend:latest)."
  type        = string
}

variable "supabase_url" {
  description = "The URL for the primary Supabase project."
  type        = string
  sensitive   = true
}

variable "supabase_service_role_key" {
  description = "The service role key for the primary Supabase project."
  type        = string
  sensitive   = true
}

variable "register_no_confirmation_email" {
  description = "Flag to control email confirmation. Should be 'true' or 'false'."
  type        = string
  default     = "false"
}