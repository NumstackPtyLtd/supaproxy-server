export interface PasswordService {
  hash(password: string): Promise<string>
  verify(password: string, storedHash: string): Promise<boolean>
}
