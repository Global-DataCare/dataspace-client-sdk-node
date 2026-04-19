export type DidcommPlainMessage = {
  jti: string;
  thid: string;
  iss: string;
  aud: string;
  type: string;
  body: Record<string, unknown>;
  meta?: Record<string, unknown>;
};

export type AsyncPollRequest = {
  thid: string;
};

export type RouteContext = {
  tenantId: string;
  jurisdiction: string;
  sector: string;
};

export type V1Section = 'registry' | 'entity' | 'identity' | 'individual' | 'digitaltwin' | string;

export type V1Action =
  | '_batch'
  | '_batch-response'
  | '_activate'
  | '_activate-response'
  | '_dcr'
  | '_dcr-response'
  | '_exchange'
  | '_exchange-response'
  | '_issue'
  | 'token'
  | 'token-response'
  | '_custom'
  | '_custom-response'
  | string;

export type HostRouteContext = {
  jurisdiction: string;
  sector: string;
};

export type SubmitResponse = {
  status: number;
  location?: string;
  body: unknown;
};

export type PollOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

export type PollResult = {
  status: number;
  body: unknown;
  attempts: number;
};

export type SubmitAndPollResult = {
  submit: SubmitResponse;
  poll: PollResult;
};

export type ClientOptions = {
  baseUrl: string;
  bearerToken?: string;
  defaultHeaders?: Record<string, string>;
};
