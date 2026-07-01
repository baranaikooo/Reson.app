import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.reson.app',
  appName: 'Reson',
  webDir: '.vercel/output/static', // Fallback local directory, but we will use the live server
  overrideUserAgent: 'ResonMobile',
  server: {
    url: 'https://resonapp.vercel.app/',
    cleartext: true
  }
};

export default config;
