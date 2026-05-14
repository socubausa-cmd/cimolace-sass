/**
 * Types pawaPay Merchant API v2
 * Docs : https://docs.pawapay.io/v2/docs/deposits
 */

export type PawaPayDepositStatus =
  | 'ACCEPTED'
  | 'COMPLETED'
  | 'FAILED'
  | 'REJECTED'
  | 'DUPLICATE_IGNORED'
  | 'TIMED_OUT';

export interface PawaPayAccountDetails {
  phoneNumber: string;
  provider: string; // ex: "MTN_MOMO_CMR", "ORANGE_CMR", "MTN_MOMO_RWA"...
}

export interface PawaPayPayer {
  type: 'MMO';
  accountDetails: PawaPayAccountDetails;
}

/** Payload envoyé à POST /v2/deposits */
export interface PawaPayDepositRequest {
  depositId: string; // UUIDv4 généré par nous
  amount: string; // ex: "1000"
  currency: string; // ex: "XAF", "RWF", "GHS"...
  payer: PawaPayPayer;
  statementDescription?: string; // max 22 chars
  metadata?: Record<string, string>;
}

/** Réponse de POST /v2/deposits (status ACCEPTED) */
export interface PawaPayDepositInitResponse {
  depositId: string;
  status: PawaPayDepositStatus;
  nextStep?: string;
  created?: string;
}

/** Callback reçu de pawaPay (GET /v2/deposits/:id ou webhook) */
export interface PawaPayDepositCallback {
  depositId: string;
  status: PawaPayDepositStatus;
  amount?: string;
  currency?: string;
  country?: string;
  payer?: PawaPayPayer;
  customerMessage?: string;
  created?: string;
  providerTransactionId?: string;
  metadata?: Record<string, string>;
  failureReason?: { failureCode: string; failureMessage?: string };
}

/** Config active (GET /v2/active-conf) */
export interface PawaPayActiveConfigProvider {
  provider: string;
  displayName: string;
  logo: string;
}

export interface PawaPayActiveConfigCountry {
  country: string;
  prefix: string;
  flag: string;
  displayName: Record<string, string>;
  providers: PawaPayActiveConfigProvider[];
}

export interface PawaPayActiveConfig {
  companyName: string;
  countries: PawaPayActiveConfigCountry[];
}
