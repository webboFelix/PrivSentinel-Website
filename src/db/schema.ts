import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () => integer("createdAt", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date());
const updatedAt = () => integer("updatedAt", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date());

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("user"),
  banned: integer("banned", { mode: "boolean" }).notNull().default(false),
  banReason: text("banReason"),
  banExpires: integer("banExpires", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  impersonatedBy: text("impersonatedBy"),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (table) => [index("session_userId_idx").on(table.userId)]);

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp_ms" }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp_ms" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [index("account_userId_idx").on(table.userId)]);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [index("verification_identifier_idx").on(table.identifier)]);

export const profileDetails = sqliteTable("profile_details", {
  userId: text("userId").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  phoneNumber: text("phoneNumber"),
  phoneCountry: text("phoneCountry"),
  phoneCountryCode: text("phoneCountryCode"),
  gender: text("gender"),
  countryCode: text("countryCode"),
  city: text("city"),
  region: text("region"),
  organization: text("organization"),
  currentPosition: text("currentPosition"),
  location: text("location"),
  avatar: text("avatar"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const billingCustomers = sqliteTable("billing_customers", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull().unique().references(() => user.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripeCustomerId").notNull().unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const paymentMethods = sqliteTable("payment_methods", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  brand: text("brand").notNull(),
  last4: text("last4").notNull(),
  expiryMonth: integer("expiryMonth").notNull(),
  expiryYear: integer("expiryYear").notNull(),
  createdAt: createdAt(),
}, (table) => [index("payment_methods_userId_idx").on(table.userId)]);

export const releases = sqliteTable("releases", {
  id: text("id").primaryKey(),
  version: text("version").notNull(),
  tagName: text("tagName").notNull(),
  releaseName: text("releaseName").notNull(),
  releaseNotes: text("releaseNotes").notNull(),
  publishedAt: integer("publishedAt", { mode: "timestamp_ms" }),
  installerName: text("installerName"),
  installerUrl: text("installerUrl"),
  installerSize: integer("installerSize"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("releases_tagName_unique").on(table.tagName),
  index("releases_publishedAt_idx").on(table.publishedAt),
]);

export const downloads = sqliteTable("downloads", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  releaseId: text("releaseId").notNull().references(() => releases.id),
  assetName: text("assetName").notNull(),
  downloadedAt: integer("downloadedAt", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index("downloads_userId_idx").on(table.userId),
  index("downloads_releaseId_idx").on(table.releaseId),
  index("downloads_downloadedAt_idx").on(table.downloadedAt),
]);

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  userId: text("userId").references(() => user.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  targetType: text("targetType"),
  targetId: text("targetId"),
  metadata: text("metadata"),
}, (table) => [index("audit_logs_timestamp_idx").on(table.timestamp)]);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: integer("windowStart").notNull(),
  count: integer("count").notNull().default(0),
});

export const securityEvents = sqliteTable("security_events", {
  id: text("id").primaryKey(),
  userId: text("userId").references(() => user.id, { onDelete: "set null" }),
  email: text("email"),
  name: text("name"),
  ipAddress: text("ipAddress").notNull(),
  userAgent: text("userAgent"),
  action: text("action").notNull(),
  createdAt: createdAt(),
}, (table) => [
  index("security_events_ip_created_idx").on(table.ipAddress, table.createdAt),
  index("security_events_created_idx").on(table.createdAt),
]);

export const blockedIps = sqliteTable("blocked_ips", {
  ipAddress: text("ipAddress").primaryKey(),
  reason: text("reason").notNull(),
  blockedBy: text("blockedBy").references(() => user.id, { onDelete: "set null" }),
  blockedAt: integer("blockedAt", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const contactMessages = sqliteTable("contact_messages", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("new"),
  response: text("response"),
  respondedBy: text("respondedBy").references(() => user.id, { onDelete: "set null" }),
  respondedAt: integer("respondedAt", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
}, (table) => [
  index("contact_messages_status_created_idx").on(table.status, table.createdAt),
]);

export const testimonials = sqliteTable("testimonials", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location"),
  quote: text("quote").notNull(),
  title: text("title").notNull().default(""),
  userId: text("userId").references(() => user.id, { onDelete: "set null" }),
  designation: text("designation"),
  publicConsent: integer("publicConsent", { mode: "boolean" }).notNull().default(false),
  displayNameConsent: integer("displayNameConsent", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("pending"),
  rating: integer("rating").notNull(),
  approvedAt: integer("approvedAt", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
  reviewedBy: text("reviewedBy").references(() => user.id, { onDelete: "set null" }),
  reviewedAt: integer("reviewedAt", { mode: "timestamp_ms" }),
}, (table) => [
  index("testimonials_approvedAt_idx").on(table.approvedAt),
  uniqueIndex("testimonials_userId_unique").on(table.userId),
  index("testimonials_status_idx").on(table.status),
]);

export const releaseOverrides = sqliteTable("release_overrides", {
  tagName: text("tagName").primaryKey(),
  releaseName: text("releaseName"),
  releaseNotes: text("releaseNotes"),
  isPublished: integer("isPublished", { mode: "boolean" }).notNull().default(true),
  updatedBy: text("updatedBy").references(() => user.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

export const adminBootstrap = sqliteTable("admin_bootstrap", {
  id: text("id").primaryKey(),
  completedAt: integer("completedAt", { mode: "timestamp_ms" }),
  completedBy: text("completedBy").references(() => user.id, { onDelete: "set null" }),
});

export const schema = {
  user,
  session,
  account,
  verification,
  profileDetails,
  billingCustomers,
  paymentMethods,
  releases,
  releaseOverrides,
  downloads,
  auditLogs,
  rateLimits,
  securityEvents,
  blockedIps,
  contactMessages,
  testimonials,
  adminBootstrap,
};
