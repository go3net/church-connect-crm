import { z } from "zod";

export const firstTimerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().min(7, "Phone is required"),
  email: z.string().email().optional().or(z.literal("")),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  dateOfBirth: z.string().optional(), // ISO date
  address: z.string().optional(),
  howHeard: z.string().optional(),
  invitedByName: z.string().optional(),
  prayerRequest: z.string().optional(),
  wantsVisit: z.boolean().optional(),
  branchId: z.string().optional(),
  firstServiceId: z.string().optional(),
});
export type FirstTimerInput = z.infer<typeof firstTimerSchema>;

export const memberSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(7),
  email: z.string().email().optional().or(z.literal("")),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  dateOfBirth: z.string().optional(),
  maritalStatus: z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"]).optional(),
  weddingDate: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  occupation: z.string().optional(),
  status: z
    .enum(["FIRST_TIMER", "NEW_CONVERT", "NEW_MEMBER", "ACTIVE_MEMBER", "INACTIVE_MEMBER"])
    .optional(),
  cellGroupId: z.string().optional(),
  branchId: z.string().optional(),
});
export type MemberInput = z.infer<typeof memberSchema>;

export const followUpSchema = z.object({
  type: z.enum(["CALL", "WHATSAPP", "HOME_VISIT", "PRAYER"]),
  memberId: z.string().optional(),
  firstTimerId: z.string().optional(),
  assignedToId: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

export const followUpUpdateSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  outcome: z
    .enum(["CONTACTED", "NOT_CONTACTED", "INTERESTED", "NEEDS_PRAYER", "NEEDS_VISIT"])
    .optional(),
  notes: z.string().optional(),
});
