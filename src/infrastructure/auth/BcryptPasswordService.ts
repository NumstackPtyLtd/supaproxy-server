import bcrypt from 'bcrypt'
import type { PasswordService } from '../../application/ports/PasswordService.js'

const BCRYPT_ROUNDS = 12

export class BcryptPasswordService implements PasswordService {
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS)
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    // Support legacy SHA256 hashes (salt:hash format) during migration
    if (storedHash.includes(':') && storedHash.length < 200) {
      const { createHash } = await import('crypto')
      const [salt, hash] = storedHash.split(':')
      const check = createHash('sha256').update(password + salt).digest('hex')
      return check === hash
    }
    return bcrypt.compare(password, storedHash)
  }
}
