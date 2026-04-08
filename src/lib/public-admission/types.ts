export interface PublicSelectOption {
  id: number;
  label: string;
  raw: Record<string, unknown>;
}

export interface PublicLookupResult {
  fullName?: string;
  nationalId?: string;
  status?: "PENDING" | "APPROVED" | "ENROLLED" | "REJECTED" | string;
  periodName?: string;
  majorName?: string;
  blockName?: string;
  totalScore?: number;
}

export interface PublicAdmissionApplyPayload {
  fullName: string;
  dateOfBirth: string;
  gender: boolean;
  email: string;
  phone: string;
  guardianPhone: string;
  nationalId: string;
  address: string;
  periodId: number;
  majorId: number;
  blockId: number;
  totalScore: number;
}
