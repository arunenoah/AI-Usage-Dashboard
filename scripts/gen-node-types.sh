#!/bin/bash
set -e

echo "Generating TypeScript types from JSON Schema..."
npx json-schema-to-typescript \
  schemas/models.schema.json \
  --output backends/nodejs/src/types/models.ts \
  --declareExternallyReferenced \
  --unreachableDefinitions

echo "✓ TypeScript types generated at backends/nodejs/src/types/models.ts"
