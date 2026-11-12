import type {
  AdoptionDto,
  FeedItemDto,
  FeedResponse,
  AdoptionPlanDto,
  AnimalCardDto,
  AnimalUpdateDto,
  PaymentDto,
  PublicAnimalDto,
  SessionUser,
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
      visibility: 'public',
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
        visibility: 'public',
      },
    ],
    exclusiveAccess: false,
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

export function sessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 6,
    firstName: 'Lucía',
    lastName: 'Martínez Navarro',
    email: 'lucia.martinez@correo.test',
    role: 'adopter',
    emailVerified: true,
    ...overrides,
  };
}

export function adoption(overrides: Partial<AdoptionDto> = {}): AdoptionDto {
  return {
    id: 40,
    status: 'pending',
    animal: { id: 1, name: 'Rufo', species: 'Buitre leonado', coverPhoto: card().coverPhoto },
    plan: { id: 2, name: 'Usual', monthlyAmount: '5.00' },
    nextPlan: null,
    startDate: null,
    endDate: null,
    nextBillingDate: null,
    cancelRequested: false,
    endReason: null,
    nextUpdateExpected: null,
    createdAt: '2026-11-12T10:00:00.000Z',
    canPay: true,
    ...overrides,
  };
}

export function payment(overrides: Partial<PaymentDto> = {}): PaymentDto {
  return {
    id: 90,
    status: 'completed',
    amount: '5.00',
    periodStart: '2026-11-12',
    periodEnd: '2026-12-11',
    failureReason: null,
    ...overrides,
  };
}

/** Adopción activa de Rufo desde el 5 de septiembre de 2025. */
export function activeAdoption(overrides: Partial<AdoptionDto> = {}): AdoptionDto {
  return adoption({
    id: 1,
    status: 'active',
    startDate: '2025-09-05',
    nextBillingDate: '2026-12-05',
    nextUpdateExpected: '2026-11-24',
    canPay: false,
    ...overrides,
  });
}

export function feedItem(overrides: Partial<FeedItemDto> = {}): FeedItemDto {
  return {
    id: 2,
    title: 'Revisión del ala: todo en orden',
    body: 'La veterinaria ha confirmado que el ala está bien.',
    visibility: 'adopters',
    publishedAt: '2026-11-09T11:30:00.000Z',
    photos: [],
    isRead: false,
    animal: { id: 1, name: 'Rufo', coverPhoto: card().coverPhoto },
    ...overrides,
  };
}

export const feedPage = (data: FeedItemDto[], meta: Partial<FeedResponseMeta> = {}) => ({
  data,
  meta: {
    page: 1,
    pageSize: 10,
    total: data.length,
    totalPages: data.length === 0 ? 0 : 1,
    unreadCount: data.filter((u) => !u.isRead).length,
    ...meta,
  },
});

type FeedResponseMeta = FeedResponse['meta'];
