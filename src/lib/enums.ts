// SQLite (used for zero-infra local/dev running) doesn't support native
// Prisma enums, so the schema stores these as validated strings. This file
// is the single source of truth for the allowed values — mirror any change
// here into prisma/schema.prisma's comments.

export const EMPLOYEE_ROLES = ["ADMIN", "PUBLISHER", "AUTHOR", "EMPLOYEE"] as const;
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

export const ACCOUNT_STATUSES = ["ACTIVE", "DEACTIVATED"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const AUTH_SOURCES = ["AD_SYNC", "MANUAL"] as const;
export type AuthSource = (typeof AUTH_SOURCES)[number];

export const VENDOR_ORG_TYPES = ["AGENCY", "DSA", "BPO", "OTHER"] as const;
export type VendorOrgType = (typeof VENDOR_ORG_TYPES)[number];

export const VENDOR_ORG_STATUSES = ["ACTIVE", "DEACTIVATED"] as const;
export type VendorOrgStatus = (typeof VENDOR_ORG_STATUSES)[number];

export const VENDOR_ROLES = ["VENDOR_ADMIN", "VENDOR_USER"] as const;
export type VendorRole = (typeof VENDOR_ROLES)[number];

export const SOURCE_TYPES = ["WYSIWYG", "DOCX_IMPORT", "PDF", "URL_IMPORT"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const VERSION_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "PUBLISHED",
  "RECALLED",
  "EXPIRED",
] as const;
export type VersionStatus = (typeof VERSION_STATUSES)[number];

export const APPROVAL_ACTION_TYPES = ["SUBMIT", "APPROVE", "REJECT"] as const;
export type ApprovalActionType = (typeof APPROVAL_ACTION_TYPES)[number];

export const TARGET_KINDS = [
  "EMPLOYEE_ATTRIBUTE",
  "VENDOR_ATTRIBUTE",
  "NAMED_EMPLOYEE",
  "NAMED_VENDOR_USER",
  "CUSTOM_LIST_EMPLOYEE",
  "CUSTOM_LIST_VENDOR",
] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];

export const ATTESTATION_METHODS = ["AD_REVERIFY", "OTP"] as const;
export type AttestationMethod = (typeof ATTESTATION_METHODS)[number];

export const NOTIFICATION_TYPES = ["PUBLISH", "REMINDER", "EXPIRY"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_CHANNELS = ["EMAIL", "SMS"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = ["QUEUED", "SENT", "FAILED"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const COVERAGE_STATUSES = [
  "NOT_STARTED",
  "DRAFT",
  "IN_REVIEW",
  "PUBLISHED",
  "EXPIRING",
  "OVERDUE_FOR_REVIEW",
] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

export const EMPLOYEE_TARGET_ATTRIBUTES = [
  "department",
  "location",
  "grade",
  "designation",
] as const;
export const VENDOR_TARGET_ATTRIBUTES = [
  "vendorOrg",
  "category",
  "region",
  "role",
  "geography",
] as const;

export const RBI_TAGS = ["NBFC", "CO_OP_BANK", "SMALL_FINANCE_BANK", "BANK", "OTHER"] as const;
export type RbiTag = (typeof RBI_TAGS)[number];
