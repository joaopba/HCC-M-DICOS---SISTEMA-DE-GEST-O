import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.e30c406ada794b2585635b3ad22ac543',
  appName: 'HCC Hospital',
  webDir: 'dist',
  server: {
    url: 'https://e30c406a-da79-4b25-8563-5b3ad22ac543.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
  },
};

export default config;
