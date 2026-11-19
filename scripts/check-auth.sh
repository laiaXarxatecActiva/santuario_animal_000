#!/usr/bin/env bash
# scripts/check-auth.sh
# Comprobaciones de seguridad de la autenticación (docs/AUTH_SPEC.md). Lo
# ejecuta el hook Stop de .claude/settings.json; un código 2 bloquea la respuesta.
# Va encadenado detrás de `npm test` en el MISMO hook: Claude Code ejecuta en
# paralelo los hooks de un evento, y dos Vitest a la vez reinician la misma base
# de datos de pruebas y se pisan (fallos al azar).
set -uo pipefail
cd "$(dirname "$0")/.." || exit 2

# 1. Patrones prohibidos en el código (no en los textos de los JSON de idiomas).
FORBIDDEN="localStorage|sessionStorage|Math\.random|jsonwebtoken|['\"]jose['\"]|console\.(log|info|debug)\(.*(password|token)"

# Usos permitidos, que no guardan ni generan secretos:
# - localStorage: tema, idioma y aviso de cookies (CookiesPage los enumera).
# - Math.random: resultado del pago simulado.
PERMITIDOS='^client/src/(components/ThemeToggle\.tsx|components/CookieNotice\.tsx|i18n/idioma\.ts|pages/public/CookiesPage\.tsx):.*localStorage|^server/src/services/payment/simulated\.gateway\.ts:.*Math\.random'

encontrados=$(grep -rnE --include='*.ts' --include='*.tsx' "$FORBIDDEN" server/src client/src shared/src | grep -vE "$PERMITIDOS")
if [ -n "$encontrados" ]; then
  echo "$encontrados" >&2
  echo "Patrón prohibido en el código. Revisa las reglas de docs/AUTH_SPEC.md." >&2
  exit 2
fi

# 2. Tests de autenticación y sesiones (docs/AUTH_SPEC.md §14).
TESTS_AUTH=(
  tests/auth.routes.test.ts
  tests/auth.service.test.ts
  tests/auth.middleware.test.ts
  tests/session.test.ts
  tests/models/session.model.test.ts
  tests/rate-limit.test.ts
  tests/token.test.ts
  tests/utils/passwords.test.ts
  tests/admin-user-sessions.routes.test.ts
)

if ! git diff --quiet HEAD -- "${TESTS_AUTH[@]/#/server/}"; then
  echo "Se han modificado tests de auth. No está permitido sin permiso." >&2
  exit 2
fi

if ! npm test --silent -w server -- "${TESTS_AUTH[@]}" --reporter=dot 1>&2; then
  echo "Los tests de auth fallan. Arregla el código, no los tests." >&2
  exit 2
fi
