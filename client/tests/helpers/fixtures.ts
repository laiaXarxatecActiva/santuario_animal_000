import type {
  AdoptionPlanDto,
  AnimalCardDto,
  AnimalUpdateDto,
  PublicAnimalDto,
  SpeciesSummary,
} from '@sanctuary/shared';

export const leonado: SpeciesSummary = { id: 1, name: 'Buitre leonado', scientificName: 'Gyps fulvus' };
export const negro: SpeciesSummary = { id: 2, name: 'Buitre negro', scientificName: 'Aegypius monachus' };

export function card(overrides: Partial<AnimalCardDto> = {}): AnimalCardDto {
  return {
    id: 1,
    name: 'Rufo',
    species: leonado,
    sex: 'male',
    status: 'in_sanctuary',
    approxAgeYears: 12,
    isAdoptable: true,
    adopterCount: 2,
    coverPhoto: {
      id: 1,
      mediaType: 'image',
      url: '/uploads/animals/1/cover.jpg',
      thumbnailUrl: '/uploads/animals/1/thumb_cover.jpg',
      altText: 'Rufo, buitre leonado, posado en una rampa de madera',
    },
    ...overrides,
  };
}

export function animal(overrides: Partial<PublicAnimalDto> = {}): PublicAnimalDto {
  const base = card();
  return {
    ...base,
    breed: null,
    approxBirthDate: '2014-11-12',
    arrivalDate: '2021-08-12',
    rescueStory: 'Llegó tras electrocutarse en un tendido eléctrico.',
    temperament: 'Tranquilo y observador.',
    specialNeeds: 'Posaderos bajos y rampas.',
    publicAdopterNames: ['Lucía'],
    photos: [
      base.coverPhoto!,
      {
        id: 16,
        mediaType: 'image',
        url: '/uploads/animals/1/02.jpg',
        thumbnailUrl: '/uploads/animals/1/thumb_02.jpg',
        altText: 'Rufo comiendo junto a otros buitres',
      },
    ],
    ...overrides,
  };
}

export const update: AnimalUpdateDto = {
  id: 1,
  title: 'Rufo estrena posadero',
  body: 'Hemos instalado un posadero nuevo.\nLe encanta.',
  visibility: 'public',
  publishedAt: '2026-10-13T08:00:00.000Z',
  photos: [],
};

export const plans: AdoptionPlanDto[] = [
  { id: 1, name: 'Simbólica', monthlyAmount: '1.00', description: 'Un gesto.', isDefault: false },
  { id: 2, name: 'Usual', monthlyAmount: '5.00', description: 'La de casi todos.', isDefault: true },
  { id: 3, name: 'Extraordinaria', monthlyAmount: '12.00', description: 'Para quien puede más.', isDefault: false },
];

export const page = <T>(
  data: T[],
  meta: Partial<{ page: number; pageSize: number; total: number; totalPages: number }> = {},
) => ({
  data,
  meta: { page: 1, pageSize: 12, total: data.length, totalPages: data.length === 0 ? 0 : 1, ...meta },
});
