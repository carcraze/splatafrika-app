import DodoPayments from "dodopayments";

export type DodoEnvironment = "live_mode" | "test_mode";

let _client: DodoPayments | null = null;

export function getDodoClient(): DodoPayments {
  if (!_client) {
    _client = new DodoPayments({
      bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
      environment: (process.env.DODO_PAYMENTS_ENVIRONMENT || "test_mode") as DodoEnvironment,
    });
  }
  return _client;
}
