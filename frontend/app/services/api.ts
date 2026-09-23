// API configuration and utilities
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export interface RoomResourceAssignment {
  resource_id: number;
  quantity: number;
}

export interface RoomResourceItem {
  id: number;
  resource_id: number;
  resource_code: string;
  name: string;
  resource_type: string;
  quantity: number;
}

export type EnvironmentType =
  | "CLASSROOM"
  | "LABORATORY"
  | "AUDITORIUM"
  | "MEETING_ROOM"
  | "STUDIO"
  | "MULTIPURPOSE";

export type EnvironmentCriticality = "COMMON" | "CONTROLLED" | "RESTRICTED";

export interface Environment {
  id: number;
  name: string;
  type: EnvironmentType;
  criticality: EnvironmentCriticality;
  capacity: number;
  location_id: number;
  operating_hours: string;
  requires_approval: boolean;
  code: string | null;
  buffer_before_min: number;
  buffer_after_min: number;
  noshow_tolerance_min: number;
  active: boolean;
}

export interface EnvironmentCreate {
  code: string;
  name: string;
  type: EnvironmentType;
  criticality: EnvironmentCriticality;
  capacity: number;
  location_id: number;
  operating_hours: string;
  requires_approval: boolean;
  buffer_before_min?: number;
  buffer_after_min?: number;
  noshow_tolerance_min?: number;
  active?: boolean;
}

export type EnvironmentUpdate = Partial<EnvironmentCreate>;

export interface EnvironmentRequirement {
  id: number;
  environment_id: number;
  qualification_id: number;
}

export interface EnvironmentRequirementCreate {
  qualification_id: number;
}

export interface Location {
  id: number;
  campus: string;
  building: string;
  floor: string;
}

export type Room = Environment;
export type RoomCreate = EnvironmentCreate;
export type RoomCriticality = EnvironmentCriticality;

export type ResourceAttachment = "FIXED" | "MOBILE";

export type ResourceType =
  | "EQUIPMENT"
  | "FURNITURE"
  | "SOFTWARE_LICENSE"
  | "KEY"
  | "SUPPLY"
  | "KIT";

export interface Resource {
  id: number;
  name: string;
  type: ResourceType;
  category: string;
  attachment_type: ResourceAttachment;
  environment_id: number | null;
  active: boolean;
}

export interface ResourceCreate {
  name: string;
  type: string;
  category: string;
  attachment_type: ResourceAttachment;
  environment_id?: number | null;
}

export interface ResourceUpdate {
  name?: string;
  type?: string;
  category?: string;
  attachment_type?: ResourceAttachment;
  environment_id?: number | null;
  active?: boolean;
}

export interface Purpose {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PurposeCreate {
  name: string;
}

export interface PurposeUpdate {
  name?: string;
  is_active?: boolean;
}

export interface User {
  id: number;
  email: string;
  name: string;
  active: boolean;
  roles: string[];
}

export interface UserUpdate {
  name?: string;
  email?: string;
  active?: boolean;
  roles?: string[];
}

export interface UserRolesUpdate {
  roles: string[];
}

export interface UserCreateInput {
  name: string;
  email: string;
  password: string;
  active?: boolean;
  roles?: string[];
}

export interface ApiError {
  detail: string;
}

type TokenPayload = {
  exp?: unknown;
  roles?: unknown;
};

export const AUTH_LOGOUT_EVENT = "auth:logout";

const parseTokenPayload = (token: string): TokenPayload | null => {
  if (typeof atob === "undefined") {
    return null;
  }

  try {
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) {
      return null;
    }

    const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = atob(padded);
    return JSON.parse(decoded) as TokenPayload;
  } catch {
    return null;
  }
};

const isAccessTokenExpired = (token: string): boolean => {
  const payload = parseTokenPayload(token);
  if (!payload || typeof payload.exp !== "number") {
    return true;
  }

  return Date.now() >= payload.exp * 1000;
};

