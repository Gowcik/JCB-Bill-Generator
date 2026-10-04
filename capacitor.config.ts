import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jcbbillgenerator.app',
  appName: 'JCB Bill Generator',
  webDir: 'dist',
  backgroundColor: '#0B0F14',
  android: {
    backgroundColor: '#0B0F14'
  },
  server: {
    androidScheme: 'https'
  }
};

export default config;
