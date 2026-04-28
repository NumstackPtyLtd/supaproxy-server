import { describe, it, expect, vi } from 'vitest'
import { mockOrgRepo, mockPasswordService, mockTokenService, stubUser } from '../../__tests__/mocks.js'
import { LoginUseCase } from './LoginUseCase.js'
import { AuthenticationError } from '../../domain/shared/errors.js'

describe('LoginUseCase', () => {
  function setup() {
    const orgRepo = mockOrgRepo()
    const passwordService = mockPasswordService()
    const tokenService = mockTokenService()
    const useCase = new LoginUseCase(orgRepo, passwordService, tokenService)
    return { orgRepo, passwordService, tokenService, useCase }
  }

  it('execute with valid credentials returns token and user', async () => {
    const { orgRepo, passwordService, tokenService, useCase } = setup()
    const user = stubUser()
    vi.mocked(orgRepo.findUserByEmail).mockResolvedValue(user)
    vi.mocked(passwordService.verify).mockResolvedValue(true)
    vi.mocked(tokenService.sign).mockReturnValue('jwt-token')

    const result = await useCase.execute({ email: 'test@example.com', password: 'password123' })

    expect(orgRepo.findUserByEmail).toHaveBeenCalledWith('test@example.com')
    expect(passwordService.verify).toHaveBeenCalledWith('password123', user.password_hash)
    expect(tokenService.sign).toHaveBeenCalledWith({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.org_role,
      org_id: user.org_id,
    })
    expect(result).toEqual({
      token: 'jwt-token',
      user: { id: user.id, email: user.email, name: user.name, role: user.org_role },
    })
  })

  it('execute with unknown email throws AuthenticationError', async () => {
    const { orgRepo, useCase } = setup()
    vi.mocked(orgRepo.findUserByEmail).mockResolvedValue(null)

    await expect(useCase.execute({ email: 'unknown@example.com', password: 'password123' }))
      .rejects.toThrow(AuthenticationError)
  })

  it('execute with wrong password throws AuthenticationError', async () => {
    const { orgRepo, passwordService, useCase } = setup()
    vi.mocked(orgRepo.findUserByEmail).mockResolvedValue(stubUser())
    vi.mocked(passwordService.verify).mockResolvedValue(false)

    await expect(useCase.execute({ email: 'test@example.com', password: 'wrong-password' }))
      .rejects.toThrow(AuthenticationError)
  })
})
