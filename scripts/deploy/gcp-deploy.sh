#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

usage() {
  cat <<'USAGE'
Usage:
  ./scripts/deploy/gcp-deploy.sh <core|node|media> [options]

Options:
  --project-id ID               GCP project id
  --region REGION               Cloud Run region
  --service-name NAME           Cloud Run service name
  --artifact-repo NAME          Artifact Registry repository name
  --artifact-region REGION      Artifact Registry region
  --image-name NAME             Image name override
  --tag TAG                     Image tag (default: latest)
  --env-file FILE               Env file override
  --cloudsql INSTANCE           Cloud SQL connection name PROJECT:REGION:INSTANCE
  --vpc-connector NAME          Serverless VPC connector name
  --service-account EMAIL       Runtime service account
  --min-instances N             Cloud Run minimum instances
  --max-instances N             Cloud Run maximum instances
  --concurrency N               Cloud Run concurrency
  --cpu CPU                     Cloud Run CPU
  --memory SIZE                 Cloud Run memory, e.g. 1Gi
  --timeout DURATION            Cloud Run timeout, e.g. 300s
  --ingress MODE                Cloud Run ingress, e.g. all/internal/internal-and-cloud-load-balancing
  --no-allow-unauthenticated    Disable unauthenticated access
  --build-only                  Build and push image only
  --deploy-only                 Deploy existing image only
  --skip-push                   Build image locally without pushing

Examples:
  ./scripts/deploy/gcp-deploy.sh core --project-id my-proj --region europe-southwest1 --artifact-repo opencom
  ./scripts/deploy/gcp-deploy.sh node --project-id my-proj --region europe-southwest1 --artifact-repo opencom --cloudsql my-proj:europe-southwest1:opencom-core
USAGE
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[err] Missing required command: $1"
    exit 1
  fi
}

SERVICE="${1:-}"
if [[ -z "$SERVICE" || "$SERVICE" == "-h" || "$SERVICE" == "--help" || "$SERVICE" == "help" ]]; then
  usage
  exit 0
fi
shift || true

case "$SERVICE" in
  core)
    DEFAULT_ENV_FILE="$BACKEND_DIR/core.env"
    DEFAULT_SERVICE_NAME="opencom-core"
    DEFAULT_IMAGE_NAME="opencom-core"
    ;;
  node)
    DEFAULT_ENV_FILE="$BACKEND_DIR/node.env"
    DEFAULT_SERVICE_NAME="opencom-node"
    DEFAULT_IMAGE_NAME="opencom-node"
    ;;
  media)
    DEFAULT_ENV_FILE="$BACKEND_DIR/media.env"
    DEFAULT_SERVICE_NAME="opencom-media"
    DEFAULT_IMAGE_NAME="opencom-media"
    ;;
  *)
    echo "[err] Unknown service: $SERVICE"
    usage
    exit 1
    ;;
esac

PROJECT_ID="${GCP_PROJECT_ID:-}"
REGION="${GCP_REGION:-}"
ARTIFACT_REGION="${GCP_ARTIFACT_REGISTRY_REGION:-}"
ARTIFACT_REPO="${GCP_ARTIFACT_REGISTRY_REPOSITORY:-opencom}"
SERVICE_NAME="$DEFAULT_SERVICE_NAME"
IMAGE_NAME="$DEFAULT_IMAGE_NAME"
TAG="${GCP_IMAGE_TAG:-latest}"
ENV_FILE="$DEFAULT_ENV_FILE"
CLOUDSQL_INSTANCE=""
VPC_CONNECTOR=""
RUNTIME_SERVICE_ACCOUNT=""
MIN_INSTANCES=""
MAX_INSTANCES=""
CONCURRENCY=""
CPU=""
MEMORY=""
TIMEOUT=""
INGRESS=""
ALLOW_UNAUTHENTICATED=1
BUILD_ONLY=0
DEPLOY_ONLY=0
SKIP_PUSH=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-id)
      PROJECT_ID="$2"
      shift 2
      ;;
    --region)
      REGION="$2"
      shift 2
      ;;
    --service-name)
      SERVICE_NAME="$2"
      shift 2
      ;;
    --artifact-repo)
      ARTIFACT_REPO="$2"
      shift 2
      ;;
    --artifact-region)
      ARTIFACT_REGION="$2"
      shift 2
      ;;
    --image-name)
      IMAGE_NAME="$2"
      shift 2
      ;;
    --tag)
      TAG="$2"
      shift 2
      ;;
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --cloudsql)
      CLOUDSQL_INSTANCE="$2"
      shift 2
      ;;
    --vpc-connector)
      VPC_CONNECTOR="$2"
      shift 2
      ;;
    --service-account)
      RUNTIME_SERVICE_ACCOUNT="$2"
      shift 2
      ;;
    --min-instances)
      MIN_INSTANCES="$2"
      shift 2
      ;;
    --max-instances)
      MAX_INSTANCES="$2"
      shift 2
      ;;
    --concurrency)
      CONCURRENCY="$2"
      shift 2
      ;;
    --cpu)
      CPU="$2"
      shift 2
      ;;
    --memory)
      MEMORY="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    --ingress)
      INGRESS="$2"
      shift 2
      ;;
    --no-allow-unauthenticated)
      ALLOW_UNAUTHENTICATED=0
      shift
      ;;
    --build-only)
      BUILD_ONLY=1
      shift
      ;;
    --deploy-only)
      DEPLOY_ONLY=1
      shift
      ;;
    --skip-push)
      SKIP_PUSH=1
      shift
      ;;
    *)
      echo "[err] Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$PROJECT_ID" || -z "$REGION" ]]; then
  echo "[err] --project-id and --region are required"
  exit 1
