import 'react-i18next';
import translationDE from './locales/de/translation.json';

declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: typeof translationDE;
    };
  }
}
