import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  color: text("color").notNull().default("#809B75"),
  status: text("status").notNull().default("active"),
  details: text("details").notNull().default(""),
  dspEnabled: integer("dsp_enabled", { mode: "boolean" }).notNull().default(false),
  fanoutsEnabled: integer("fanouts_enabled", { mode: "boolean" }).notNull().default(false),
  llmShareLinksEnabled: integer("llm_share_links_enabled", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  archivedAt: text("archived_at"),
});

export const promptFamilies = sqliteTable("prompt_families", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  tags: text("tags").notNull().default(""),
  promptText: text("prompt_text").notNull().default(""),
  sourceUrls: text("source_urls").notNull().default(""),
  logicTrace: text("logic_trace").notNull().default(""),
  referenceAnswer: text("reference_answer").notNull().default(""),
  notes: text("notes").notNull().default(""),
  archivedAt: text("archived_at"),
  archiveReason: text("archive_reason"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const variants = sqliteTable(
  "variants",
  {
    id: text("id").primaryKey(),
    promptId: text("prompt_id").notNull(),
    project: text("project").notNull(),
    projectSlug: text("project_slug").notNull(),
    version: integer("version").notNull(),
    basedOn: text("based_on").notNull(),
    promptText: text("prompt_text").notNull().default(""),
    promptUrls: text("prompt_urls").notNull().default(""),
    dspText: text("dsp_text").notNull().default(""),
    fanoutsText: text("fanouts_text").notNull().default(""),
    llmShareLinksText: text("llm_share_links_text").notNull().default(""),
    logicTrace: text("logic_trace").notNull().default(""),
    referenceAnswer: text("reference_answer").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("variants_prompt_project_version_idx").on(
      table.promptId,
      table.projectSlug,
      table.version,
    ),
  ],
);

export const variantModelTests = sqliteTable(
  "variant_model_tests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    variantId: text("variant_id").notNull(),
    model: text("model").notNull(),
    result: text("result").notNull(),
    testedAt: text("tested_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
);

export const promptModelTests = sqliteTable(
  "prompt_model_tests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    promptId: text("prompt_id").notNull(),
    model: text("model").notNull(),
    result: text("result").notNull(),
    testedAt: text("tested_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
);

export const sourceUrls = sqliteTable("source_urls", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  url: text("url").notNull().unique(),
  tags: text("tags").notNull().default(""),
  notes: text("notes").notNull().default(""),
  addedAt: text("added_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  usedAt: text("used_at"),
  promptId: text("prompt_id"),
  variantId: text("variant_id"),
});

export const submissions = sqliteTable("submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  promptId: text("prompt_id").notNull(),
  variantId: text("variant_id").notNull().unique(),
  project: text("project").notNull(),
  submittedAt: text("submitted_at").notNull(),
  submissionRef: text("submission_ref").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
