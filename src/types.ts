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
