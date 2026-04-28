export interface TokenPayload {
  id: string
  email: string
  name: string
  role: string
  org_id: string
}

export interface TokenService {
  sign(payload: TokenPayload): string
  verify(token: string): TokenPayload | null
}
