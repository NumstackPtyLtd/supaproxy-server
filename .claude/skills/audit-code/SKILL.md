---
name: audit-code
description: >
  Comprehensive server code quality audit enforcing DDD, SOLID, and Clean Code
  principles. Checks layer boundaries, dependency direction, SRP compliance,
  type safety, security, and architecture violations. Run before PRs.
---

# Code Audit (Server) - DDD/SOLID/Clean Code

## Step 1: Sub-Audits

Run these skill audits first:
- `/no-defaults` - env var fallbacks
- `/prod-ready` - production safety

## Step 2: DDD Layer Boundary Violations (CRITICAL)

```bash
# Domain importing from infrastructure or presentation (MUST be zero)
grep -rn "from '.*infrastructure\|from '.*presentation" src/domain/ --include="*.ts"

# Application importing from infrastructure or presentation (MUST be zero)
grep -rn "from '.*infrastructure\|from '.*presentation" src/application/ --include="*.ts"

# Presentation importing from infrastructure (MUST be zero)
grep -rn "from '.*infrastructure" src/presentation/ --include="*.ts"

# Direct DB access outside infrastructure (MUST be zero)
grep -rn "getPool\|pool\.execute\|db\.execute" src/domain/ src/application/ src/presentation/ --include="*.ts"

# SQL in use cases or routes (MUST be zero)
grep -rn "SELECT \|INSERT \|UPDATE \|DELETE \|FROM " src/application/ src/presentation/ --include="*.ts"
```

Every violation is CRITICAL. The dependency rule is: presentation -> application -> domain <- infrastructure.

## Step 3: SOLID Violations

### SRP - Single Responsibility
```bash
# Use cases with more than one public method (should have only execute())
grep -rn "async " src/application/ --include="*.ts" | grep -v "private\|constructor\|execute" | grep -v "import\|//"

# Route handlers longer than 20 lines (likely contain business logic)
wc -l src/presentation/routes/*.ts | sort -rn | head -10

# Repository implementations with business logic
grep -rn "if.*throw\|for.*of\|\.map(\|\.filter(" src/infrastructure/persistence/ --include="*.ts" | grep -v "// "
```

### DIP - Dependency Inversion
```bash
# Concrete class instantiation outside container.ts (MUST be zero)
grep -rn "new Mysql\|new Bcrypt\|new Jwt\|new Anthropic\|new BullMq\|new McpClient" src/ --include="*.ts" | grep -v container.ts | grep -v node_modules

# Use cases depending on concrete types instead of interfaces
grep -rn "import.*from.*infrastructure" src/application/ --include="*.ts"
```

### ISP - Interface Segregation
```bash
# Interfaces with more than 20 methods (consider splitting)
grep -c "Promise<" src/domain/*/repository.ts src/application/ports/*.ts
```

## Step 4: Provider-Specific References

```bash
grep -rn "claude\|anthropic\|sonnet\|haiku\|opus\|openai\|gpt-" src/domain/ src/application/ src/presentation/ --include="*.ts" -i | grep -v "import.*from\|require("
grep -rn "xoxb-\|xapp-\|sk-ant-\|sk-proj-" src/ --include="*.ts" | grep -v SKILL.md
```

## Step 5: Type Safety

```bash
grep -rn ": any\|as any\|<any>\|= any" src/ --include="*.ts" | grep -v node_modules | grep -v ".d.ts" | wc -l
```

Target: zero `any` types.

## Step 6: Error Handling

```bash
grep -rn "catch {}\|catch () {}\|\.catch(() => {})" src/ --include="*.ts" | grep -v node_modules
grep -rn "\.json()" src/infrastructure/ --include="*.ts" | grep -v "c\.json\|return.*json\|parseBody\|req\.json"
```

## Step 7: Clean Code Violations

```bash
grep -rn "console\.log" src/ --include="*.ts" | grep -v node_modules | grep -v SKILL.md
grep -rn "TODO\|FIXME\|HACK" src/ --include="*.ts" | grep -v node_modules | grep -v SKILL.md
grep -rn "setTimeout\|setInterval" src/ --include="*.ts" | grep "[0-9]\{3,\}"
```

## Step 8: SQL Safety

```bash
grep -rn "execute(\`\|execute('" src/ --include="*.ts" | grep '\${'
```

## Report Format

Group findings by severity:
- **CRITICAL**: Layer boundary violations, DIP violations, SQL injection, auth bypass
- **HIGH**: SRP violations, type safety (`any`), missing error handling
- **MEDIUM**: Magic numbers, provider leaks, ISP violations
- **LOW**: Naming, style

For each finding: file, line, which DDD/SOLID/Clean Code principle is violated, and what to do.
