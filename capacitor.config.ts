import type { CapacitorConfig } from '@capacitor/cli';

// O app abre o site publicado: toda melhoria no site chega aqui sem reinstalar.
// Só a parte nativa (Samsung Health, ditado, login do Google) precisa de APK novo.
const config: CapacitorConfig = {
  appId: 'app.dzapps.forja',
  appName: 'Forja',
  webDir: 'www',
  server: {
    url: 'https://danielsoaresbarboza-debug.github.io/forja/',
    errorPath: 'offline.html',
    allowNavigation: ['danielsoaresbarboza-debug.github.io']
  },
  android: { backgroundColor: '#0b0b0d' }
};

export default config;
