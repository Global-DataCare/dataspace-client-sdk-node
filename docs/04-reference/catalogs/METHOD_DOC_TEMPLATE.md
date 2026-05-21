# Method Documentation Template

Use this template for every SDK method page.

## `methodName`

### What it does
- Plain-language behavior.

### Why it exists
- Why this method is needed in the architecture.

### When to use it
- Exact UC step(s), actor(s), and preconditions.

### When NOT to use it
- Alternative methods and scope limits.

### Signature
```ts
methodName(args): ReturnType
```

### Parameters
| Name | Required | Type | Description |
|---|---|---|---|
| `...` | yes/no | `...` | ... |

### Endpoint(s) called
- `POST /...`
- `POST /...-response`

### Input example
```ts
// realistic snippet
```

### Output example
```json
{ "..." : "..." }
```

### Errors
- expected business/runtime errors and how to resolve them.

### UC mapping
- UC id + actor + step number.

### Test coverage
- unit test file/case
- live E2E file/case