const parseErrorDetail = async (response: Response, fallbackMessage: string) => {
  if (response.status === 401) {
    clearAuthTokens();
    return "Sua sessão expirou. Faça login novamente.";
  }

  try {
    const error = (await response.json()) as ApiError;
    return error.detail || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
};

const isBrowser = typeof window !== "undefined";

export const clearAuthTokens = () => {
  if (!isBrowser) {
    return;
  }

  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
};

export const hasValidAccessToken = (): boolean => {
  if (!isBrowser) {
    return false;
  }

  const token = localStorage.getItem("accessToken");
  if (!token) {
    return false;
  }

  if (isAccessTokenExpired(token)) {
    clearAuthTokens();
    return false;
  }

  return true;
};

const getAccessToken = (): string | null => {
  if (!isBrowser) {
    return null;
  }

  const token = localStorage.getItem("accessToken");
  if (!token) {
    return null;
  }

  if (isAccessTokenExpired(token)) {
    clearAuthTokens();
    return null;
  }

  return token;
};

const getAuthHeaders = () => {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const apiFetch = async <T>(
  path: string,
  options: RequestInit = {},
  fallbackMessage = "Falha ao processar requisição"
): Promise<T> => {
  const headers = new Headers(getAuthHeaders());
  if (options.headers) {
    const extraHeaders = new Headers(options.headers);
    extraHeaders.forEach((value, key) => headers.set(key, value));
  }

  const response = await fetch(new URL(path, `${API_BASE_URL}/`), {
    ...options,
    headers,
  });

  if (!response.ok) {
    const detail = await parseErrorDetail(response, fallbackMessage);
    throw new Error(detail);
  }

  return response.json() as Promise<T>;
};

// Room API endpoints
export const environmentApi = {
  async getAllRooms(skip = 0, limit = 100) {
    const response = await fetch(
      `${API_BASE_URL}/environments?skip=${skip}&limit=${limit}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao buscar ambientes");
      throw new Error(detail);
    }
    return response.json() as Promise<Room[]>;
  },

  async getRoomById(roomId: number) {
    const response = await fetch(`${API_BASE_URL}/environments/${roomId}`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao buscar ambiente");
      throw new Error(detail);
    }
    return response.json() as Promise<Room>;
  },

  async createRoom(room: RoomCreate) {
    const response = await fetch(`${API_BASE_URL}/environments`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(room),
    });
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao criar ambiente");
      throw new Error(detail);
    }
    return response.json() as Promise<Room>;
  },

  async updateRoom(roomId: number, data: Partial<RoomCreate>) {
    const response = await fetch(`${API_BASE_URL}/environments/${roomId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao atualizar ambiente");
      throw new Error(detail);
    }
    return response.json() as Promise<Room>;
  },

  async deleteRoom(roomId: number) {
    const response = await fetch(`${API_BASE_URL}/environments/${roomId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao excluir ambiente");
      throw new Error(detail);
    }
  },

  async searchByCapacity(minCapacity: number, skip = 0, limit = 100) {
    const environments = await this.getAllRooms(skip, limit);
    return environments.filter((environment) => environment.capacity >= minCapacity);
  },

  async searchByLocation(locationId: number, skip = 0, limit = 100) {
    const environments = await this.getAllRooms(skip, limit);
    return environments.filter((environment) => environment.location_id === locationId);
  },
};

export const environmentRequirementApi = {
  async list(environmentId: number): Promise<EnvironmentRequirement[]> {
    const response = await fetch(
      `${API_BASE_URL}/environments/${environmentId}/requisitos`,
      { method: "GET", headers: getAuthHeaders() }
    );
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao buscar requisitos");
      throw new Error(detail);
    }
    return response.json() as Promise<EnvironmentRequirement[]>;
  },

  async add(environmentId: number, qualificationId: number): Promise<EnvironmentRequirement> {
    const response = await fetch(
      `${API_BASE_URL}/environments/${environmentId}/requisitos`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ qualification_id: qualificationId } satisfies EnvironmentRequirementCreate),
      }
    );
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao adicionar requisito");
      throw new Error(detail);
    }
    return response.json() as Promise<EnvironmentRequirement>;
  },

  async remove(environmentId: number, requirementId: number): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/environments/${environmentId}/requisitos/${requirementId}`,
      { method: "DELETE", headers: getAuthHeaders() }
    );
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao remover requisito");
      throw new Error(detail);
    }
  },
};

export const locationApi = {
  async getAllLocations(skip = 0, limit = 100) {
    const response = await fetch(
      `${API_BASE_URL}/locations?skip=${skip}&limit=${limit}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao buscar localizações");
      throw new Error(detail);
    }
    return response.json() as Promise<Location[]>;
  },
};

export const resourceApi = {
  async getAllResources(skip = 0, limit = 100, activeOnly = true) {
    const response = await fetch(
      `${API_BASE_URL}/resources?skip=${skip}&limit=${limit}&active_only=${activeOnly}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );
    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || "Falha ao buscar recursos");
    }
    return response.json() as Promise<Resource[]>;
  },

  async getResourceById(resourceId: number) {
    const response = await fetch(`${API_BASE_URL}/resources/${resourceId}`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || "Falha ao buscar recurso");
    }
    return response.json() as Promise<Resource>;
  },

  async createResource(resource: ResourceCreate) {
    const response = await fetch(`${API_BASE_URL}/resources`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(resource),
    });
    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || "Falha ao criar recurso");
    }
    return response.json() as Promise<Resource>;
  },

  async updateResource(resourceId: number, data: Partial<ResourceCreate>) {
    const response = await fetch(`${API_BASE_URL}/resources/${resourceId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || "Falha ao atualizar recurso");
    }
    return response.json() as Promise<Resource>;
  },

  async deleteResource(resourceId: number) {
    const response = await fetch(`${API_BASE_URL}/resources/${resourceId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || "Falha ao excluir recurso");
    }
  },
};

