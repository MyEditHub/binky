import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import translationDE from './locales/de/translation.json';

const resources = {
  de: {
    translation: translationDE,
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'de',
    fallbackLng: 'de',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

export default i18n;
