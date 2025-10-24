#!/bin/bash

# This script allows to manage the application in a remote server
# It considers the deployment environment is different than the domain environment (gateway)
# It will allow to deploy the application to the remote server and deploy the domain to the gateway
# IT assumes the gateway environment is a Traefik server (Coolify instance)

# Load environment variables
source .env

# Default values for environment variables
REMOTE_USER="${REMOTE_HOST_USER:-ubuntu}"
REMOTE_HOST="${REMOTE_HOST}"
REMOTE_PORT="${REMOTE_HOST_PORT:-22}"

REMOTE_PATH="${REMOTE_HOST_PATH:-~/docker/mufc-booking-v2}"
LOCAL_PATH="$(pwd)"

# Exclude patterns for rsync (space or comma-separated). Always includes .git.
# Default excludes frontend/node_modules as we deploy compiled frontend assets.
REMOTE_SYNC_EXCLUDES="${REMOTE_SYNC_EXCLUDES:-frontend/node_modules}"

# Prompt for APP_NAME if not set and not in .env and write it to .env
if [ -z "${APP_NAME}" ]; then
  if [ -f ".env" ]; then
    if ! grep -q "APP_NAME=" .env; then
      echo "Enter the application name (e.g., Reventos):"
      read -r APP_NAME
      echo "APP_NAME=$APP_NAME" >> .env
    fi
  fi
fi


if [ -z "${REMOTE_DOMAIN_CONFIG_FILENAME}" ]; then
  if [ -f ".env" ]; then
    if ! grep -q "REMOTE_DOMAIN_CONFIG_FILENAME=" .env; then
      echo "Enter the remote domain config filename (default: ${APP_NAME// /-}.yml):"
      read -r REMOTE_DOMAIN_CONFIG_FILENAME
      if [ -z "${REMOTE_DOMAIN_CONFIG_FILENAME}" ]; then
        REMOTE_DOMAIN_CONFIG_FILENAME="${APP_NAME// /-}.yml"
      fi
      echo "REMOTE_DOMAIN_CONFIG_FILENAME=$REMOTE_DOMAIN_CONFIG_FILENAME" >> .env
      echo "REMOTE_DOMAIN_CONFIG_FILENAME set to $REMOTE_DOMAIN_CONFIG_FILENAME"
    fi
  fi
fi

# Domain deployment variables
DOMAIN_REMOTE_USER="root"
DOMAIN_REMOTE_HOST="${REMOTE_DOMAIN_HOST}"
DOMAIN_REMOTE_PORT="${REMOTE_DOMAIN_PORT:-22}"

# Default path is the coolify dynamic proxy path
DOMAIN_REMOTE_TRAEFIK_PATH="/data/coolify/proxy/dynamic"

# Fixed proxy file name for management
PROXY_FILE=".manage-proxy-file.yml"
DOMAIN_CONFIG_FILE="$PROXY_FILE"
REMOTE_DOMAIN_CONFIG_FILENAME="${REMOTE_DOMAIN_CONFIG_FILENAME:-$PROXY_FILE}"

# Function to validate required environment variables
function validate_env_vars {
  local missing=false
  
  if [ -z "${REMOTE_HOST}" ]; then
    echo "❌ Error: REMOTE_HOST is not set in .env"
    missing=true
  fi
  
  if [ -z "${REMOTE_USER}" ]; then
    echo "❌ Error: REMOTE_USER is not set in .env"
    missing=true
  fi
  
  if [ "$missing" = true ]; then
    return 1
  fi
  
  return 0
}

