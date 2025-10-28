export type MeditationTypeSlug = 'general' | 'intention' | 'calm' | 'gratitude' | 'compassion';

export interface MeditationTypeConfig {
  slug: MeditationTypeSlug;
  label: string;
  description: string;
  icon: 'brain' | 'target' | 'feather' | 'sun' | 'heart';
  iconColor: string;
  iconBackground: string;
}

export const DEFAULT_MEDITATION_TYPE: MeditationTypeSlug = 'general';

const typeList: MeditationTypeConfig[] = [
  {
    slug: 'general',
    label: 'General Meditation',
    description: 'Personalized session drawn from your selected experiences.',
    icon: 'brain',
    iconColor: '#2563eb',
    iconBackground: '#dbeafe'
  },
  {
    slug: 'intention',
    label: 'Intention Setting',
    description: 'Clarify your focus and align with what comes next.',
    icon: 'target',
    iconColor: '#f59e0b',
    iconBackground: '#fef3c7'
  },
  {
    slug: 'calm',
    label: 'Calmness & Relaxation',
    description: 'Release tension, slow down, and settle your nervous system.',
    icon: 'feather',
    iconColor: '#0284c7',
    iconBackground: '#e0f2fe'
  },
  {
    slug: 'gratitude',
    label: 'Gratitude',
    description: 'Savor meaningful moments and amplify appreciation.',
    icon: 'sun',
    iconColor: '#db2777',
    iconBackground: '#fdf2f8'
  },
  {
    slug: 'compassion',
    label: 'Compassion',
    description: 'Extend kindness inward and outward with loving awareness.',
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