export const purposeApi = {
  async getAllPurposes(skip = 0, limit = 100, activeOnly = true) {
    const response = await fetch(
      `${API_BASE_URL}/purposes?skip=${skip}&limit=${limit}&active_only=${activeOnly}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );
    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || "Falha ao buscar finalidades");
    }
    return response.json() as Promise<Purpose[]>;
  },

  async createPurpose(purpose: PurposeCreate) {
    const response = await fetch(`${API_BASE_URL}/purposes`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(purpose),
    });
    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || "Falha ao criar finalidade");
    }
    return response.json() as Promise<Purpose>;
  },

  async getPurposeById(purposeId: number) {
    const response = await fetch(`${API_BASE_URL}/purposes/${purposeId}`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || "Falha ao buscar finalidade");
    }
    return response.json() as Promise<Purpose>;
  },

  async updatePurpose(purposeId: number, data: PurposeUpdate) {
    const response = await fetch(`${API_BASE_URL}/purposes/${purposeId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || "Falha ao atualizar finalidade");
    }
    return response.json() as Promise<Purpose>;
  },

  async deletePurpose(purposeId: number) {
    const response = await fetch(`${API_BASE_URL}/purposes/${purposeId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || "Falha ao excluir finalidade");
    }
  },
};

export const userApi = {
  async createUser(data: UserCreateInput) {
    const response = await fetch(`${API_BASE_URL}/users/register`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        ...data,
        active: data.active ?? true,
      }),
    });
    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || "Falha ao criar usuário");
    }
    return response.json() as Promise<User>;
  },

  async getCurrentUser() {
    const response = await fetch(`${API_BASE_URL}/users/me`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || "Falha ao buscar usuário atual");
    }
    return response.json() as Promise<User>;
  },

  async getAllUsers(skip = 0, limit = 100) {
    const response = await fetch(
      `${API_BASE_URL}/users?skip=${skip}&limit=${limit}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );
    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || "Falha ao buscar usuários");
    }
    return response.json() as Promise<User[]>;
  },

  async updateUser(userId: number, data: UserUpdate) {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || "Falha ao atualizar usuário");
    }
    return response.json() as Promise<User>;
  },

  async updateUserRoles(userId: number, data: UserRolesUpdate) {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || "Falha ao atualizar perfis do usuário");
    }
    return response.json() as Promise<User>;
  },

  async deleteUser(userId: number) {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || "Falha ao excluir usuário");
    }
  },
};

// Organizational Units

export interface OrganizationalUnit {
  id: number;
  name: string;
  type: string;
}

export interface OrganizationalUnitCreate {
  name: string;
  type: string;
}

