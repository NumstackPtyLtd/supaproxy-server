import { describe, it, expect } from 'vitest'
import {
  DomainError,
  NotFoundError,
  ConflictError,
  ValidationError,
  AuthenticationError,
  ConfigurationError,
} from './errors.js'

describe('DomainError', () => {
  it('has the correct name, message, and code', () => {
    const error = new DomainError('something broke', 'CUSTOM')
    expect(error.name).toBe('DomainError')
    expect(error.message).toBe('something broke')
    expect(error.code).toBe('CUSTOM')
  })

  it('is an instance of Error', () => {
    expect(new DomainError('x', 'Y')).toBeInstanceOf(Error)
  })
})

describe('NotFoundError', () => {
  it('has the correct name, message, and code', () => {
    const error = new NotFoundError('User', '123')
    expect(error.name).toBe('NotFoundError')
    expect(error.message).toBe('User not found: 123')
    expect(error.code).toBe('NOT_FOUND')
  })

  it('is an instance of DomainError', () => {
    expect(new NotFoundError('User', '1')).toBeInstanceOf(DomainError)
  })
})

describe('ConflictError', () => {
  it('has the correct name, message, and code', () => {
    const error = new ConflictError('already exists')
    expect(error.name).toBe('ConflictError')
    expect(error.message).toBe('already exists')
    expect(error.code).toBe('CONFLICT')
  })

  it('is an instance of DomainError', () => {
    expect(new ConflictError('x')).toBeInstanceOf(DomainError)
  })
})

describe('ValidationError', () => {
  it('has the correct name, message, and code', () => {
    const error = new ValidationError('bad input')
    expect(error.name).toBe('ValidationError')
    expect(error.message).toBe('bad input')
    expect(error.code).toBe('VALIDATION')
  })

  it('exposes the fields property when provided', () => {
    const fields = { email: 'required', name: 'too short' }
    const error = new ValidationError('invalid', fields)
    expect(error.fields).toEqual(fields)
  })

  it('has undefined fields when not provided', () => {
    const error = new ValidationError('invalid')
    expect(error.fields).toBeUndefined()
  })

  it('is an instance of DomainError', () => {
    expect(new ValidationError('x')).toBeInstanceOf(DomainError)
  })
})

describe('AuthenticationError', () => {
  it('has the correct name, default message, and code', () => {
    const error = new AuthenticationError()
    expect(error.name).toBe('AuthenticationError')
    expect(error.message).toBe('Invalid credentials.')
    expect(error.code).toBe('AUTHENTICATION')
  })

  it('accepts a custom message', () => {
    const error = new AuthenticationError('token expired')
    expect(error.message).toBe('token expired')
  })

  it('is an instance of DomainError', () => {
    expect(new AuthenticationError()).toBeInstanceOf(DomainError)
  })
})

describe('ConfigurationError', () => {
  it('has the correct name, message, and code', () => {
    const error = new ConfigurationError('missing env var')
    expect(error.name).toBe('ConfigurationError')
    expect(error.message).toBe('missing env var')
    expect(error.code).toBe('CONFIGURATION')
  })

  it('is an instance of DomainError', () => {
    expect(new ConfigurationError('x')).toBeInstanceOf(DomainError)
  })
})
