import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'space.cimolace.med',
  appName: 'ISNA Med',
  webDir: 'dist',
  server: {
    url: 'https://med.cimolace.space',
    cleartext: false,
  },
  ios: {
    contentInset: 'always',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Camera: {},
    BiometricAuth: {
      allowDeviceCredential: true,
      androidBiometryStrength: 'strong',
    },
  },
};

export default config;
