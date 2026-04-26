import { z } from 'zod'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

interface ValidationSuccess<T> {
  success: true
  data: T
}

interface ValidationFailure {
  success: false
  response: Response & { status: ContentfulStatusCode }
}

type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure

/**
 * Parse and validate a JSON request body against a Zod schema.
 *
 * @example
 * const result = await parseBody(c, MySchema)
 * if (!result.success) return result.response
 * const { name, email } = result.data
 */
export async function parseBody<T extends z.ZodType>(
  c: Context,
  schema: T
): Promise<ValidationResult<z.infer<T>>> {
  const body = await c.req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fields[issue.path.join('.') || '_root'] = issue.message
    }
    return {
      success: false,
      response: c.json({ error: 'Validation failed', fields }, 400) as Response & { status: ContentfulStatusCode },
    }
  }
  return { success: true, data: parsed.data }
}

/**
 * Build a 400 validation-error response manually (for cases not
 * covered by `parseBody`, e.g. query-param validation).
 */
export function validationError(c: Context, fields: Record<string, string>) {
  return c.json({ error: 'Validation failed', fields }, 400)
}
