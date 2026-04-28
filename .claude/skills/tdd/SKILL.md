---
name: tdd
description: >
  Enforces Test-Driven Development. Tests MUST be written BEFORE implementation.
  Covers the red-green-refactor cycle for use cases, infrastructure adapters,
  and domain logic. Run before writing any new code.
---

# Test-Driven Development (TDD)

Every code change follows the red-green-refactor cycle. Tests are written FIRST, then implementation, then cleanup.

## The TDD cycle (MANDATORY)

### 1. RED: Write a failing test

Before writing ANY implementation code, write a test that describes the expected behaviour:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { mockWorkspaceRepo } from '../../__tests__/mocks.js'
import { NewFeatureUseCase } from './NewFeatureUseCase.js'

describe('NewFeatureUseCase', () => {
  it('does the expected thing', async () => {
    const wsRepo = mockWorkspaceRepo()
    vi.mocked(wsRepo.findById).mockResolvedValue(stubWorkspace())
    const useCase = new NewFeatureUseCase(wsRepo)

    const result = await useCase.execute('ws-test')

    expect(result).toBeDefined()
    expect(wsRepo.findById).toHaveBeenCalledWith('ws-test')
  })
})
```

Run the test. It MUST fail (red):
```bash
npx vitest run src/application/workspace/NewFeatureUseCase.test.ts
```

### 2. GREEN: Write minimal implementation

Write the simplest code that makes the test pass:

```typescript
export class NewFeatureUseCase {
  constructor(private readonly wsRepo: WorkspaceRepository) {}

  async execute(workspaceId: string) {
    return this.wsRepo.findById(workspaceId)
  }
}
```

Run the test. It MUST pass (green):
```bash
npx vitest run src/application/workspace/NewFeatureUseCase.test.ts
```

### 3. REFACTOR: Clean up

Improve the code without changing behaviour. Run tests again to confirm nothing broke:
```bash
npx vitest run
```

## What to test by layer

### Domain layer (pure unit tests, no mocks)
- `domain/shared/EntityId.ts` - ID generation, slug generation
- `domain/shared/errors.ts` - error classes, messages, codes
- Test file location: colocated (e.g. `EntityId.test.ts`)

### Application layer (mock all dependencies)
- Every use case gets a test file
- Mock repositories and ports using `src/__tests__/mocks.ts`
- Test happy path, error cases, edge cases
- Verify correct repository/port methods are called
- Test file location: colocated (e.g. `LoginUseCase.test.ts`)

```typescript
// Pattern for use case tests
import { mockOrgRepo, mockPasswordService, mockTokenService, stubUser } from '../../__tests__/mocks.js'

describe('LoginUseCase', () => {
  it('returns token for valid credentials', async () => {
    const orgRepo = mockOrgRepo()
    vi.mocked(orgRepo.findUserByEmail).mockResolvedValue(stubUser())
    const passwordService = mockPasswordService()
    const tokenService = mockTokenService()

    const useCase = new LoginUseCase(orgRepo, passwordService, tokenService)
    const result = await useCase.execute({ email: 'test@example.com', password: 'password' })

    expect(result.token).toBe('mock-token')
  })

  it('throws AuthenticationError for unknown email', async () => {
    const orgRepo = mockOrgRepo()
    // findUserByEmail returns null by default
    const useCase = new LoginUseCase(orgRepo, mockPasswordService(), mockTokenService())

    await expect(useCase.execute({ email: 'nobody@example.com', password: 'x' }))
      .rejects.toThrow(AuthenticationError)
  })
})
```

### Infrastructure layer (test concrete implementations)
- BcryptPasswordService: hash and verify
- JwtTokenService: sign and verify
- ConsumerPosterRegistryImpl: register and post
- Test file location: colocated
- No mocks needed for pure implementations

### Presentation layer (test middleware with Hono test client)
- parseBody: valid input, invalid input, missing body
- requireAuth: no token, invalid token, valid token
- optionalAuth: no token, invalid token, valid token

```typescript
// Pattern for middleware tests
const app = new Hono()
app.use('/api/*', requireAuth)
app.get('/api/test', (c) => c.json({ ok: true }))

const res = await app.request('/api/test', {
  headers: { Cookie: 'supaproxy_session=valid-token' },
})
expect(res.status).toBe(200)
```

## Mock helpers

All mock factories live in `src/__tests__/mocks.ts`. Available factories:

| Factory | Returns |
|---|---|
| `mockOrgRepo()` | OrganisationRepository with all methods stubbed |
| `mockWorkspaceRepo()` | WorkspaceRepository with all methods stubbed |
| `mockConversationRepo()` | ConversationRepository with all methods stubbed |
| `mockAuditRepo()` | AuditLogRepository with all methods stubbed |
| `mockPasswordService()` | PasswordService (hash returns 'hashed-password') |
| `mockTokenService()` | TokenService (sign returns 'mock-token') |
| `mockQueueService()` | QueueService with all methods stubbed |
| `mockIntegrationTester()` | IntegrationTester (returns ok) |
| `mockMcpFactory()` | McpClientFactory with mock connection |
| `mockAIProvider()` | AIProvider returning text response |
| `mockModelRepo()` | ModelRepository returning one model |
| `mockPosterRegistry()` | ConsumerPosterRegistry |
| `stubUser()` | UserData with defaults |
| `stubWorkspace()` | WorkspaceData with defaults |
| `stubConversation()` | ConversationData with defaults |
| `stubConnection()` | ConnectionData with defaults |
| `stubConsumer()` | ConsumerData with defaults |

Override defaults with partial objects:
```typescript
stubUser({ email: 'custom@example.com', org_role: 'member' })
```

## Rules (ENFORCED)

1. **Tests FIRST.** Never write implementation before the test exists and fails.
2. **Every use case has a test file.** No exceptions.
3. **Every domain function has a test.** No exceptions.
4. **Every infrastructure adapter has a test.** No exceptions for adapters with testable logic.
5. **Mock at boundaries.** Use the mock factories. Never mock internal methods.
6. **Test names describe behaviour.** "throws NotFoundError when workspace does not exist", not "test case 3".
7. **One assertion per logical concept.** Multiple expects in a test are fine if they verify one behaviour.
8. **All tests must pass before committing.** Run `npx vitest run` before every commit.
9. **New test files for new features.** When running `/add-api-route`, write the use case test BEFORE the use case.

## Running tests

```bash
npx vitest run                          # All tests
npx vitest run src/application/auth/    # Tests in a directory
npx vitest run LoginUseCase.test.ts     # Single file
npx vitest --watch                      # Watch mode during development
```

## When to run this skill

- Before starting any new feature
- When a PR is missing test coverage
- To verify the TDD cycle is being followed
- As a refresher on testing patterns