export const organizationalUnitApi = {
  async getAll(skip = 0, limit = 100): Promise<OrganizationalUnit[]> {
    const response = await fetch(
      `${API_BASE_URL}/organizational-units?skip=${skip}&limit=${limit}`,
      { method: "GET", headers: getAuthHeaders() }
    );
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao buscar unidades organizacionais");
      throw new Error(detail);
    }
    return response.json() as Promise<OrganizationalUnit[]>;
  },

  async getById(id: number): Promise<OrganizationalUnit> {
    const response = await fetch(`${API_BASE_URL}/organizational-units/${id}`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao buscar unidade organizacional");
      throw new Error(detail);
    }
    return response.json() as Promise<OrganizationalUnit>;
  },

  async create(data: OrganizationalUnitCreate): Promise<OrganizationalUnit> {
    const response = await fetch(`${API_BASE_URL}/organizational-units`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao criar unidade organizacional");
      throw new Error(detail);
    }
    return response.json() as Promise<OrganizationalUnit>;
  },

  async update(id: number, data: Partial<OrganizationalUnitCreate>): Promise<OrganizationalUnit> {
    const response = await fetch(`${API_BASE_URL}/organizational-units/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao atualizar unidade organizacional");
      throw new Error(detail);
    }
    return response.json() as Promise<OrganizationalUnit>;
  },

  async delete(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/organizational-units/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao excluir unidade organizacional");
      throw new Error(detail);
    }
  },
};

// Qualifications

export interface Qualification {
  id: number;
  name: string;
  description: string;
}

export interface QualificationCreate {
  name: string;
  description: string;
}

export interface UserQualification {
  id: number;
  user_id: number;
  qualification_id: number;
  valid_until: string;
}

export interface UserQualificationCreate {
  user_id: number;
  qualification_id: number;
  valid_until: string;
}

export const qualificationApi = {
  async getAll(skip = 0, limit = 100): Promise<Qualification[]> {
    const response = await fetch(
      `${API_BASE_URL}/qualifications?skip=${skip}&limit=${limit}`,
      { method: "GET", headers: getAuthHeaders() }
    );
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao buscar qualificações");
      throw new Error(detail);
    }
    return response.json() as Promise<Qualification[]>;
  },

  async getById(id: number): Promise<Qualification> {
    const response = await fetch(`${API_BASE_URL}/qualifications/${id}`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao buscar qualificação");
      throw new Error(detail);
    }
    return response.json() as Promise<Qualification>;
  },

  async create(data: QualificationCreate): Promise<Qualification> {
    const response = await fetch(`${API_BASE_URL}/qualifications`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao criar qualificação");
      throw new Error(detail);
    }
    return response.json() as Promise<Qualification>;
  },

  async update(id: number, data: Partial<QualificationCreate>): Promise<Qualification> {
    const response = await fetch(`${API_BASE_URL}/qualifications/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao atualizar qualificação");
      throw new Error(detail);
    }
    return response.json() as Promise<Qualification>;
  },

  async delete(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/qualifications/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao excluir qualificação");
      throw new Error(detail);
    }
  },

  async listUserQualifications(userId: number): Promise<UserQualification[]> {
    const response = await fetch(`${API_BASE_URL}/qualifications/users/${userId}`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao buscar qualificações do usuário");
      throw new Error(detail);
    }
    return response.json() as Promise<UserQualification[]>;
  },

  async assignToUser(data: UserQualificationCreate): Promise<UserQualification> {
    const response = await fetch(`${API_BASE_URL}/qualifications/users`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao atribuir qualificação");
      throw new Error(detail);
    }
    return response.json() as Promise<UserQualification>;
  },

  async removeFromUser(userQualificationId: number): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/qualifications/users/${userQualificationId}`,
      { method: "DELETE", headers: getAuthHeaders() }
    );
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao remover qualificação");
      throw new Error(detail);
    }
  },
};

// ========== Reservas ==========

export type ReservationStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "PRE_BLOCKED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "IN_USE"
  | "COMPLETED"
  | "NO_SHOW"
  | "EXPIRED";

export type ReservationType =
  | "SIMPLE"
  | "RECURRING"
  | "COMPOSITE_PARENT"
  | "COMPOSITE_CHILD";

export type ReservationPurpose =
  | "CLASS"
  | "MEETING"
  | "RESEARCH"
  | "EVENT"
  | "MAINTENANCE"
  | "TRAINING";

export interface QualificationStatus {
  required: number[];
  held: number[];
  missing: number[];
  meets_all: boolean;
}

export interface RecurrenceSpec {
  weekdays: number[];
  occurrences: number;
}

export type SupportType =
  | "IT_SUPPORT"
  | "AUDIOVISUAL"
  | "LAB_TECHNICIAN"
  | "SECURITY"
  | "CLEANING";

export const SUPPORT_TYPES: SupportType[] = [
  "IT_SUPPORT",
  "AUDIOVISUAL",
  "LAB_TECHNICIAN",
  "SECURITY",
  "CLEANING",
];

export const SUPPORT_TYPE_LABELS: Record<SupportType, string> = {
  IT_SUPPORT: "Suporte de TI",
  AUDIOVISUAL: "Audiovisual",
  LAB_TECHNICIAN: "Técnico de laboratório",
  SECURITY: "Segurança",
  CLEANING: "Limpeza",
};

export interface ReservationResourceRead {
  id: number;
  resource_id: number;
}

export interface ReservationSupportRead {
  id: number;
  support_type: SupportType;
  responsible_staff_id: number | null;
}

export interface Reservation {
  id: number;
  environment_id: number;
  requester_id: number;
  responsible_id: number;
  start_time: string;
  end_time: string;
  status: ReservationStatus;
  type: ReservationType;
  purpose: ReservationPurpose;
  participant_count: number;
  checkin_at: string | null;
  checkout_at: string | null;
  terms_accepted_at?: string | null;
  resources: ReservationResourceRead[];
  support: ReservationSupportRead[];
}

export interface ReservationResourceCreate {
  resource_id: number;
}

export interface ReservationSupportCreate {
  support_type: SupportType;
  responsible_staff_id?: number | null;
}

export interface ReservationCreate {
  environment_id: number;
  requester_id: number;
  responsible_id: number;
  start_time: string;
  end_time: string;
  purpose: ReservationPurpose;
  participant_count: number;
  accept_terms: boolean;
  type?: ReservationType;
  recurrence?: RecurrenceSpec | null;
  resources?: ReservationResourceCreate[];
  support?: ReservationSupportCreate[];
}

export interface ReservationUpdate {
  environment_id?: number;
  responsible_id?: number;
  start_time?: string;
  end_time?: string;
  purpose?: ReservationPurpose;
  participant_count?: number;
  resources?: ReservationResourceCreate[];
  support?: ReservationSupportCreate[];
}

export interface ReservationConflictDetail {
  type: string;
  detail: string;
}

export class ReservationConflictError extends Error {
  conflicts: ReservationConflictDetail[];
  constructor(message: string, conflicts: ReservationConflictDetail[]) {
    super(message);
    this.name = "ReservationConflictError";
    this.conflicts = conflicts;
  }
}

const parseReservationError = async (
  response: Response,
  fallbackMessage: string
): Promise<string> => {
  if (response.status === 401) {
    clearAuthTokens();
    return "Sua sessão expirou. Faça login novamente.";
  }
  try {
    const body = (await response.json()) as { detail: unknown };
    if (
      response.status === 409 &&
      body.detail &&
      typeof body.detail === "object"
    ) {
      const detail = body.detail as {
        message?: string;
        conflicts?: ReservationConflictDetail[];
      };
      throw new ReservationConflictError(
        detail.message || "Conflito detectado",
        detail.conflicts ?? []
      );
    }
    if (typeof body.detail === "string") {
      return body.detail;
    }
    return fallbackMessage;
  } catch (err) {
    if (err instanceof ReservationConflictError) {
      throw err;
    }
    return fallbackMessage;
  }
};

export interface ReservationDecisionInput {
  comments?: string;
}

export interface ReservationListParams {
  skip?: number;
  limit?: number;
  environment_id?: number;
  requester_id?: number;
  status_filter?: ReservationStatus;
  start_after?: string;
  end_before?: string;
}

const buildQuery = (params: Record<string, unknown>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.append(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
};

export const reservationQualificationApi = {
  status: (reservationId: number) =>
    apiFetch<QualificationStatus>(
      `reservas/${reservationId}/qualificacoes-solicitante`
    ),
};

export const reservationApi = {
  async list(params: ReservationListParams = {}): Promise<Reservation[]> {
    const response = await fetch(
      `${API_BASE_URL}/reservas${buildQuery(params as Record<string, unknown>)}`,
      { headers: getAuthHeaders() }
    );
    if (!response.ok) {
      const detail = await parseReservationError(
        response,
        "Falha ao listar reservas"
      );
      throw new Error(detail);
    }
    return response.json() as Promise<Reservation[]>;
  },

  async getById(id: number): Promise<Reservation> {
    const response = await fetch(`${API_BASE_URL}/reservas/${id}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const detail = await parseReservationError(
        response,
        "Falha ao buscar reserva"
      );
      throw new Error(detail);
    }
    return response.json() as Promise<Reservation>;
  },

  async create(data: ReservationCreate): Promise<Reservation> {
    const response = await fetch(`${API_BASE_URL}/reservas`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const detail = await parseReservationError(
        response,
        "Falha ao criar reserva"
      );
      throw new Error(detail);
    }
    return response.json() as Promise<Reservation>;
  },

  async update(id: number, data: ReservationUpdate): Promise<Reservation> {
    const response = await fetch(`${API_BASE_URL}/reservas/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const detail = await parseReservationError(
        response,
        "Falha ao atualizar reserva"
      );
      throw new Error(detail);
    }
    return response.json() as Promise<Reservation>;
  },

  async cancel(id: number, reason: string): Promise<Reservation> {
    const response = await fetch(`${API_BASE_URL}/reservas/${id}/cancelar`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) {
      const detail = await parseReservationError(
        response,
        "Falha ao cancelar reserva"
      );
      throw new Error(detail);
    }
    return response.json() as Promise<Reservation>;
  },

  async listPending(skip = 0, limit = 100): Promise<Reservation[]> {
    const response = await fetch(
      `${API_BASE_URL}/reservas/pendentes/lista?skip=${skip}&limit=${limit}`,
      { headers: getAuthHeaders() }
    );
    if (!response.ok) {
      const detail = await parseReservationError(
        response,
        "Falha ao listar reservas pendentes"
      );
      throw new Error(detail);
    }
    return response.json() as Promise<Reservation[]>;
  },

  async approve(id: number, comments?: string): Promise<Reservation> {
    const response = await fetch(`${API_BASE_URL}/reservas/${id}/aprovar`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ comments } satisfies ReservationDecisionInput),
    });
    if (!response.ok) {
      const detail = await parseReservationError(
        response,
        "Falha ao aprovar reserva"
      );
      throw new Error(detail);
    }
    return response.json() as Promise<Reservation>;
  },

  async reject(id: number, comments: string): Promise<Reservation> {
    const response = await fetch(`${API_BASE_URL}/reservas/${id}/rejeitar`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ comments } satisfies ReservationDecisionInput),
    });
    if (!response.ok) {
      const detail = await parseReservationError(
        response,
        "Falha ao rejeitar reserva"
      );
      throw new Error(detail);
    }
    return response.json() as Promise<Reservation>;
  },

  async checkin(id: number): Promise<Reservation> {
    const response = await fetch(`${API_BASE_URL}/reservas/${id}/checkin`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const detail = await parseReservationError(
        response,
        "Falha ao registrar check-in"
      );
      throw new Error(detail);
    }
    return response.json() as Promise<Reservation>;
  },

  async checkout(id: number): Promise<Reservation> {
    const response = await fetch(`${API_BASE_URL}/reservas/${id}/checkout`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const detail = await parseReservationError(
        response,
        "Falha ao registrar check-out"
      );
      throw new Error(detail);
    }
    return response.json() as Promise<Reservation>;
  },
};

export interface CompositeItemInput {
  environment_id: number;
  start_time: string;
  end_time: string;
  participant_count: number;
  purpose: ReservationPurpose;
  resources: ReservationResourceCreate[];
  support: { support_type: string; responsible_staff_id?: number | null }[];
  critical: boolean;
}

export interface CompositeReservationCreate {
  name: string;
  description?: string;
  responsible_id: number;
  accept_terms: boolean;
  items: CompositeItemInput[];
}

export interface CompositeItem {
  id: number;
  reservation_id: number;
  critical: boolean;
  order: number;
}

export interface CompositeReservation {
  id: number;
  name: string;
  description: string | null;
  items: CompositeItem[];
}

export const compositeApi = {
  async create(payload: CompositeReservationCreate): Promise<CompositeReservation> {
    const response = await fetch(`${API_BASE_URL}/reservas/compostas`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const detail = await parseReservationError(
        response,
        "Falha ao criar reserva composta"
      );
      throw new Error(detail);
    }
    return response.json() as Promise<CompositeReservation>;
  },

  async get(compositeId: number): Promise<CompositeReservation> {
    const response = await fetch(
      `${API_BASE_URL}/reservas/compostas/${compositeId}`,
      { headers: getAuthHeaders() },
    );
    if (!response.ok) {
      const detail = await parseReservationError(
        response,
        "Falha ao carregar reserva composta"
      );
      throw new Error(detail);
    }
    return response.json() as Promise<CompositeReservation>;
  },

  async getByReservationId(reservationId: number): Promise<CompositeReservation> {
    const response = await fetch(
      `${API_BASE_URL}/reservas/${reservationId}/composta`,
      { headers: getAuthHeaders() },
    );
    if (!response.ok) {
      const detail = await parseReservationError(
        response,
        "Falha ao carregar reserva composta"
      );
      throw new Error(detail);
    }
    return response.json() as Promise<CompositeReservation>;
  },

  async cancelItem(
    compositeId: number,
    reservationId: number,
    reason: string,
  ): Promise<CompositeReservation> {
    const response = await fetch(
      `${API_BASE_URL}/reservas/compostas/${compositeId}/itens/${reservationId}/cancelar`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason }),
      },
    );
    if (!response.ok) {
      const detail = await parseReservationError(
        response,
        "Falha ao cancelar item da composta"
      );
      throw new Error(detail);
    }
    return response.json() as Promise<CompositeReservation>;
  },
};

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "APPROVE"
  | "REJECT"
  | "CANCEL"
  | "CHECKIN"
  | "CHECKOUT"
  | "ASSIGN_RESOURCE"
  | "REMOVE_RESOURCE";

export interface AuditRecord {
  id: number;
  entity_type: string;
  target_id: number;
  action: AuditAction;
  performed_by: number;
  performed_at: string;
  before_state: string | null;
  after_state: string | null;
}

export interface AuditListFilters {
  entity_type?: string;
  target_id?: number;
  action?: AuditAction;
  start?: string;
  end?: string;
  skip?: number;
  limit?: number;
}

export const auditApi = {
  async list(filters: AuditListFilters = {}): Promise<AuditRecord[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") return;
      params.set(k, String(v));
    });
    const response = await fetch(
      `${API_BASE_URL}/audit-records${params.toString() ? `?${params}` : ""}`,
      { headers: getAuthHeaders() }
    );
    if (!response.ok) {
      if (response.status === 401) {
        clearAuthTokens();
        throw new Error("Sua sessão expirou. Faça login novamente.");
      }
      let message = "Falha ao consultar auditoria";
      try {
        const body = (await response.json()) as { detail?: string };
        if (typeof body.detail === "string") message = body.detail;
      } catch {
        // ignore parse failure
      }
      throw new Error(message);
    }
    return response.json() as Promise<AuditRecord[]>;
  },
};

export const AUDIT_ENTITY_TYPES = [
  "reservation",
  "environment",
  "resource",
  "resource_maintenance",
  "location",
  "user",
  "penalty",
  "appeal",
  "incident",
  "calendar_block",
  "composite_reservation",
] as const;

function auditQueryString(filters: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== "") params.set(k, String(v));
  });
  return params.toString();
}

export const auditExport = {
  csvUrl: (filters: Record<string, string | number | undefined>) =>
    `${API_BASE_URL}/audit-records/export.csv?${auditQueryString(filters)}`,
};

export type CalendarBlockType =
  | "ADMIN_BLOCK"
  | "MAINTENANCE"
  | "RECURRING_EVENT"
  | "BUFFER"
  | "HOLIDAY"
  | "CLOSURE";

export type CalendarBlockPriority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW";

export interface CalendarBlock {
  id: number;
  environment_id: number;
  start_time: string;
  end_time: string;
  type: CalendarBlockType;
  priority: string;
}

export interface CalendarBlockCreate {
  environment_id: number;
  start_time: string;
  end_time: string;
  type: CalendarBlockType;
  priority?: string;
}

export type CalendarBlockUpdate = Partial<CalendarBlockCreate>;

const _calendarBlockError = async (
  response: Response,
  fallback: string
): Promise<string> => {
  if (response.status === 401) {
    clearAuthTokens();
    return "Sua sessão expirou. Faça login novamente.";
  }
  try {
    const body = (await response.json()) as { detail?: string };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // ignore
  }
  return fallback;
};

export const calendarBlockApi = {
  async list(environmentId?: number): Promise<CalendarBlock[]> {
    const url = new URL(`${API_BASE_URL}/calendar-blocks`);
    if (environmentId !== undefined) {
      url.searchParams.set("environment_id", String(environmentId));
    }
    url.searchParams.set("limit", "500");
    const response = await fetch(url.toString(), { headers: getAuthHeaders() });
    if (!response.ok) {
      throw new Error(await _calendarBlockError(response, "Falha ao listar bloqueios"));
    }
    return response.json() as Promise<CalendarBlock[]>;
  },

  async create(payload: CalendarBlockCreate): Promise<CalendarBlock> {
    const response = await fetch(`${API_BASE_URL}/calendar-blocks`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(await _calendarBlockError(response, "Falha ao criar bloqueio"));
    }
    return response.json() as Promise<CalendarBlock>;
  },

  async update(id: number, payload: CalendarBlockUpdate): Promise<CalendarBlock> {
    const response = await fetch(`${API_BASE_URL}/calendar-blocks/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(await _calendarBlockError(response, "Falha ao atualizar bloqueio"));
    }
    return response.json() as Promise<CalendarBlock>;
  },

  async remove(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/calendar-blocks/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error(await _calendarBlockError(response, "Falha ao remover bloqueio"));
    }
  },

  async releaseEarly(id: number, notes?: string): Promise<CalendarBlock> {
    const response = await fetch(`${API_BASE_URL}/calendar-blocks/${id}/liberar`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ notes: notes ?? null }),
    });
    if (!response.ok) {
      throw new Error(await _calendarBlockError(response, "Falha ao liberar bloqueio"));
    }
    return response.json() as Promise<CalendarBlock>;
  },
};

