import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import ru from '../locales/ru.json';
import { resolveInitialLanguage } from './language';
import type { SupportedLanguage } from './types';

export const LANGUAGE_STORAGE_KEY = 'leathercad.language';

function getInitialLanguage(): SupportedLanguage {
    let storedLanguage: string | null = null;

    try {
        storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
        // Storage may be unavailable in privacy-restricted browser contexts.
    }

    return resolveInitialLanguage(storedLanguage, navigator.language);
}

void i18n.use(initReactI18next).init({
    resources: {
        en: { translation: en },
        ru: { translation: ru },
    },
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    supportedLngs: ['en', 'ru'],
    interpolation: { escapeValue: false },
    initAsync: false,
});

export async function changeLanguage(language: SupportedLanguage) {
    try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
        // Runtime switching should still work when persistence is unavailable.
    }

    await i18n.changeLanguage(language);
}

export { i18n };
