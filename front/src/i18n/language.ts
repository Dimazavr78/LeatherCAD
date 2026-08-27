import type { SupportedLanguage } from './types';

export function resolveInitialLanguage(
    storedLanguage: string | null,
    browserLanguage: string,
): SupportedLanguage {
    if (storedLanguage === 'en' || storedLanguage === 'ru') {
        return storedLanguage;
    }

    return browserLanguage.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}
