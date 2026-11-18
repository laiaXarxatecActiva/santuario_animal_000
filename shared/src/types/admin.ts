import type { AnimalSex } from '../constants/animals.js';
import type { Role } from '../constants/roles.js';
import type { AdoptionEndReason, AdoptionStatus, PaymentMethod, PaymentStatus } from '../constants/status.js';
import type { UserAccountStatus } from '../constants/users.js';
import type { ContributionDonationDto, ContributionPaymentDto } from './contribution.js';
import type { AnimalStatus, Visibility } from '../constants/status.js';
import type { PhotoDto } from './public.js';

export type UpdateAlertLevel = 'warning' | 'error';

/** CU-27: animal con adoptantes activos que necesita una actualización (RN-14). */
export interface UpdateAlertDto {
  animal: { id: number; name: string };
  daysWithoutUpdate: number;
  level: UpdateAlertLevel;
  activeAdopters: number;
}

/** CU-27 3: lo cobrado en el mes en curso (solo `completed`), en euros como string. */
export interface MonthlyRevenueDto {
  /** `YYYY-MM`, en la zona horaria del santuario. */
  month: string;
  fees: string;
  donations: string;
  total: string;
}

/** GET /api/admin/dashboard (CU-27). `revenue` solo llega al administrador. */
export interface DashboardDto {
  animalsByStatus: Record<AnimalStatus, number>;
  activeAdoptions: number;
  pendingAdoptions: number;
  updateAlerts: UpdateAlertDto[];
  revenue?: MonthlyRevenueDto;
}

/** Plan de adopción en el panel (CU-40). */
export interface AdminPlanDto {
  id: number;
  name: string;
  monthlyAmount: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  activeAdoptions: number;
}

/** Especie en el panel (CU-30). */
export interface SpeciesAdminDto {
  id: number;
  name: string;
  scientificName: string | null;
  description: string | null;
  animalCount: number;
}

/** Fila del listado de animales del panel (CU-28). */
export interface AdminAnimalListItemDto {
  id: number;
  name: string;
  species: { id: number; name: string };
  status: AnimalStatus;
  isPublished: boolean;
  isAdoptable: boolean;
  activeAdopters: number;
  coverPhoto: PhotoDto | null;
}

/** Ficha completa del animal en el panel (CU-28). */
export interface AdminAnimalDto extends AdminAnimalListItemDto {
  breed: string | null;
  sex: AnimalSex;
  approxBirthDate: string | null;
  arrivalDate: string;
  rescueStory: string | null;
  temperament: string | null;
  specialNeeds: string | null;
  healthSummary: string | null;
  /** Fecha del fallecimiento o traslado. */
  statusChangedAt: string | null;
  /** Adopciones pendientes, activas o pausadas: las que cerraría un fallecimiento o traslado. */
  openAdoptions: number;
  /** Ha tenido alguna adopción: entonces no se puede borrar (RN-17). */
  hasAdoptionHistory: boolean;
}

/** Foto o vídeo de la galería en el panel (CU-29). */
export interface AdminPhotoDto extends PhotoDto {
  sortOrder: number;
  isCover: boolean;
}

/** CU-29 2a: archivo rechazado en una subida. */
export interface RejectedFileDto {
  fileName: string;
  code: 'UNSUPPORTED_FORMAT' | 'IMAGE_TOO_LARGE' | 'VIDEO_TOO_LARGE' | 'INVALID_FILE';
  message: string;
}

/** POST /api/admin/animals/:id/photos: los creados y los rechazados. */
export interface PhotoUploadResultDto {
  created: AdminPhotoDto[];
  rejected: RejectedFileDto[];
}

/** Fila del listado de actualizaciones del panel (CU-31, CU-32). */
export interface AdminUpdateListItemDto {
  id: number;
  animal: { id: number; name: string };
  author: { id: number; name: string };
  title: string;
  visibility: Visibility;
  publishedAt: string;
  photoCount: number;
  /** El usuario puede editarla o borrarla (autor o administrador). Solo orienta la interfaz. */
  canEdit: boolean;
}