# Function to validate domain deployment environment variables
function validate_domain_env_vars {
  local missing=false
  
  if [ -z "${DOMAIN_REMOTE_HOST}" ]; then
    echo "❌ Error: REMOTE_DOMAIN_HOST is not set in .env"
    missing=true
  fi
  
  if [ -z "${REMOTE_SERVICE_IP}" ]; then
    echo "❌ Error: REMOTE_SERVICE_IP is not set in .env"
    missing=true
  fi
  
  if [ -z "${PUBLISHED_DOMAIN}" ]; then
    echo "❌ Error: PUBLISHED_DOMAIN is not set in .env"
    missing=true
  fi
  
  if [ "$missing" = true ]; then
    return 1
  fi
  
  # Check if the proxy file exists
  if [ ! -f "${LOCAL_PATH}/${DOMAIN_CONFIG_FILE}" ]; then
    echo "❌ Error: ${DOMAIN_CONFIG_FILE} not found in ${LOCAL_PATH}"
    echo "Please create the proxy file first using './manage.sh proxy'"
    return 1
  fi
  
  return 0
}

# Function to follow logs on remote server
function follow_logs {
  echo "📜 Following logs on remote server..."
  ssh -t -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST "cd ${REMOTE_PATH} && docker compose logs -f"
}

# Function to deploy application to remote server
function deploy_app {
  echo "Starting deployment to remote server..."
  
  # Validate environment variables
  if ! validate_env_vars; then
    return 1
  fi
  
  echo "🔧 Ensuring remote directory exists at ${REMOTE_PORT} ${REMOTE_USER}:${REMOTE_HOST}:${REMOTE_PATH}..."
  ssh -p $REMOTE_PORT ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_PATH} && pwd && mkdir -p ${REMOTE_PATH}"
  
  echo "📦 Syncing local files from ${LOCAL_PATH} to remote..."
  # Build rsync exclude args from REMOTE_SYNC_EXCLUDES
  IFS=',' read -r -a __raw_excludes <<< "${REMOTE_SYNC_EXCLUDES// /,}"
  RSYNC_EXCLUDE_ARGS=("--exclude=.git")
  for ex in "${__raw_excludes[@]}"; do
    ex_trimmed=$(printf "%s" "$ex" | sed 's/^\s\+//;s/\s\+$//')
    if [ -n "$ex_trimmed" ]; then
      RSYNC_EXCLUDE_ARGS+=("--exclude=$ex_trimmed")
    fi
  done
  echo "Using rsync excludes: ${RSYNC_EXCLUDE_ARGS[*]}"
  rsync -avz "${RSYNC_EXCLUDE_ARGS[@]}" --progress -e "ssh -p $REMOTE_PORT" "$LOCAL_PATH/" ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/
  
  echo "🐳 Running docker compose up on remote host..."
  ssh -p $REMOTE_PORT ${REMOTE_USER}@${REMOTE_HOST} << EOF
  cd ${REMOTE_PATH}
  docker compose up -d --force-recreate
  echo "⏳ Waiting 5 seconds for containers to start..."
  sleep 5
  echo "📜 Tailing last 100 lines of logs from 'web' service..."
  docker compose logs --tail=100
EOF
  
  echo "✅ Deployment complete."
}

