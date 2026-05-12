# dataspace-client-sdk-node

Node.js SDK to consume async endpoints and to implement distinct use cases.

## Documentation Index

1. [Legal Organization Flow Step by Step](https://github.com/Global-DataCare/dataspace-client-sdk-node/blob/main/docs/LEGAL_ORGANIZATION_FLOW_STEP_BY_STEP.md)
2. [Practitioner Flow Step by Step](https://github.com/Global-DataCare/dataspace-client-sdk-node/blob/main/docs/PRACTITIONER_FLOW_STEP_BY_STEP.md)
3. [Personal Flow Step by Step](https://github.com/Global-DataCare/dataspace-client-sdk-node/blob/main/docs/PERSONAL_FLOW_STEP_BY_STEP.md)
4. [Controller Flow Step by Step](https://github.com/Global-DataCare/dataspace-client-sdk-node/blob/main/docs/CONTROLLER_FLOW_STEP_BY_STEP.md)
5. [Live Local GW Use Cases E2E (no mocks)](https://github.com/Global-DataCare/dataspace-client-sdk-node/blob/main/docs/E2E_LOCAL_GW_UC5.md)
6. [Backend Node Integration Guide](https://github.com/Global-DataCare/dataspace-client-sdk-node/blob/main/docs/BACKEND_NODE_INTEGRATION.md)
7. [Full API Reference](https://github.com/Global-DataCare/dataspace-client-sdk-node/blob/main/docs/API.md)
8. [Developer Use-Case Cookbook (secondary examples)](https://github.com/Global-DataCare/dataspace-client-sdk-node/blob/main/docs/DEVELOPER_USE_CASES.md)
9. [Data Model Alignment (GW + Chat + SDK)](https://github.com/Global-DataCare/dataspace-client-sdk-node/blob/main/docs/DATA_MODEL_ALIGNMENT.md)
10. [React Web Integration Guide](https://github.com/Global-DataCare/dataspace-client-sdk-node/blob/main/docs/REACT_WEB_INTEGRATION.md)
11. [Portal Backend Integration Handover](https://github.com/Global-DataCare/dataspace-client-sdk-node/blob/main/docs/PORTAL_BACKEND_INTEGRATION_HANDOVER.md)

## Testing

1. Start GW local demo in a separate terminal:

```bash
cd /Users/fernando/GITS/gdc-workspace/gwtemplate-node-ts
npm run api:local-demo
```

- Live Use Cases E2E: `npm run test:e2e:live-use-cases`
- Backward-compatible alias: `npm run test:e2e:live-gw-uc5`
- The live test file skips itself in general test runs; `npm run test:e2e:live-use-cases` enables it by setting `RUN_LIVE_GW_E2E=1`.
- Full command details live in [docs/E2E_LOCAL_GW_UC5.md](docs/E2E_LOCAL_GW_UC5.md).
- Optional debug log: set `LIVE_GW_E2E_DEBUG=1` to write sanitized request/response traces to `test-results/live-use-cases-debug.log`.

Example with both variables:

```bash
RUN_LIVE_GW_E2E=1 LIVE_GW_E2E_DEBUG=1 npm run test:e2e:live-use-cases
```

## TODO and Roadmap

1. [Prompt Next Steps TODO](https://github.com/Global-DataCare/dataspace-client-sdk-node/blob/main/TODO_PROMPT_NEXT_STEPS.md)
2. [SMART EHR Compatibility TODO](https://github.com/Global-DataCare/dataspace-client-sdk-node/blob/main/docs/TODO_SMART_EHR_COMPAT.md)
