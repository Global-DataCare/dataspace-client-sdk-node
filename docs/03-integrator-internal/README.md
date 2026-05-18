# 03 - Integrator/Internal

This section explains internal/bootstrap and platform mechanics that are often required by integrators but are not direct business UC operations.

## Identity/token internals

- [Token exchange and authorization model](./auth/TOKEN_EXCHANGE_AND_AUTHORIZATION_MODEL.md)
- [Endpoint ID catalog](./auth/ENDPOINT_ID_CATALOG.md)
- [E2E bootstrap](./integration/E2E_BOOTSTRAP.md)

## Integration mechanics

- [Backend node integration](./integration/BACKEND_NODE_INTEGRATION.md)
- [React web integration](./integration/REACT_WEB_INTEGRATION.md)
- [Data planes scope matrix](./platform/DATA_PLANES_SCOPE_MATRIX.md)

Use these docs when you need to understand:
- why DCR/PKCE/token exchange exists,
- how async identity routes are orchestrated,
- how to wire SDK in real deployments.