# Function to deploy domain configuration to Traefik gateway
function deploy_domain {
  echo "Starting domain deployment to Traefik gateway..."
  
  # Validate domain environment variables
  if ! validate_domain_env_vars; then
    return 1
  fi
  
  # Preview the proxy file and ask for confirmation
  echo "Preview of the proxy file to be deployed:"
  echo "------------------------"
  cat "${LOCAL_PATH}/${DOMAIN_CONFIG_FILE}"
  echo "------------------------"

  echo "Preview of the remote path to copy into:"
  echo "------------------------"
  echo "${DOMAIN_REMOTE_TRAEFIK_PATH}/${REMOTE_DOMAIN_CONFIG_FILENAME}"
  echo "------------------------"
  
  echo "Do you want to continue with the deployment? (y/n)"
  read -r confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    return 1
  fi
  
  echo "🔄 Deploying domain configuration to ${DOMAIN_REMOTE_HOST}..."
  
  echo "🔧 Checking if remote Traefik directory exists..."
  ssh -p $DOMAIN_REMOTE_PORT ${DOMAIN_REMOTE_USER}@${DOMAIN_REMOTE_HOST} "mkdir -p ${DOMAIN_REMOTE_TRAEFIK_PATH}"
  
  echo "📦 Copying Traefik configuration to remote server..."
  
  # Copy the proxy file directly to the remote server
  scp -P $DOMAIN_REMOTE_PORT "${LOCAL_PATH}/${DOMAIN_CONFIG_FILE}" ${DOMAIN_REMOTE_USER}@${DOMAIN_REMOTE_HOST}:${DOMAIN_REMOTE_TRAEFIK_PATH}/${REMOTE_DOMAIN_CONFIG_FILENAME}
  
  echo "🔄 Verifying file was copied successfully..."
  ssh -p $DOMAIN_REMOTE_PORT ${DOMAIN_REMOTE_USER}@${DOMAIN_REMOTE_HOST} "ls -la ${DOMAIN_REMOTE_TRAEFIK_PATH}/${REMOTE_DOMAIN_CONFIG_FILENAME}"
  
  echo "✅ Domain configuration deployment complete."
  echo "🌐 Your API should now be accessible at: https://${PUBLISHED_DOMAIN}"
  
  echo "cURL to test the API:"
  echo "curl https://${PUBLISHED_DOMAIN}/health"
  
  # Try curl each 5s
  N=0
  while true; do
    echo "Waiting for API to be accessible... ($N times)"
    
    if curl "https://${PUBLISHED_DOMAIN}/health" | grep -q "ok"; then
      echo "✅ API is now accessible at: https://${PUBLISHED_DOMAIN}"
      break
    fi
    if curl -s -o /dev/null -w "%{http_code}" "https://${PUBLISHED_DOMAIN}" | grep -q "20"; then
      echo "✅ API is now accessible at: https://${PUBLISHED_DOMAIN}"
      break
    fi
    sleep 5
    N=$((N+1))
  done
}

# Function to show environment variables
function show_env_vars {
  echo "===== Current Environment Variables ====="
  echo "REMOTE_HOST: ${REMOTE_HOST}"
  echo "REMOTE_USER: ${REMOTE_USER}"
  echo "REMOTE_PORT: ${REMOTE_PORT}"
  echo "REMOTE_PATH: ${REMOTE_PATH}"
  echo "DOMAIN_REMOTE_HOST: ${DOMAIN_REMOTE_HOST}"
  echo "DOMAIN_REMOTE_USER: ${DOMAIN_REMOTE_USER}"
  echo "DOMAIN_REMOTE_PORT: ${DOMAIN_REMOTE_PORT}"
  echo "DOMAIN_CONFIG_FILE: ${DOMAIN_CONFIG_FILE}"
  echo "REMOTE_SERVICE_IP: ${REMOTE_SERVICE_IP}"
  echo "PUBLISHED_DOMAIN: ${PUBLISHED_DOMAIN}"
  echo "REMOTE_SYNC_EXCLUDES: ${REMOTE_SYNC_EXCLUDES}"
}

# Function to display help
function show_help {
  echo "===== $APP_NAME Management Script ====="
  echo "Usage: ./manage.sh [OPTION]"
  echo ""
  echo "Options:"
  echo "  logs    - Follow logs in remote server"
  echo "  deploy  - Deploy application to remote server"
  echo "  proxy   - Create proxy configuration file"
  echo "  domain  - Deploy domain to remote (Traefik gateway)"
  echo "  env     - Show environment variables"
  echo "  help    - Show this help message"
  echo ""
  echo "If no option is provided, an interactive menu will be displayed."
}

# Function to display interactive menu
function show_menu {
  echo "Displaying interactive menu..."
  
  echo "===== $APP_NAME Management ====="
  PS3="Please select an option: "
  options=(
    "Follow logs in remote" 
    "Deploy to remote" 
    "Create proxy configuration file"
    "Deploy domain to remote (Traefik gateway)"
    "Show environment variables"
    "Exit"
  )
  
  select opt in "${options[@]}"
  do
    case $opt in
      "Follow logs in remote")
        follow_logs
        break
        ;;
      "Deploy to remote")
        deploy_app
        break
        ;;
      "Create proxy configuration file")
        create_proxy_file
        break
        ;;
      "Deploy domain to remote (Traefik gateway)")
        deploy_domain
        break
        ;;
      "Show environment variables")
        show_env_vars
        break
        ;;
      "Exit")
        echo "Exiting..."
        exit 0
        ;;
      *) 
        echo "Invalid option. Please try again."
        ;;
    esac
  done
}

