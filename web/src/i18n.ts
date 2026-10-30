import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { resources } from './locales/resources';

const supportedLngs = ['en', 'zh-TW', 'zh-CN', 'es', 'fr', 'ar', 'pt-BR', 'de', 'ja', 'ko', 'ru', 'it'];

const chineseVariants: Record<string, string> = {
  'zh-HK': 'zh-TW',
  'zh-MO': 'zh-TW',
  'zh-Hant': 'zh-TW',
  'zh-SG': 'zh-CN',
  'zh-Hans': 'zh-CN',
};

const toSupportedLng = (lng: string) => {
  if (supportedLngs.includes(lng)) return lng;
  const variant = Object.keys(chineseVariants).find((k) => lng.startsWith(k));
  return variant ? chineseVariants[variant] : lng.split('-')[0];
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs,
    detection: {
      // i18next prefers any exact match over a base-language match, so with
      // navigator.languages = ['en-US', 'zh-TW'] it would pick zh-TW. Reduce
      // unsupported regional codes to their base so the browser's order wins.
      convertDetectedLanguage: toSupportedLng,
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n; 