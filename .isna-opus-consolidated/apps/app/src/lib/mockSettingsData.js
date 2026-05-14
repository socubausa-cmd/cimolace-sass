import { resolveVitrineContactEmailSync } from '@/lib/vitrineContactEmail';

export const defaultSettings = {
  school: {
    name: "PRORASCIENCE ACADEMY",
    email: resolveVitrineContactEmailSync(),
    phone: "+33 7 66 52 57 08",
    address: "Agondjé Village, Libreville, Gabon",
    currency: "EUR",
    language: "fr"
  },
  academicYear: {
    current: "2024-2025",
    startDate: "2024-09-01",
    endDate: "2025-06-30"
  },
  payments: {
    methods: { card: true, transfer: true, paypal: false },
    vatRate: 20,
    lateFeePercentage: 5
  },
  security: {
    twoFactorEnabled: false, // Global toggle
    passwordPolicy: "strong",
    sessionTimeout: 30
  },
  notifications: {
    email: true,
    sms: false,
    push: true
  }
};