fi

if [[ -z "$ARTIFACT_REGION" ]]; then
  ARTIFACT_REGION="$REGION"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[err] Env file not found: $ENV_FILE"
  exit 1
fi

require_command gcloud
require_command docker

ENV_FILE_FOR_DEPLOY="$ENV_FILE"
TEMP_ENV_FILE=""

if grep -q -E "^[A-Za-z_][A-Za-z0-9_]*=" "$ENV_FILE"; then
  require_command node
  TEMP_ENV_FILE="$(mktemp -t opencom-env-XXXXXX.yaml)"
  node "$ROOT_DIR/scripts/env/convert-env-to-yaml.mjs" "$ENV_FILE" > "$TEMP_ENV_FILE"
  ENV_FILE_FOR_DEPLOY="$TEMP_ENV_FILE"
fi

if [[ -n "$TEMP_ENV_FILE" ]]; then
  trap 'rm -f "$TEMP_ENV_FILE"' EXIT
fi

IMAGE_URI="${ARTIFACT_REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}/${IMAGE_NAME}:${TAG}"

echo "[info] Service target: $SERVICE"
echo "[info] Project: $PROJECT_ID"
echo "[info] Region: $REGION"
echo "[info] Cloud Run service: $SERVICE_NAME"
echo "[info] Env file: $ENV_FILE"
if [[ "$ENV_FILE_FOR_DEPLOY" != "$ENV_FILE" ]]; then
  echo "[info] Env file (converted): $ENV_FILE_FOR_DEPLOY"
fi
echo "[info] Image: $IMAGE_URI"

gcloud config set project "$PROJECT_ID" >/dev/null

if [[ "$DEPLOY_ONLY" != "1" ]]; then
  echo "[auth] Configuring Artifact Registry docker auth"
  gcloud auth configure-docker "${ARTIFACT_REGION}-docker.pkg.dev" --quiet

  echo "[build] Building image"
  docker build \
    --file "$BACKEND_DIR/Dockerfile" \
    --build-arg "SERVICE=$SERVICE" \
    --tag "$IMAGE_URI" \
    "$BACKEND_DIR"

  if [[ "$SKIP_PUSH" != "1" ]]; then
    echo "[push] Pushing image"
    docker push "$IMAGE_URI"
  fi
fi

if [[ "$BUILD_ONLY" == "1" ]]; then
  echo "[done] Build-only mode completed."
  exit 0
fi

DEPLOY_ARGS=(
  run deploy "$SERVICE_NAME"
  "--image=$IMAGE_URI"
  "--region=$REGION"
  "--platform=managed"
  "--env-vars-file=$ENV_FILE_FOR_DEPLOY"
)

if [[ "$ALLOW_UNAUTHENTICATED" == "1" ]]; then
  DEPLOY_ARGS+=("--allow-unauthenticated")
else
  DEPLOY_ARGS+=("--no-allow-unauthenticated")
fi

if [[ -n "$MIN_INSTANCES" ]]; then
  DEPLOY_ARGS+=("--min-instances=$MIN_INSTANCES")
fi
if [[ -n "$MAX_INSTANCES" ]]; then
  DEPLOY_ARGS+=("--max-instances=$MAX_INSTANCES")
fi
if [[ -n "$CONCURRENCY" ]]; then
  DEPLOY_ARGS+=("--concurrency=$CONCURRENCY")
fi
if [[ -n "$CPU" ]]; then
  DEPLOY_ARGS+=("--cpu=$CPU")
fi
if [[ -n "$MEMORY" ]]; then
  DEPLOY_ARGS+=("--memory=$MEMORY")
fi
if [[ -n "$TIMEOUT" ]]; then
  DEPLOY_ARGS+=("--timeout=$TIMEOUT")
fi
if [[ -n "$INGRESS" ]]; then
  DEPLOY_ARGS+=("--ingress=$INGRESS")
fi
if [[ -n "$CLOUDSQL_INSTANCE" ]]; then
  DEPLOY_ARGS+=("--add-cloudsql-instances=$CLOUDSQL_INSTANCE")
fi
if [[ -n "$VPC_CONNECTOR" ]]; then
  DEPLOY_ARGS+=("--vpc-connector=$VPC_CONNECTOR")
fi
if [[ -n "$RUNTIME_SERVICE_ACCOUNT" ]]; then
  DEPLOY_ARGS+=("--service-account=$RUNTIME_SERVICE_ACCOUNT")
fi

echo "[deploy] Deploying to Cloud Run"
gcloud "${DEPLOY_ARGS[@]}"

echo "[done] Deployment complete."