export const getTokenRoles = (): string[] => {
  if (!isBrowser) {
    return [];
  }

  const token = getAccessToken();
  if (!token) {
    return [];
  }

  const payload = parseTokenPayload(token);
  if (!payload) {
    return [];
  }

  return Array.isArray(payload.roles)
    ? payload.roles.filter((role): role is string => typeof role === "string")
    : [];
};

// ========== Penalidades & Recursos (Governance) ==========

export type PenaltyType =
  | "NO_SHOW"
  | "LATE_CANCELLATION"
  | "DAMAGE"
  | "MISUSE"
  | "OVERTIME"
  | "SAFETY_VIOLATION";

export type PenaltyStatus =
  | "PENDING"
  | "APPLIED"
  | "WAIVED"
  | "UNDER_APPEAL"
  | "RESOLVED";

export type AppealStatus = "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";

export interface Penalty {
  id: number;
  user_id: number;
  reservation_id: number;
  type: PenaltyType;
  status: PenaltyStatus;
  description: string;
  duration_days: number | null;
  start_date: string | null;
  end_date: string | null;
  applied_by: number | null;
}

export interface PenaltyManualCreate {
  user_id: number;
  reservation_id: number;
  type: PenaltyType;
  description: string;
  duration_days?: number;
}

export interface Appeal {
  id: number;
  penalty_id: number;
  status: AppealStatus;
  resolution_notes: string | null;
}