/** Actualización completa en el panel. */
export interface AdminUpdateDto extends AdminUpdateListItemDto {
  body: string;
  updatedAt: string;
  photos: AdminPhotoDto[];
}

/** CU-31 paso 5: respuesta al publicar, con los adoptantes avisados. */
export interface AdminUpdateCreatedDto extends AdminUpdateDto {
  notifiedAdopters: number;
}

/** Fila del listado de usuarios (CU-35). Nunca lleva el hash ni datos internos. */
export interface AdminUserListItemDto {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  status: UserAccountStatus;
  createdAt: string;
  lastLoginAt: string | null;
}

/** Adopción en la ficha de un usuario (CU-35 paso 3). */
export interface AdminUserAdoptionDto {
  id: number;
  animal: { id: number; name: string };
  plan: { id: number; name: string; monthlyAmount: string };
  status: AdoptionStatus;
  startDate: string | null;
  endDate: string | null;
  nextBillingDate: string | null;
  cancelRequested: boolean;
}

/** Ficha de un usuario (CU-35 paso 3). Las adopciones y aportaciones solo existen para adoptantes. */
export interface AdminUserDetailDto extends AdminUserListItemDto {
  phone: string | null;
  emailVerified: boolean;
  /** CU-36 4a: trabajador activo que todavía no ha entrado nunca. */
  invitationPending: boolean;
  adoptions: AdminUserAdoptionDto[];
  payments: ContributionPaymentDto[];
  donations: ContributionDonationDto[];
}

/** CU-37: persona que creó una adopción o registró un pago a mano. */
export interface AdminPersonRef {
  id: number;
  name: string;
}

/** CU-37 paso 2: fila del listado de adopciones. */
export interface AdminAdoptionListItemDto {
  id: number;
  adopter: { id: number; firstName: string; lastName: string; email: string };
  animal: { id: number; name: string };
  plan: { id: number; name: string; monthlyAmount: string };
  status: AdoptionStatus;
  startDate: string | null;
  endDate: string | null;
  nextBillingDate: string | null;
  cancelRequested: boolean;
  createdAt: string;
}

/** CU-37 paso 3: pago de la adopción, con quién lo registró si fue manual. */
export interface AdminAdoptionPaymentDto {
  id: number;
  amount: string;
  periodStart: string;
  periodEnd: string;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string;
  paidAt: string | null;
  refundedAt: string | null;
  failureReason: string | null;
  recordedBy: AdminPersonRef | null;
}

/** CU-37 paso 3: ficha de la adopción. */
export interface AdminAdoptionDetailDto extends AdminAdoptionListItemDto {
  nextPlan: { id: number; name: string; monthlyAmount: string } | null;
  endReason: AdoptionEndReason | null;
  notes: string | null;
  createdBy: AdminPersonRef | null;
  payments: AdminAdoptionPaymentDto[];
  /** CU-38 A2: cuota que se puede registrar a mano ahora (o `null` si no hay ninguna). */
  pendingFee: { periodStart: string; periodEnd: string; amount: string } | null;
  /** CU-38 (al cancelar, CU-37 A3): última cuota cobrada, la que se devolvería. */
  lastRefundablePayment: { id: number; amount: string } | null;
}

/** CU-38 paso 2: cuota en el listado de pagos. `date` es el cobro o, si no se cobró, el intento. */
export interface AdminPaymentListItemDto {
  id: number;
  adoptionId: number;
  adopter: { id: number; firstName: string; lastName: string; email: string };
  animal: { id: number; name: string };
  plan: { id: number; name: string };
  amount: string;
  periodStart: string;
  periodEnd: string;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string;
  date: string;
  refundedAt: string | null;
  failureReason: string | null;
  recordedBy: AdminPersonRef | null;
}

/** CU-38 paso 2: página del listado con la suma de lo cobrado con los filtros actuales. */
export interface AdminPaymentsPage {
  data: AdminPaymentListItemDto[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  totalCollected: string;
}
