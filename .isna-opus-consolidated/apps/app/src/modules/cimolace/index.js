/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE MODULES
 * Back-office propriétaire CIMOLACE - Modules de gestion
 * ═══════════════════════════════════════════════════════════════
 */

// Clients
export { ClientEngine, clientEngine } from './clients/clientEngine.js';
export { ClientStatus, ClientType } from './clients/clientTypes.js';

// Sites
export { SiteEngine, siteEngine } from './sites/siteEngine.js';
export { SiteStatus, SiteType, SitePlan } from './sites/siteTypes.js';

// Contracts
export { ContractEngine, contractEngine } from './contracts/contractEngine.js';
export { ContractType, ContractStatus } from './contracts/contractTypes.js';

// Subscriptions
export { SubscriptionEngine, subscriptionEngine } from './subscriptions/subscriptionEngine.js';
export { SubscriptionStatus, BillingCycle } from './subscriptions/subscriptionTypes.js';

// Billing
export { BillingEngine, billingEngine } from './billing/billingEngine.js';
export { PaymentStatus, PaymentType, InvoiceStatus } from './billing/billingTypes.js';

// Services
export { ServiceEngine, serviceEngine } from './services/serviceEngine.js';
export { ServiceStatus, ServiceCategory } from './services/serviceTypes.js';

// Credentials
export { CredentialEngine, credentialEngine } from './credentials/credentialEngine.js';
export { CredentialType, CredentialStatus } from './credentials/credentialTypes.js';

// Usage
export { UsageEngine, usageEngine } from './usage/usageEngine.js';
export { UsageMetric } from './usage/usageTypes.js';

// Configuration
export { ConfigurationEngine, configurationEngine } from './configuration/configurationEngine.js';
export { ConfigurationStepStatus } from './configuration/configurationTypes.js';

// Support
export { TicketEngine, ticketEngine } from './support/ticketEngine.js';
export { TicketStatus, TicketPriority, TicketCategory } from './support/ticketTypes.js';

// Incidents
export { IncidentEngine, incidentEngine } from './incidents/incidentEngine.js';
export { IncidentStatus, IncidentSeverity } from './incidents/incidentTypes.js';