const _governanceError = async (response: Response, fallback: string): Promise<string> => {
  if (response.status === 401) {
    clearAuthTokens();
    return "Sua sessão expirou. Faça login novamente.";
  }
  try {
    const body = (await response.json()) as { detail?: string };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // ignore
  }
  return fallback;
};

export const penaltyApi = {
  async list(filters: { user_id?: number; skip?: number; limit?: number } = {}): Promise<Penalty[]> {
    const params = new URLSearchParams();
    if (filters.user_id !== undefined) params.set("user_id", String(filters.user_id));
    if (filters.skip !== undefined) params.set("skip", String(filters.skip));
    if (filters.limit !== undefined) params.set("limit", String(filters.limit));
    const url = `${API_BASE_URL}/governance/penalidades${params.toString() ? `?${params}` : ""}`;
    const response = await fetch(url, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error(await _governanceError(response, "Falha ao listar penalidades"));
    return response.json() as Promise<Penalty[]>;
  },
  async createManual(payload: PenaltyManualCreate): Promise<Penalty> {
    const response = await fetch(`${API_BASE_URL}/governance/penalidades`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await _governanceError(response, "Falha ao criar penalidade"));
    return response.json() as Promise<Penalty>;
  },
};

export const appealApi = {
  listPending: () =>
    apiFetch<Appeal[]>(`/api/v1/governance/appeals?status_filter=SUBMITTED`),
  async submit(penalty_id: number, justification: string): Promise<Appeal> {
    const response = await fetch(`${API_BASE_URL}/governance/appeals`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ penalty_id, justification }),
    });
    if (!response.ok) throw new Error(await _governanceError(response, "Falha ao submeter recurso"));
    return response.json() as Promise<Appeal>;
  },
  async resolve(appealId: number, approve: boolean, resolution_notes: string): Promise<Appeal> {
    const response = await fetch(`${API_BASE_URL}/governance/appeals/${appealId}/resolver`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ approve, resolution_notes }),
    });
    if (!response.ok) throw new Error(await _governanceError(response, "Falha ao resolver recurso"));
    return response.json() as Promise<Appeal>;
  },
};

