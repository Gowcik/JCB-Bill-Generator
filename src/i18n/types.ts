export type Language = 'en' | 'ta';

export const LANGUAGE_STORAGE_KEY = 'jcb_app_language';
export const DEFAULT_LANGUAGE: Language = 'en';

export interface LanguageOption {
  code: Language;
  name: string;
  nativeName: string;
  subLabel: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    subLabel: 'Default',
  },
  {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    subLabel: 'தமிழ்நாடு (Tamil Nadu)',
  },
];
