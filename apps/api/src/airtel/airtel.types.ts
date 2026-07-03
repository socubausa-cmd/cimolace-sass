/**
 * Airtel Money (Airtel Africa Open API) — types.
 *
 * Source de vérité = le portail authentifié developers.airtel.ga (Gabon).
 * Le portail étant JS/login-gated, la spec ci-dessous est corroborée par 3+ SDKs
 * open-source concordants (osenco/airtel, stephencoduor, thulanirex) + tutoriels.
 * Tout est piloté par variables d'env (AIRTEL_*) → si un détail diffère sur le
 * portail, c'est un simple ajustement de config, pas de code.
 *
 * Points à CONFIRMER sur le portail (cf. openQuestions de la recherche) :
 *  - schéma exact du chiffrement du PIN (RSA/ECB/PKCS1Padding 1024-bit assumé) ;
 *  - X-Country pour le Gabon ("GA" attendu en ISO2) ;
 *  - chemin/version exact du disbursement (v1 `/standard/v1/disbursements/` assumé).
 */

/** Requête de décaissement (payout) vers un wallet Airtel Money. */
export interface AirtelDisbursementRequest {
  /** MSISDN national du bénéficiaire (SANS indicatif 241, chiffres seuls). */
  msisdn: string;
  /** Montant en unité majeure (XAF = entier, pas de centime). */
  amount: number;
  /** Identifiant unique de transaction (idempotence côté Airtel). */
  transactionId: string;
  /** Référence libre (facultative). */
  reference?: string;
}

/** Réponse d'initiation de décaissement (enveloppe Airtel `{ data, status }`). */
export interface AirtelDisbursementResponse {
  data?: {
    transaction?: {
      id?: string;
      reference?: string;
      status?: string; // TS (success) | TF (failed) | TA (ambiguous) | TIP (in progress) ...
      airtel_money_id?: string;
    };
  };
  status?: {
    code?: string; // "200" attendu à l'acceptation
    success?: boolean;
    result_code?: string;
    response_code?: string;
    message?: string;
  };
}

/** Statut d'un décaissement (polling). */
export interface AirtelDisbursementStatus {
  transactionId: string;
  status: string; // TS | TF | TA | TIP | TE
  airtelMoneyId?: string;
  message?: string;
  raw: any;
}

/** Jeton OAuth2 client_credentials mis en cache. */
export interface AirtelToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}
