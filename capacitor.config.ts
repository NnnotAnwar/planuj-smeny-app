import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.planujsmeny.app',
  appName: 'Planuj Smeny',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: "#f8fafc",
      showSpinner: false,
      androidScaleType: "CENTER_CROP"
    },
    StatusBar: {
      overlaysWebView: true,
      style: "DARK"
    },
    Keyboard: {
      resize: "body",
      style: "DARK"
    }
  }
};

export default config;