# Traefik configuration template
TRAEFIK_TEMPLATE="http:
  routers:
    SERVICE_NAME:
      entryPoints:
        - https
      service: SERVICE_NAME
      rule: Host(\`_PUBLISHED_DOMAIN_\`)
      tls:
        certresolver: letsencrypt
  services:
    SERVICE_NAME:
      loadBalancer:
        servers:
          -
            url: 'REMOTE_SERVICE_IP'"

# Function to create proxy file
function create_proxy_file {
  echo "Creating proxy file..."
  
  # Validate required environment variables
  if [ -z "${REMOTE_SERVICE_IP}" ]; then
    echo "❌ Error: REMOTE_SERVICE_IP is not set in .env"
    return 1
  fi
  
  if [ -z "${PUBLISHED_DOMAIN}" ]; then
    echo "❌ Error: PUBLISHED_DOMAIN is not set in .env"
    return 1
  fi
  
  #compute to APP_NAME but without spaces (replace with -) and lowercase
  EXAMPLE_SERVICE_NAME=${APP_NAME// /-}
  EXAMPLE_SERVICE_NAME=${EXAMPLE_SERVICE_NAME,,}

  # Prompt for service name
  echo "Enter the Traefik service name (default: $EXAMPLE_SERVICE_NAME):"
  read -r SERVICE_NAME
  
  if [ -z "$SERVICE_NAME" ]; then
    SERVICE_NAME=$EXAMPLE_SERVICE_NAME
  fi
  
  # Create proxy file from template
  echo "🔧 Creating proxy file ${DOMAIN_CONFIG_FILE}..."

    # Print variables to inject
  echo "Service name: $SERVICE_NAME"
  echo "Published domain: $PUBLISHED_DOMAIN"
  echo "Remote service IP: $REMOTE_SERVICE_IP"
  
  # Replace placeholders in template
  # Use a temporary file to avoid issues with special characters in variables
  TEMP_TEMPLATE="${LOCAL_PATH}/.temp_template.yml"
  echo "$TRAEFIK_TEMPLATE" > "$TEMP_TEMPLATE"
  
  # Replace placeholders one by one with proper escaping
  sed -i "s|SERVICE_NAME|${SERVICE_NAME}|g" "$TEMP_TEMPLATE"
  sed -i "s|_PUBLISHED_DOMAIN_|${PUBLISHED_DOMAIN}|g" "$TEMP_TEMPLATE"
  sed -i "s|REMOTE_SERVICE_IP|${REMOTE_SERVICE_IP}|g" "$TEMP_TEMPLATE"
  
  # Move the processed template to the final destination
  mv "$TEMP_TEMPLATE" "${LOCAL_PATH}/${DOMAIN_CONFIG_FILE}"
  
  echo "✅ Proxy file created successfully at ${LOCAL_PATH}/${DOMAIN_CONFIG_FILE}"
  echo "Preview of the proxy file:"
  echo "------------------------"
  cat "${LOCAL_PATH}/${DOMAIN_CONFIG_FILE}"
  echo "------------------------"

  return 0
}

# Main script execution
# Check if a command line argument was provided
if [ $# -eq 0 ]; then
  # No arguments provided, show interactive menu
  show_menu
else
  # Process command line arguments
  case "$1" in
    logs)
      follow_logs
      ;;
    deploy)
      deploy_app
      ;;
    proxy)
      create_proxy_file
      ;;
    domain)
      deploy_domain
      ;;
    env)
      show_env_vars
      ;;
    help)
      show_help
      ;;
    *)
      echo "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
fi
