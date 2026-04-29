import { describe, it, expect } from 'vitest'
import { NoOpTenantService } from './NoOpTenantService.js'

describe('NoOpTenantService', () => {
  const service = new NoOpTenantService()

  it('scopeWorkspaceList returns null (no filtering)', () => {
    expect(service.scopeWorkspaceList('org-1')).toBeNull()
  })

  it('verifyWorkspaceAccess does not throw for any input', () => {
    expect(() => service.verifyWorkspaceAccess('org-1', 'org-2')).not.toThrow()
    expect(() => service.verifyWorkspaceAccess(null, 'org-1')).not.toThrow()
    expect(() => service.verifyWorkspaceAccess('org-1', 'org-1')).not.toThrow()
  })

  it('resolveOrgForCreation returns the user org', () => {
    expect(service.resolveOrgForCreation('org-abc')).toBe('org-abc')
  })
})