// ========== Incidentes (Operations) ==========

export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Incident {
  id: number;
  reservation_id: number;
  description: string;
  severity: IncidentSeverity;
  reported_at: string;
}

export interface IncidentCreate {
  reservation_id: number;
  description: string;
  severity: IncidentSeverity;
}

const _opsError = async (response: Response, fallback: string): Promise<string> => {
  if (response.status === 401) {
    clearAuthTokens();
    return "Sua sessão expirou. Faça login novamente.";
  }
  try {
    const body = (await response.json()) as { detail?: string };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // ignore
  }
  return fallback;
};

export const incidentApi = {
  async list(reservationId?: number): Promise<Incident[]> {
    const params = new URLSearchParams();
    params.set("limit", "200");
    if (reservationId !== undefined) params.set("reservation_id", String(reservationId));
    const response = await fetch(`${API_BASE_URL}/operations/incidentes?${params}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error(await _opsError(response, "Falha ao listar incidentes"));
    return response.json() as Promise<Incident[]>;
  },
  async create(payload: IncidentCreate): Promise<Incident> {
    const response = await fetch(`${API_BASE_URL}/operations/incidentes`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await _opsError(response, "Falha ao registrar incidente"));
    return response.json() as Promise<Incident>;
  },
};

// ========== Resource Maintenance & Transfer ==========

export interface ResourceMaintenance {
  id: number;
  resource_id: number;
  start_date: string;
  end_date: string;
  reason: string;
}

export const resourceMaintenanceApi = {
  async list(resourceId?: number) {
    const qs = resourceId ? `?resource_id=${resourceId}` : "";
    const response = await fetch(`${API_BASE_URL}/resources/manutencoes${qs}`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao buscar manutenções");
      throw new Error(detail);
    }
    return response.json() as Promise<ResourceMaintenance[]>;
  },

  async create(body: {
    resource_id: number;
    start_date: string;
    end_date: string;
    reason: string;
  }) {
    const response = await fetch(`${API_BASE_URL}/resources/manutencoes`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao criar manutenção");
      throw new Error(detail);
    }
    return response.json() as Promise<ResourceMaintenance>;
  },

  async remove(id: number) {
    const response = await fetch(`${API_BASE_URL}/resources/manutencoes/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao remover manutenção");
      throw new Error(detail);
    }
  },
};

