export type MeditationTypeSlug = 'general' | 'intention' | 'calm' | 'gratitude' | 'compassion';

export interface MeditationTypeConfig {
  slug: MeditationTypeSlug;
  label: string;
  description: string;
  recommendation: string;
  icon: 'brain' | 'target' | 'feather' | 'sun' | 'heart';
  iconColor: string;
  iconBackground: string;
}

export const DEFAULT_MEDITATION_TYPE: MeditationTypeSlug = 'general';

const typeList: MeditationTypeConfig[] = [
  {
    slug: 'general',
    label: 'General',
    description: 'A quiet reflection of selected journals and experiences to ground you with awareness and mindfulness.',
    recommendation: 'At night, before bedtime.',
    icon: 'brain',
    iconColor: '#2563eb',
    iconBackground: '#dbeafe'
  },
  {
    slug: 'intention',
    label: 'Intention Setting',
    description: 'Takes your documented desires, goals and challenges into a clear, positive intention to guide your state of mind.',
    recommendation: 'Before you start the day.',
    icon: 'target',
    iconColor: '#f59e0b',
    iconBackground: '#fef3c7'
  },
  {
    slug: 'calm',
    label: 'Feel Calm and Relaxed',
    description: 'Release stress, tension or anxiety surfaced in your recent thoughts.',
    recommendation: 'Anytime.',
    icon: 'feather',
    iconColor: '#0284c7',
    iconBackground: '#e0f2fe'
  },
  {
    slug: 'gratitude',
    label: 'Gratitude',
    description: 'Highlights and deepens appreciation for the positive elements and gifts within your recent thoughts and experiences.',
    recommendation: 'Anytime.',
    icon: 'sun',
    iconColor: '#db2777',
    iconBackground: '#fdf2f8'
  },
  {
    slug: 'compassion',
    label: 'Compassion',
    description: 'Cultivates kindness and understanding toward yourself and others connected to the feelings expressed in your reflections.',
    recommendation: 'Anytime.',
    icon: 'heart',
    iconColor: '#7c3aed',
    iconBackground: '#ede9fe'
  }
];

export const MEDITATION_TYPES = typeList;

const typeMap = typeList.reduce<Record<MeditationTypeSlug, MeditationTypeConfig>>((acc, config) => {
  acc[config.slug] = config;
  return acc;
}, {} as Record<MeditationTypeSlug, MeditationTypeConfig>);

export function getMeditationTypeConfig(slug: MeditationTypeSlug): MeditationTypeConfig {
  return typeMap[slug] ?? typeMap[DEFAULT_MEDITATION_TYPE];
}

export function isMeditationTypeSlug(value: unknown): value is MeditationTypeSlug {
  return typeof value === 'string' && value in typeMap;
}
