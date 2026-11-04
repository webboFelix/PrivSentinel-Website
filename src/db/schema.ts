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

export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull().unique().references(() => user.id, { onDelete: "cascade" }),
  fullName: text("fullName").notNull(),
  phoneNumber: text("phoneNumber"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const profileDetails = sqliteTable("profile_details", {
  userId: text("userId").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  gender: text("gender"),
  organization: text("organization"),
  currentPosition: text("currentPosition"),
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
  metadata: text("metadata"),
}, (table) => [index("audit_logs_timestamp_idx").on(table.timestamp)]);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: integer("windowStart").notNull(),
  count: integer("count").notNull().default(0),
});

export const testimonials = sqliteTable("testimonials", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location"),
  quote: text("quote").notNull(),
  rating: integer("rating").notNull(),
  approvedAt: integer("approvedAt", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
}, (table) => [index("testimonials_approvedAt_idx").on(table.approvedAt)]);

export const schema = { user, session, account, verification, profiles, profileDetails, billingCustomers, paymentMethods, releases, downloads, auditLogs, rateLimits, testimonials };