export const resourceTransferApi = {
  async transfer(resourceId: number, locationId: number) {
    const response = await fetch(
      `${API_BASE_URL}/resources/${resourceId}/transferir`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ location_id: locationId }),
      }
    );
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao transferir recurso");
      throw new Error(detail);
    }
    return response.json() as Promise<Resource>;
  },
};

export type NotificationType =
  | "RESERVATION_APPROVED"
  | "RESERVATION_REJECTED"
  | "SUPPORT_PENDING"
  | "PENALTY_APPLIED"
  | "APPEAL_RESOLVED"
  | "COMPOSITE_REVISION_REQUIRED";

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  related_entity_type: string | null;
  related_target_id: number | null;
  created_at: string;
}

export const notificationApi = {
  async list(onlyUnread = false) {
    const response = await fetch(
      `${API_BASE_URL}/notificacoes?only_unread=${onlyUnread}`,
      { method: "GET", headers: getAuthHeaders() }
    );
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao buscar notificações");
      throw new Error(detail);
    }
    return response.json() as Promise<Notification[]>;
  },

  async unreadCount() {
    const response = await fetch(`${API_BASE_URL}/notificacoes/contagem`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao buscar contagem de notificações");
      throw new Error(detail);
    }
    return response.json() as Promise<{ unread: number }>;
  },

  async markRead(id: number) {
    const response = await fetch(`${API_BASE_URL}/notificacoes/${id}/lida`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const detail = await parseErrorDetail(response, "Falha ao marcar notificação como lida");
      throw new Error(detail);
    }
    return response.json() as Promise<Notification>;
  },
};

export interface AvailabilityResponse {
  available: boolean;
  conflicts: { type: string; detail: string }[];
  suggestions: { start_time: string; end_time: string }[];
}

export type RecommendationStrategy = "FIRST_FIT" | "WEIGHTED_SCORE";

export interface RecommendationCriteria {
  start_time: string;
  end_time: string;
  participant_count: number;
  environment_types?: EnvironmentType[];
  location_id?: number;
  required_resource_types?: ResourceType[];
  support_types?: SupportType[];
  strategy?: RecommendationStrategy;
  limit?: number;
}

export interface RecommendedResource {
  id: number;
  name: string;
  type: ResourceType;
}

export interface EnvironmentRecommendation {
  environment: Room;
  resources: RecommendedResource[];
  support_types: SupportType[];
  strategy: RecommendationStrategy;
  score: number;
  reasons: string[];
}

export interface RecommendationResponse {
  recommendations: EnvironmentRecommendation[];
  message: string | null;
}

export const recommendationApi = {
  async find(criteria: RecommendationCriteria): Promise<RecommendationResponse> {
    return apiFetch<RecommendationResponse>(
      "recomendacoes/ambientes",
      { method: "POST", body: JSON.stringify(criteria) },
      "Falha ao buscar recomendações"
    );
  },
};

export const reservationAvailabilityApi = {
  async check(params: {
    environment_id: number;
    start: string;
    end: string;
    participant_count: number;
  }) {
    const q = new URLSearchParams({
      environment_id: String(params.environment_id),
      start: params.start,
      end: params.end,
      participant_count: String(params.participant_count),
    }).toString();
    const response = await fetch(
      `${API_BASE_URL}/reservas/disponibilidade?${q}`,
      { method: "GET", headers: getAuthHeaders() }
    );
    if (!response.ok) {
      const detail = await parseErrorDetail(
        response,
        "Falha ao verificar disponibilidade"
      );
      throw new Error(detail);
    }
    return response.json() as Promise<AvailabilityResponse>;
  },
};
