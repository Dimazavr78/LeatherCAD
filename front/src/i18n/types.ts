export type SupportedLanguage = 'en' | 'ru';

export interface LocalizationDescriptor {
    enabled: boolean;
    label?: string;
    tooltip?: string;
    description?: string;
}

export interface ToolConfig {
    id: string;
    icon: string;
    category: 'tools' | 'leather';
    enabled: boolean;
    label?: string;
    localization: LocalizationDescriptor;
}

export interface MenuConfig {
    id: string;
    label?: string;
    localization: LocalizationDescriptor;
}
