import type { OrganisationRepository } from '../../domain/organisation/repository.js'
import type { PasswordService } from '../ports/PasswordService.js'
import type { TokenService } from '../ports/TokenService.js'
import { AuthenticationError } from '../../domain/shared/errors.js'

interface LoginInput {
  email: string
  password: string
}

interface LoginOutput {
  token: string
  user: { id: string; email: string; name: string; role: string }
}

export class LoginUseCase {
  constructor(
    private readonly orgRepo: OrganisationRepository,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const user = await this.orgRepo.findUserByEmail(input.email)
    if (!user) throw new AuthenticationError()

    const valid = await this.passwordService.verify(input.password, user.password_hash)
    if (!valid) throw new AuthenticationError()

    const token = this.tokenService.sign({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.org_role,
      org_id: user.org_id || '',
    })

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.org_role },
    }
  }
}
