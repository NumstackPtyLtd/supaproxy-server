/**
 * Auth Manager — Azure AD integration (same provider as external-auth-provider)
 *
 * Pattern ported from external-auth-provider:
 * - Azure AD OAuth2 with ID tokens + refresh
 * - Permission model with anyOf/allOf checks
 * - Token refresh on expiry
 *
 * For the MVP, Slack user ID is the primary identity. Azure AD integration
 * kicks in for the web dashboard and API consumers.
 */
import type { Permission, SupaproxyUser, HasPermissionProps } from '../shared/index.js'
import { hasPermission } from '../shared/index.js'
import pino from 'pino'

const log = pino({ name: 'auth-manager' })

// Azure AD config (from environment) — lazy-loaded so server starts without Azure vars
let _azureConfig: { tenantId: string; clientId: string; clientSecret: string; redirectUri: string } | null = null

export function getAzureConfig() {
  if (!_azureConfig) {
    const tenantId = process.env.AZURE_AD_TENANT_ID
    const clientId = process.env.AZURE_AD_CLIENT_ID
    const clientSecret = process.env.AZURE_AD_CLIENT_SECRET
    const redirectUri = process.env.AZURE_AD_REDIRECT_URI
    if (!tenantId || !clientId || !clientSecret || !redirectUri) {
      throw new Error(
        'Azure AD not configured. Set AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, and AZURE_AD_REDIRECT_URI.'
      )
    }
    _azureConfig = { tenantId, clientId, clientSecret, redirectUri }
  }
  return _azureConfig
}

/**
 * Refresh an Azure AD access token using a refresh token.
 * Ported from external-auth-provider/src/configs/auth.tsx
 */
export async function refreshAccessToken(refreshToken: string) {
  const config = getAzureConfig()
  const res = await fetch(
    `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: 'openid profile email offline_access',
      }),
    },
  )

  const tokens = await res.json()

  if (!res.ok) {
    log.error({ error: tokens.error_description }, 'Token refresh failed')
    throw new Error(tokens.error_description)
  }

  return {
    refreshToken: tokens.refresh_token ?? refreshToken,
    expiresIn: tokens.expires_in as number,
    idToken: tokens.id_token as string,
    accessToken: tokens.access_token as string,
  }
}

/**
 * Resolve a Slack user to a SupaproxyUser.
 *
 * MVP: lookup from a static map (workspace config).
 * Production: Slack user → email → Azure AD identity → roles → permissions.
 */
export function resolveSlackUser(
  slackUserId: string,
  slackUserName?: string,
): SupaproxyUser {
  // MVP: all Slack users get basic read permissions
  // Production: lookup in DB, map to Azure AD identity, resolve roles
  return {
    id: slackUserId,
    name: slackUserName ?? slackUserId,
    email: '',
    permissions: [
      'ViewWorkspaces' as Permission,
      'UseReadTools' as Permission,
      'ViewDashboard' as Permission,
    ],
    workspaces: [], // filled by the consumer based on channel
  }
}

/**
 * Check if a user has the required permissions.
 * Same pattern as external-auth-provider's hasPermission.
 */
export function checkPermission(user: SupaproxyUser, required: HasPermissionProps): boolean {
  return hasPermission(user.permissions as string[], required)
}

/**
 * Middleware-style permission check for Hono routes.
 */
export function requirePermission(...permissions: Permission[]) {
  return {
    anyOf: permissions,
  } satisfies HasPermissionProps
}
