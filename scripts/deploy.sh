#!/usr/bin/env bash
#
# Trigger a Coolify deployment and wait for the result.
#
#   scripts/deploy.sh api     # backend/  -> tracked-api
#   scripts/deploy.sh web     # frontend/ -> tracked-web
#   scripts/deploy.sh all     # both, one after the other
#
# Environment:
#   COOLIFY_URL    base URL of the Coolify instance, e.g. https://coolify.example.com
#   COOLIFY_TOKEN  Coolify API token with the deploy ability
#
# Used by .github/workflows/deploy-*.yml on pushes to main, and just as useful
# from a terminal. Exits non-zero when a deployment fails, so CI goes red.
set -euo pipefail

# Application UUIDs in Coolify. Override with the environment if the resources
# are ever recreated (Coolify → app → the uuid in the URL).
APP_API="${COOLIFY_APP_API:-eflvv8s2turwoceyhqwidt5z}"
APP_WEB="${COOLIFY_APP_WEB:-wch2xf2obvaazogtim1advqu}"

INTERVAL="${COOLIFY_POLL_INTERVAL:-10}"   # seconds between status checks
TIMEOUT="${COOLIFY_TIMEOUT:-2400}"        # give up after 40 minutes

usage() {
  sed -n '3,10p' "$0" | sed 's/^# \{0,1\}//'
}

# Read one field out of a JSON string: json_field '<json>' 'a.b.0.c'
# Uses jq when present, but falls back to python3 so this works anywhere.
json_field() {
  local json="$1" path="$2"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$json" | jq -r --arg p "$path" '
      getpath($p | split(".") | map(if test("^[0-9]+$") then tonumber else . end)) // empty
    '
  else
    printf '%s' "$json" | python3 -c '
import json, sys
data = json.load(sys.stdin)
for key in sys.argv[1].split("."):
    if isinstance(data, list):
        data = data[int(key)] if key.isdigit() and int(key) < len(data) else None
    elif isinstance(data, dict):
        data = data.get(key)
    else:
        data = None
    if data is None:
        break
print("" if data is None else data)
' "$path"
  fi
}

get() { curl -sS -H "Authorization: Bearer ${COOLIFY_TOKEN}" -H "Accept: application/json" "$@"; }

trigger() { # trigger <uuid> <label> -> prints the deployment uuid
  local uuid="$1" label="$2" response deployment
  if ! response=$(curl -sS -X POST -H "Authorization: Bearer ${COOLIFY_TOKEN}" \
      -H "Accept: application/json" "${COOLIFY_URL}/api/v1/deploy?uuid=${uuid}"); then
    echo "ERROR: could not reach ${COOLIFY_URL}" >&2
    return 1
  fi

  deployment=$(json_field "$response" "deployments.0.deployment_uuid")
  [ -n "$deployment" ] || deployment=$(json_field "$response" "deployment_uuid")

  if [ -z "$deployment" ]; then
    echo "ERROR: ${label} was not queued. Coolify said: ${response}" >&2
    return 1
  fi

  # stderr so that callers can capture the uuid from stdout on its own.
  echo "  ${label}: queued (deployment ${deployment})" >&2
  echo "$deployment"
}

wait_for() { # wait_for <deployment-uuid> <label>
  local deployment="$1" label="$2" status="" elapsed=0 body new_status

  while [ "$elapsed" -lt "$TIMEOUT" ]; do
    body=$(get "${COOLIFY_URL}/api/v1/deployments/${deployment}") || body="{}"
    new_status=$(json_field "$body" "status")

    if [ -n "$new_status" ] && [ "$new_status" != "$status" ]; then
      echo "  ${label}: ${new_status}"
      status="$new_status"
    fi

    case "$status" in
      finished)
        return 0
        ;;
      failed|cancelled)
        # Deployment logs need the read:sensitive token ability; link to the UI
        # so the failure can be inspected there.
        echo "  ${label}: ${status} — inspect at ${COOLIFY_URL}$(json_field "$body" "deployment_url")" >&2
        return 1
        ;;
    esac

    sleep "$INTERVAL"
    elapsed=$((elapsed + INTERVAL))
  done

  echo "ERROR: ${label} did not finish within ${TIMEOUT}s" >&2
  return 1
}

main() {
  local target="${1:-all}"

  case "$target" in
    -h|--help|help) usage; return 0 ;;
    api|web|all) ;;
    *) echo "ERROR: unknown target '${target}'" >&2; usage >&2; return 2 ;;
  esac

  if [ -z "${COOLIFY_URL:-}" ] || [ -z "${COOLIFY_TOKEN:-}" ]; then
    local message="COOLIFY_URL and COOLIFY_TOKEN must both be set."
    if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
      echo "::warning::${message} Skipping the deployment."
      echo "  Add them under Settings → Secrets and variables → Actions:"
      echo "    COOLIFY_URL    e.g. https://your-coolify-host"
      echo "    COOLIFY_TOKEN  a Coolify token with the deploy ability"
      return 0
    fi
    echo "ERROR: ${message}" >&2
    echo "  Create a token in Coolify → Keys & Tokens, then:" >&2
    echo "    COOLIFY_URL=https://your-coolify-host COOLIFY_TOKEN=... $0 ${target}" >&2
    return 1
  fi

  COOLIFY_URL="${COOLIFY_URL%/}" # no trailing slash

  local uuids label
  case "$target" in
    api) uuids="$APP_API"; label="tracked-api" ;;
    web) uuids="$APP_WEB"; label="tracked-web" ;;
    all) uuids="$APP_API $APP_WEB"; label="" ;;
  esac

  local deployment
  for uuid in $uuids; do
    if [ "$target" = "all" ]; then
      if [ "$uuid" = "$APP_API" ]; then label="tracked-api"; else label="tracked-web"; fi
    fi
    deployment=$(trigger "$uuid" "$label") || return 1
    wait_for "$deployment" "$label" || return 1
  done

  echo "Deployment succeeded."
}

main "$@"
