import type {
  AdminAdoptionDetailDto,
  AdminDonationListItemDto,
  AdminPaymentListItemDto,
  AdminAdoptionListItemDto,
  AdminAnimalDto,
  AdminUserDetailDto,
  AdminUserListItemDto,
  AdminPlanDto,
  DashboardDto,
  SpeciesAdminDto,
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
    paymentMode: 'automatic',
    paymentDeadline: null,
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

export const caretaker = (overrides: Partial<SessionUser> = {}): SessionUser =>
  sessionUser({
    id: 3,
    firstName: 'Nuria',
    lastName: 'Peris Gómez',
    email: 'nuria.peris@santuario.test',
    role: 'caretaker',
    ...overrides,
  });

export const admin = (overrides: Partial<SessionUser> = {}): SessionUser =>
  sessionUser({
    id: 1,
    firstName: 'Marta',
    lastName: 'Soler Vidal',
    email: 'marta.soler@santuario.test',
    role: 'admin',
    ...overrides,
  });

export function dashboard(overrides: Partial<DashboardDto> = {}): DashboardDto {
  return {
    animalsByStatus: { in_sanctuary: 10, in_treatment: 3, deceased: 1, transferred: 1 },
    activeAdoptions: 11,
    pendingAdoptions: 2,
    updateAlerts: [
      { animal: { id: 3, name: 'Turia' }, daysWithoutUpdate: 16, level: 'error', activeAdopters: 1 },
      { animal: { id: 9, name: 'Ébano' }, daysWithoutUpdate: 12, level: 'warning', activeAdopters: 1 },
    ],
    ...overrides,
  };
}

export const adminSpecies: SpeciesAdminDto[] = [
  { id: 3, name: 'Alimoche común', scientificName: 'Neophron percnopterus', description: null, animalCount: 2 },
  { id: 1, name: 'Buitre leonado', scientificName: 'Gyps fulvus', description: 'El más común.', animalCount: 9 },
  { id: 5, name: 'Lince ibérico', scientificName: null, description: null, animalCount: 0 },
];

export function adminAnimal(overrides: Partial<AdminAnimalDto> = {}): AdminAnimalDto {
  return {
    id: 1,
    name: 'Rufo',
    species: { id: 1, name: 'Buitre leonado' },
    sex: 'male',
    approxBirthDate: '2014-11-12',
    arrivalDate: '2021-08-12',
    rescueStory: 'Llegó tras electrocutarse.',
    temperament: 'Tranquilo.',
    specialNeeds: null,
    healthSummary: 'Bien.',
    status: 'in_sanctuary',
    statusChangedAt: null,
    showInMemorial: false,
    zone: null,
    isAdoptable: true,
    isPublished: true,
    activeAdopters: 2,
    openAdoptions: 2,
    hasAdoptionHistory: true,
    coverPhoto: null,
    ...overrides,
  };
}

/** CU-40: planes del panel, como en TEST_DATA.sql. */
export const adminPlans: AdminPlanDto[] = [
  {
    id: 1,
    name: 'Simbólica',
    monthlyAmount: '1.00',
    description: 'Para quien quiere colaborar con lo mínimo.',
    isDefault: false,
    isActive: true,
    activeAdoptions: 0,
  },
  {
    id: 2,
    name: 'Usual',
    monthlyAmount: '5.00',
    description: 'La opción más habitual.',
    isDefault: true,
    isActive: true,
    activeAdoptions: 5,
  },
  {
    id: 3,
    name: 'Extraordinaria',
    monthlyAmount: '12.00',
    description: null,
    isDefault: false,
    isActive: false,
    activeAdoptions: 1,
  },
];

/** CU-35: usuarios del panel, como en TEST_DATA.sql. */
export const adminUsers: AdminUserListItemDto[] = [
  {
    id: 6,
    firstName: 'Lucía',
    lastName: 'Martínez Navarro',
    email: 'lucia.martinez@correo.test',
    role: 'adopter',
    status: 'active',
    createdAt: '2025-08-12T10:00:00.000Z',
    lastLoginAt: '2026-11-17T20:30:00.000Z',
  },
  {
    id: 3,
    firstName: 'Nuria',
    lastName: 'Peris Gil',
    email: 'nuria.peris@santuario.test',
    role: 'caretaker',
    status: 'active',
    createdAt: '2023-11-18T10:00:00.000Z',
    lastLoginAt: null,
  },
  {
    id: 14,
    firstName: 'Teresa',
    lastName: 'Vicent Molina',
    email: 'teresa.vicent@correo.test',
    role: 'adopter',
    status: 'inactive',
    createdAt: '2025-01-10T10:00:00.000Z',
    lastLoginAt: '2025-06-01T10:00:00.000Z',
  },
];

export function adminUserDetail(overrides: Partial<AdminUserDetailDto> = {}): AdminUserDetailDto {
  return {
    ...(adminUsers[0] as AdminUserListItemDto),
    phone: '612345678',
    emailVerified: true,
    invitationPending: false,
    adoptions: [
      {
        id: 1,
        animal: { id: 1, name: 'Rufo' },
        plan: { id: 2, name: 'Usual', monthlyAmount: '5.00' },
        status: 'active',
        startDate: '2025-09-13',
        endDate: null,
        nextBillingDate: '2026-12-13',
        cancelRequested: false,
      },
    ],
    payments: [],
    donations: [],
    ...overrides,
  };
}

/** CU-37: adopciones del panel. */
export const adminAdoptions: AdminAdoptionListItemDto[] = [
  {
    id: 4,
    adopter: { id: 7, firstName: 'Pablo', lastName: 'García Esteve', email: 'pablo.garcia@correo.test' },
    animal: { id: 1, name: 'Rufo' },
    plan: { id: 1, name: 'Simbólica', monthlyAmount: '1.00' },
    status: 'active',
    startDate: '2026-08-16',
    endDate: null,
    nextBillingDate: '2026-12-16',
    cancelRequested: false,
    createdAt: '2026-08-16T16:30:00.000Z',
  },
  {
    id: 11,
    adopter: { id: 10, firstName: 'Irene', lastName: 'Domínguez Prats', email: 'irene.dominguez@correo.test' },
    animal: { id: 5, name: 'Brisa' },
    plan: { id: 2, name: 'Usual', monthlyAmount: '5.00' },
    status: 'pending',
    startDate: null,
    endDate: null,
    nextBillingDate: null,
    cancelRequested: false,
    createdAt: '2026-11-16T10:00:00.000Z',
  },
];

export function adminAdoptionDetail(overrides: Partial<AdminAdoptionDetailDto> = {}): AdminAdoptionDetailDto {
  return {
    ...(adminAdoptions[0] as AdminAdoptionListItemDto),
    nextPlan: null,
    endReason: null,
    notes: 'Alta en la jornada de puertas abiertas.',
    createdBy: { id: 1, name: 'Marta Soler Ferrer' },
    paymentMode: 'automatic',
    pendingFee: { periodStart: '2026-12-16', periodEnd: '2027-01-15', amount: '1.00' },
    lastRefundablePayment: { id: 40, amount: '1.00' },
    payments: [
      {
        id: 40,
        amount: '1.00',
        periodStart: '2026-08-16',
        periodEnd: '2026-09-15',
        method: 'cash',
        status: 'completed',
        reference: 'CASH-20260816-ABCDE12345',
        paidAt: '2026-08-16T16:30:00.000Z',
        refundedAt: null,
        failureReason: null,
        recordedBy: { id: 1, name: 'Marta Soler Ferrer' },
      },
    ],
    ...overrides,
  };
}

/** CU-38: pagos del panel. */
export const adminPayments: AdminPaymentListItemDto[] = [
  {
    id: 70,
    adoptionId: 14,
    adopter: { id: 12, firstName: 'Raquel', lastName: 'Font Escrivà', email: 'raquel.font@correo.test' },
    animal: { id: 9, name: 'Ébano' },
    plan: { id: 3, name: 'Extraordinaria' },
    amount: '12.00',
    periodStart: '2026-10-15',
    periodEnd: '2026-11-14',
    method: 'cash',
    status: 'completed',
    reference: 'CASH-A0014-20261015',
    date: '2026-10-15T09:15:00.000Z',
    refundedAt: null,
    failureReason: null,
    recordedBy: { id: 1, name: 'Marta Soler Ferrer' },
  },
  {
    id: 71,
    adoptionId: 7,
    adopter: { id: 8, firstName: 'Elena', lastName: 'Rubio Sanz', email: 'elena.rubio@correo.test' },
    animal: { id: 11, name: 'Lupe' },
    plan: { id: 2, name: 'Usual' },
    amount: '5.00',
    periodStart: '2026-11-03',
    periodEnd: '2026-12-02',
    method: 'simulated',
    status: 'failed',
    reference: 'SIM-20261103-ABCDE',
    date: '2026-11-03T03:00:00.000Z',
    refundedAt: null,
    failureReason: 'Tarjeta rechazada',
    recordedBy: null,
  },
];

/** CU-39: donaciones del panel. */
export const adminDonations: AdminDonationListItemDto[] = [
  {
    id: 6,
    userId: null,
    donorName: 'Visitantes de la jornada',
    donorEmail: null,
    isAnonymous: false,
    amount: '87.40',
    message: 'Recaudado en la hucha.',
    method: 'cash',
    status: 'completed',
    reference: 'CASH-D0006',
    date: '2026-10-15T17:00:00.000Z',
    refundedAt: null,
    failureReason: null,
    recordedBy: { id: 1, name: 'Marta Soler Ferrer' },
  },
  {
    id: 5,
    userId: 7,
    donorName: 'Pablo García Esteve',
    donorEmail: 'pablo.garcia@correo.test',
    isAnonymous: true,
    amount: '100.00',
    message: null,
    method: 'simulated',
    status: 'completed',
    reference: 'SIM-D0005',
    date: '2026-09-18T18:45:00.000Z',
    refundedAt: null,
    failureReason: null,
    recordedBy: null,
  },
  {
    id: 8,
    userId: null,
    donorName: 'Marcos',
    donorEmail: 'marcos.donante@correo.test',
    isAnonymous: false,
    amount: '10.00',
    message: null,
    method: 'simulated',
    status: 'failed',
    reference: 'SIM-D0008',
    date: '2026-11-03T21:10:00.000Z',
    refundedAt: null,
    failureReason: 'Pago rechazado (simulado)',
    recordedBy: null,
  },
];
