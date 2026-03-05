import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.planujsmeny.app',
  appName: 'Planuj Smeny',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#020617",
      showSpinner: false,
      androidScaleType: "CENTER_CROP"
    },
    StatusBar: {
      overlaysWebView: true,
      style: "DARK"
    }
  }
};

export default config;
