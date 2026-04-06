#!/usr/bin/env bash
set -e

# ─── Colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[deploy]${NC} $1"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $1"; }
error() { echo -e "${RED}[error]${NC} $1"; exit 1; }

# ─── 1. Vercel CLI ─────────────────────────────────────────────────────────────
if ! command -v vercel &>/dev/null; then
  info "Installing Vercel CLI..."
  npm install -g vercel
fi

# ─── 2. Login check ────────────────────────────────────────────────────────────
if ! vercel whoami &>/dev/null; then
  info "Not logged in — opening Vercel login..."
  vercel login
fi

info "Logged in as: $(vercel whoami)"

# ─── 3. Link project (skip if already linked) ──────────────────────────────────
PROJECT_NAME="brisbane-bayside-driving"

if [ ! -f ".vercel/project.json" ]; then
  info "Linking project to Vercel as '$PROJECT_NAME'..."
  vercel link --yes --project "$PROJECT_NAME"
fi

# ─── 4. Read .env.local ────────────────────────────────────────────────────────
ENV_FILE=".env.local"
if [ ! -f "$ENV_FILE" ]; then
  error "$ENV_FILE not found. Create it with your environment variables first."
fi

# ─── 5. Sync env vars to Vercel (production + preview) ────────────────────────
info "Syncing environment variables to Vercel..."

push_env() {
  local key="$1"
  local value="$2"
  local targets=("production" "preview")
  for target in "${targets[@]}"; do
    # Remove existing value silently, then add new one
    vercel env rm "$key" "$target" --yes 2>/dev/null || true
    # printf '%s' avoids the trailing newline that echo adds
    printf '%s' "$value" | vercel env add "$key" "$target" 2>/dev/null && \
      info "  ✓ $key → $target" || \
      warn "  ! Failed to set $key for $target"
  done
}

# Parse .env.local — skip comments and blank lines
while IFS='=' read -r key rest; do
  # Skip blank lines and comments
  [[ -z "$key" || "$key" == \#* ]] && continue
  # Reconstruct value (handles values containing '=')
  value="$rest"
  # Strip surrounding quotes if present
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  # Strip carriage returns (Windows line endings)
  value="${value//$'\r'/}"
  push_env "$key" "$value"
done < <(grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$')

# ─── 6. Run DB migrations ──────────────────────────────────────────────────────
info "Running database migrations..."

# Extract values from .env.local
SUPABASE_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | head -1 | cut -d'=' -f2- | tr -d '"'"'" | tr -d $'\r')
SERVICE_ROLE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$ENV_FILE" | head -1 | cut -d'=' -f2- | tr -d '"'"'" | tr -d $'\r')

if [[ -z "$SUPABASE_URL" || -z "$SERVICE_ROLE_KEY" ]]; then
  warn "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in $ENV_FILE — skipping migrations."
else
  MIGRATION_FILE="supabase/schema.sql"
  if [ ! -f "$MIGRATION_FILE" ]; then
    warn "$MIGRATION_FILE not found — skipping migrations."
  else
    # Extract project ref from URL: https://<ref>.supabase.co
    PROJECT_REF=$(echo "$SUPABASE_URL" | sed -E 's|https://([^.]+)\.supabase\.co.*|\1|')
    SQL=$(cat "$MIGRATION_FILE")

    HTTP_STATUS=$(curl -s -o /tmp/migration_response.json -w "%{http_code}" \
      -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
      -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"query\": $(echo "$SQL" | jq -Rs .)}")

    if [[ "$HTTP_STATUS" == "200" || "$HTTP_STATUS" == "201" ]]; then
      info "Migrations applied successfully."
    else
      warn "Migration returned HTTP $HTTP_STATUS. Response:"
      cat /tmp/migration_response.json
      warn "Continuing deploy — check Supabase dashboard if needed."
    fi
  fi
fi

# ─── 7. Build check ────────────────────────────────────────────────────────────
info "Running local build check..."
npm run build || error "Build failed — fix errors before deploying."

# ─── 8. Deploy ─────────────────────────────────────────────────────────────────
info "Deploying to Vercel (production)..."
vercel --prod --yes

info "Done! Your app is live on Vercel."
