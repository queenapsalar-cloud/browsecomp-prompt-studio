import { ensureSchema, getD1 } from "../../../db";

type ProjectRow = {
  id: number;
  name: string;
  slug: string;
  color: string;
  status: "active" | "inactive" | "archived";
  details: string;
  dsp_enabled: number;
  fanouts_enabled: number;
  llm_share_links_enabled: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

type PromptRow = {
  id: string;
  title: string;
  tags: string;
  prompt_text: string;
  source_urls: string;
  logic_trace: string;
  reference_answer: string;
  notes: string;
  archived_at: string | null;
  archive_reason: string | null;
  created_at: string;
  updated_at: string;
};

type VariantRow = {
  id: string;
  prompt_id: string;
  project: string;
  project_slug: string;
  version: number;
  based_on: string;
  prompt_text: string;
  prompt_urls: string;
  dsp_text: string;
  fanouts_text: string;
  llm_share_links_text: string;
  logic_trace: string;
  reference_answer: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

type UrlRow = {
  id: number;
  url: string;
  tags: string;
  notes: string;
  added_at: string;
  used_at: string | null;
  prompt_id: string | null;
  variant_id: string | null;
};

type SubmissionRow = {
  id: number;
  prompt_id: string;
  variant_id: string;
  project: string;
  submitted_at: string;
  submission_ref: string;
  notes: string;
  created_at: string;
};

type ModelTestRow = {
  id: number;
  variant_id: string;
  model: string;
  result: "pass" | "fail";
  tested_at: string;
};

type PromptModelTestRow = {
  id: number;
  prompt_id: string;
  model: string;
  result: "pass" | "fail";
  tested_at: string;
};

type Payload = Record<string, unknown> & { action?: string };

export async function GET() {
  try {
    return Response.json({ workspace: await readWorkspace() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Payload;
    await ensureSchema();
    const db = getD1();
    let result: Record<string, unknown> = {};

    switch (payload.action) {
      case "createProject": {
        const name = requiredText(payload.name, "Project name");
        const slug = optionalText(payload.slug) || slugify(name);
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
          throw new Error(
            "Project slug must use lowercase letters, numbers, and single hyphens.",
          );
        }
        const duplicate = await db
          .prepare(
            "SELECT name, slug FROM projects WHERE name = ? COLLATE NOCASE OR slug = ? COLLATE NOCASE",
          )
          .bind(name, slug)
          .first();
        if (duplicate) {
          throw new Error("A project with that name or slug already exists.");
        }
        const color = validateColor(payload.color);
        const now = new Date().toISOString();
        const inserted = await db
          .prepare(
            `INSERT INTO projects
              (name, slug, color, status, details, dsp_enabled, fanouts_enabled,
               llm_share_links_enabled, created_at, updated_at)
             VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)
             RETURNING id`,
          )
          .bind(
            name,
            slug,
            color,
            optionalText(payload.details),
            checkboxValue(payload.dspEnabled),
            checkboxValue(payload.fanoutsEnabled),
            checkboxValue(payload.llmShareLinksEnabled),
            now,
            now,
          )
          .first<{ id: number }>();
        result = { createdProjectId: inserted?.id };
        break;
      }
      case "updateProject": {
        const projectId = Number(payload.projectId);
        if (!Number.isInteger(projectId)) throw new Error("Project not found.");
        const existing = await db
          .prepare("SELECT id FROM projects WHERE id = ?")
          .bind(projectId)
          .first();
        if (!existing) throw new Error("Project not found.");
        await db
          .prepare(
            `UPDATE projects
             SET details = ?, dsp_enabled = ?, fanouts_enabled = ?,
                 llm_share_links_enabled = ?, updated_at = ?
             WHERE id = ?`,
          )
          .bind(
            optionalText(payload.details),
            checkboxValue(payload.dspEnabled),
            checkboxValue(payload.fanoutsEnabled),
            checkboxValue(payload.llmShareLinksEnabled),
            new Date().toISOString(),
            projectId,
          )
          .run();
        result = { updatedProjectId: projectId };
        break;
      }
      case "setProjectStatus": {
        const projectId = Number(payload.projectId);
        if (!Number.isInteger(projectId)) throw new Error("Project not found.");
        const status = requiredText(payload.status, "Project status");
        if (!["active", "inactive", "archived"].includes(status)) {
          throw new Error("Choose a valid project status.");
        }
        const existing = await db
          .prepare("SELECT id FROM projects WHERE id = ?")
          .bind(projectId)
          .first();
        if (!existing) throw new Error("Project not found.");
        const now = new Date().toISOString();
        await db
          .prepare(
            `UPDATE projects
             SET status = ?, updated_at = ?, archived_at = ?
             WHERE id = ?`,
          )
          .bind(status, now, status === "archived" ? now : null, projectId)
          .run();
        result = { updatedProjectId: projectId, projectStatus: status };
        break;
      }
      case "createPrompt": {
        const title = requiredText(payload.title, "Title");
        const current = await db
          .prepare(
            "SELECT COALESCE(MAX(CAST(SUBSTR(id, 4) AS INTEGER)), 0) AS value FROM prompt_families",
          )
          .first<{ value: number }>();
        const id = `BC-${String((current?.value ?? 0) + 1).padStart(4, "0")}`;
        const now = new Date().toISOString();
        await db
          .prepare(
            `INSERT INTO prompt_families
              (id, title, tags, prompt_text, source_urls, logic_trace,
               reference_answer, notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            id,
            title,
            normalizeTags(payload.tags),
            optionalText(payload.promptText),
            optionalText(payload.sourceUrls),
            optionalText(payload.logicTrace),
            optionalText(payload.referenceAnswer),
            optionalText(payload.notes),
            now,
            now,
          )
          .run();
        result = { createdId: id, createdType: "main" };
        break;
      }
      case "updatePrompt": {
        const id = requiredText(payload.id, "Prompt ID");
        const title = requiredText(payload.title, "Title");
        const existing = await db
          .prepare("SELECT id FROM prompt_families WHERE id = ?")
          .bind(id)
          .first();
        if (!existing) throw new Error("Main prompt not found.");
        await db
          .prepare(
            `UPDATE prompt_families
             SET title = ?, tags = ?, prompt_text = ?, source_urls = ?, logic_trace = ?,
                 reference_answer = ?, notes = ?, updated_at = ?
             WHERE id = ?`,
          )
          .bind(
            title,
            normalizeTags(payload.tags),
            optionalText(payload.promptText),
            optionalText(payload.sourceUrls),
            optionalText(payload.logicTrace),
            optionalText(payload.referenceAnswer),
            optionalText(payload.notes),
            new Date().toISOString(),
            id,
          )
          .run();
        result = { updatedId: id, updatedType: "main" };
        break;
      }
      case "archivePrompt": {
        const id = requiredText(payload.id, "Prompt ID");
        const existing = await db.prepare("SELECT id FROM prompt_families WHERE id = ?").bind(id).first();
        if (!existing) throw new Error("Main prompt not found.");
        const now = new Date().toISOString();
        await db
          .prepare("UPDATE prompt_families SET archived_at = ?, archive_reason = 'manual', updated_at = ? WHERE id = ?")
          .bind(now, now, id)
          .run();
        result = { archivedId: id };
        break;
      }
      case "reactivatePrompt": {
        const id = requiredText(payload.id, "Prompt ID");
        const existing = await db.prepare("SELECT id FROM prompt_families WHERE id = ?").bind(id).first();
        if (!existing) throw new Error("Main prompt not found.");
        await db
          .prepare("UPDATE prompt_families SET archived_at = NULL, archive_reason = NULL, updated_at = ? WHERE id = ?")
          .bind(new Date().toISOString(), id)
          .run();
        result = { reactivatedId: id };
        break;
      }
      case "deletePrompt": {
        const id = requiredText(payload.id, "Prompt ID");
        const existing = await db.prepare("SELECT id FROM prompt_families WHERE id = ?").bind(id).first();
        if (!existing) throw new Error("Main prompt not found.");
        const submitted = await db
          .prepare("SELECT COUNT(*) AS value FROM submissions WHERE prompt_id = ?")
          .bind(id)
          .first<{ value: number }>();
        if ((submitted?.value ?? 0) > 0) {
          throw new Error("This main prompt cannot be deleted because one or more variants have been submitted.");
        }
        await db.batch([
          db.prepare("UPDATE source_urls SET prompt_id = NULL WHERE prompt_id = ?").bind(id),
          db.prepare("UPDATE source_urls SET variant_id = NULL WHERE variant_id IN (SELECT id FROM variants WHERE prompt_id = ?)").bind(id),
          db.prepare("DELETE FROM variant_model_tests WHERE variant_id IN (SELECT id FROM variants WHERE prompt_id = ?)").bind(id),
          db.prepare("DELETE FROM prompt_model_tests WHERE prompt_id = ?").bind(id),
          db.prepare("DELETE FROM variants WHERE prompt_id = ?").bind(id),
          db.prepare("DELETE FROM prompt_families WHERE id = ?").bind(id),
        ]);
        result = { deletedPromptId: id };
        break;
      }
      case "deleteVariant": {
        const id = requiredText(payload.id, "Variant ID");
        const variant = await db
          .prepare("SELECT id, prompt_id, project_slug FROM variants WHERE id = ?")
          .bind(id)
          .first<{ id: string; prompt_id: string; project_slug: string }>();
        if (!variant) throw new Error("Variant not found.");
        const submittedForProject = await db
          .prepare(
            `SELECT COUNT(*) AS value
             FROM submissions s
             JOIN variants v ON v.id = s.variant_id
             WHERE v.prompt_id = ? AND v.project_slug = ?`,
          )
          .bind(variant.prompt_id, variant.project_slug)
          .first<{ value: number }>();
        if ((submittedForProject?.value ?? 0) > 0) {
          throw new Error("This variant cannot be deleted because a variant for this project has been submitted.");
        }
        await db.batch([
          db.prepare("UPDATE source_urls SET variant_id = NULL WHERE variant_id = ?").bind(id),
          db.prepare("DELETE FROM variant_model_tests WHERE variant_id = ?").bind(id),
          db.prepare("DELETE FROM variants WHERE id = ?").bind(id),
        ]);
        result = { deletedVariantId: id };
        break;
      }
      case "recordModelTest": {
        const variantId = requiredText(payload.variantId, "Variant ID");
        const model = requiredText(payload.model, "LLM model");
        const testResult = requiredText(payload.result, "Test result");
        if (!['pass', 'fail'].includes(testResult)) throw new Error("Choose Pass or Fail.");
        const variant = await db.prepare("SELECT id FROM variants WHERE id = ?").bind(variantId).first();
        if (!variant) throw new Error("Variant not found.");
        await db
          .prepare(
            `INSERT INTO variant_model_tests (variant_id, model, result, tested_at)
             VALUES (?, ?, ?, ?)`,
          )
          .bind(variantId, model, testResult, new Date().toISOString())
          .run();
        result = { testedVariantId: variantId, testedModel: model };
        break;
      }
      case "recordPromptModelTest": {
        const promptId = requiredText(payload.promptId, "Prompt ID");
        const model = requiredText(payload.model, "LLM model");
        const testResult = requiredText(payload.result, "Test result");
        if (!["pass", "fail"].includes(testResult)) throw new Error("Choose Pass or Fail.");
        const prompt = await db.prepare("SELECT id FROM prompt_families WHERE id = ?").bind(promptId).first();
        if (!prompt) throw new Error("Main prompt not found.");
        await db
          .prepare(
            `INSERT INTO prompt_model_tests (prompt_id, model, result, tested_at)
             VALUES (?, ?, ?, ?)`,
          )
          .bind(promptId, model, testResult, new Date().toISOString())
          .run();
        result = { testedPromptId: promptId, testedModel: model };
        break;
      }
      case "createVariant": {
        const promptId = requiredText(payload.promptId, "Prompt ID");
        const projectIdentifier = requiredText(payload.project, "Project");
        const project = await db
          .prepare(
            `SELECT * FROM projects
             WHERE (slug = ? COLLATE NOCASE OR name = ? COLLATE NOCASE)
               AND status = 'active'`,
          )
          .bind(projectIdentifier, projectIdentifier)
          .first<ProjectRow>();
        if (!project) throw new Error("Choose an active project.");
        const main = await db
          .prepare("SELECT * FROM prompt_families WHERE id = ?")
          .bind(promptId)
          .first<PromptRow>();
        if (!main) throw new Error("Main prompt not found.");
        const previous = await db
          .prepare(
            `SELECT * FROM variants
             WHERE prompt_id = ? AND project_slug = ?
             ORDER BY version DESC LIMIT 1`,
          )
          .bind(promptId, project.slug)
          .first<VariantRow>();
        const version = (previous?.version ?? 0) + 1;
        const id = `${promptId}-${project.slug.toUpperCase()}-V${version}`;
        const now = new Date().toISOString();
        await db
          .prepare(
            `INSERT INTO variants
              (id, prompt_id, project, project_slug, version, based_on,
               prompt_text, prompt_urls, dsp_text, fanouts_text, llm_share_links_text,
               logic_trace, reference_answer, notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            id,
            promptId,
            project.name,
            project.slug,
            version,
            previous?.id ?? promptId,
            previous?.prompt_text ?? main.prompt_text,
            previous?.prompt_urls ?? main.source_urls,
            previous?.dsp_text ?? "",
            previous?.fanouts_text ?? "",
            previous?.llm_share_links_text ?? "",
            previous?.logic_trace ?? main.logic_trace,
            previous?.reference_answer ?? main.reference_answer,
            previous?.notes ?? main.notes,
            now,
            now,
          )
          .run();
        result = { createdId: id, createdType: "variant" };
        break;
      }
      case "updateVariant": {
        const id = requiredText(payload.id, "Variant ID");
        const submitted = await db
          .prepare("SELECT id FROM submissions WHERE variant_id = ?")
          .bind(id)
          .first();
        if (submitted) {
          throw new Error(
            "Submitted variants are locked. Create the next version to keep editing.",
          );
        }
        const existing = await db
          .prepare("SELECT id FROM variants WHERE id = ?")
          .bind(id)
          .first();
        if (!existing) throw new Error("Variant not found.");
        await db
          .prepare(
            `UPDATE variants
             SET prompt_text = ?, prompt_urls = ?, dsp_text = ?, fanouts_text = ?,
                 llm_share_links_text = ?,
                 logic_trace = ?, reference_answer = ?, notes = ?, updated_at = ?
             WHERE id = ?`,
          )
          .bind(
            optionalText(payload.promptText),
            optionalText(payload.promptUrls),
            optionalText(payload.dspText),
            optionalText(payload.fanoutsText),
            optionalText(payload.llmShareLinksText),
            optionalText(payload.logicTrace),
            optionalText(payload.referenceAnswer),
            optionalText(payload.notes),
            new Date().toISOString(),
            id,
          )
          .run();
        result = { updatedId: id, updatedType: "variant" };
        break;
      }
      case "addUrl": {
        const url = validateUrl(payload.url);
        await db
          .prepare(
            "INSERT INTO source_urls (url, tags, notes, added_at) VALUES (?, ?, ?, ?)",
          )
          .bind(
            url,
            optionalText(payload.tags),
            optionalText(payload.notes),
            new Date().toISOString(),
          )
          .run();
        result = { createdUrl: url };
        break;
      }
      case "useUrl": {
        const urlId = Number(payload.urlId);
        if (!Number.isInteger(urlId)) throw new Error("Source URL not found.");
        const targetId = requiredText(payload.targetId, "Prompt or variant");
        let promptId = targetId;
        let variantId: string | null = null;
        if (!/^BC-\d{4}$/.test(targetId)) {
          const variant = await db
            .prepare("SELECT prompt_id FROM variants WHERE id = ?")
            .bind(targetId)
            .first<{ prompt_id: string }>();
          if (!variant) throw new Error("Variant not found.");
          promptId = variant.prompt_id;
          variantId = targetId;
        } else {
          const main = await db
            .prepare("SELECT id FROM prompt_families WHERE id = ?")
            .bind(targetId)
            .first();
          if (!main) throw new Error("Main prompt not found.");
        }
        const source = await db
          .prepare("SELECT used_at FROM source_urls WHERE id = ?")
          .bind(urlId)
          .first<{ used_at: string | null }>();
        if (!source) throw new Error("Source URL not found.");
        if (source.used_at) throw new Error("This source is already marked used.");
        await db
          .prepare(
            `UPDATE source_urls
             SET used_at = ?, prompt_id = ?, variant_id = ?
             WHERE id = ?`,
          )
          .bind(new Date().toISOString(), promptId, variantId, urlId)
          .run();
        result = { usedUrlId: urlId };
        break;
      }
      case "submitVariant": {
        const variantId = requiredText(payload.variantId, "Variant ID");
        const variant = await db
          .prepare("SELECT * FROM variants WHERE id = ?")
          .bind(variantId)
          .first<VariantRow>();
        if (!variant) throw new Error("Variant not found.");
        const submittedAt = requiredText(payload.submittedAt, "Submission date");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(submittedAt)) {
          throw new Error("Use a valid submission date.");
        }
        await db
          .prepare(
            `INSERT INTO submissions
              (prompt_id, variant_id, project, submitted_at, submission_ref, notes, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            variant.prompt_id,
            variant.id,
            variant.project,
            submittedAt,
            optionalText(payload.submissionRef),
            optionalText(payload.notes),
            new Date().toISOString(),
          )
          .run();
        result = { submittedId: variantId };
        const activeProjects = await db
          .prepare("SELECT COUNT(*) AS value FROM projects WHERE status = 'active'")
          .first<{ value: number }>();
        const usedActiveProjects = await db
          .prepare(
            `SELECT COUNT(DISTINCT v.project_slug) AS value
             FROM submissions s
             JOIN variants v ON v.id = s.variant_id
             JOIN projects p ON p.slug = v.project_slug AND p.status = 'active'
             WHERE s.prompt_id = ?`,
          )
          .bind(variant.prompt_id)
          .first<{ value: number }>();
        if ((activeProjects?.value ?? 0) > 0 && (usedActiveProjects?.value ?? 0) >= (activeProjects?.value ?? 0)) {
          const archivedAt = new Date().toISOString();
          await db
            .prepare("UPDATE prompt_families SET archived_at = ?, archive_reason = 'complete', updated_at = ? WHERE id = ?")
            .bind(archivedAt, archivedAt, variant.prompt_id)
            .run();
          result = { ...result, autoArchivedPromptId: variant.prompt_id };
        }
        break;
      }
      case "reverseSubmission": {
        const submissionId = Number(payload.submissionId);
        if (!Number.isInteger(submissionId) || submissionId < 1) throw new Error("Invalid submission.");
        const submission = await db
          .prepare("SELECT id, prompt_id, variant_id FROM submissions WHERE id = ?")
          .bind(submissionId)
          .first<{ id: number; prompt_id: string; variant_id: string }>();
        if (!submission) throw new Error("Submission record not found.");
        await db.prepare("DELETE FROM submissions WHERE id = ?").bind(submissionId).run();

        const activeProjects = await db
          .prepare("SELECT COUNT(*) AS value FROM projects WHERE status = 'active'")
          .first<{ value: number }>();
        const usedActiveProjects = await db
          .prepare(
            `SELECT COUNT(DISTINCT v.project_slug) AS value
             FROM submissions s
             JOIN variants v ON v.id = s.variant_id
             JOIN projects p ON p.slug = v.project_slug AND p.status = 'active'
             WHERE s.prompt_id = ?`,
          )
          .bind(submission.prompt_id)
          .first<{ value: number }>();
        if ((activeProjects?.value ?? 0) === 0 || (usedActiveProjects?.value ?? 0) < (activeProjects?.value ?? 0)) {
          await db
            .prepare(
              `UPDATE prompt_families
               SET archived_at = NULL, archive_reason = NULL, updated_at = ?
               WHERE id = ? AND archive_reason = 'complete'`,
            )
            .bind(new Date().toISOString(), submission.prompt_id)
            .run();
        }
        result = { reversedSubmissionId: submissionId, unlockedVariantId: submission.variant_id };
        break;
      }
      default:
        throw new Error("Unknown workspace action.");
    }

    return Response.json({ ...result, workspace: await readWorkspace() });
  } catch (error) {
    return errorResponse(error);
  }
}

async function readWorkspace() {
  await ensureSchema();
  const db = getD1();
  const [projectResult, promptResult, variantResult, urlResult, submissionResult, modelTestResult, promptModelTestResult] =
    await Promise.all([
      db
        .prepare(
          `SELECT * FROM projects
           ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'inactive' THEN 1 ELSE 2 END,
                    name COLLATE NOCASE`,
        )
        .all<ProjectRow>(),
      db
        .prepare("SELECT * FROM prompt_families ORDER BY created_at DESC, id DESC")
        .all<PromptRow>(),
      db
        .prepare(
          "SELECT * FROM variants ORDER BY prompt_id DESC, project_slug, version ASC",
        )
        .all<VariantRow>(),
      db
        .prepare("SELECT * FROM source_urls ORDER BY added_at DESC, id DESC")
        .all<UrlRow>(),
      db
        .prepare(
          "SELECT * FROM submissions ORDER BY submitted_at DESC, created_at DESC",
        )
        .all<SubmissionRow>(),
      db
        .prepare("SELECT * FROM variant_model_tests ORDER BY tested_at DESC, id DESC")
        .all<ModelTestRow>(),
      db
        .prepare("SELECT * FROM prompt_model_tests ORDER BY tested_at DESC, id DESC")
        .all<PromptModelTestRow>(),
    ]);

  const variants = variantResult.results.map((row) => ({
    ...mapVariant(row),
    modelTests: modelTestResult.results.filter((test) => test.variant_id === row.id).map((test) => ({
      id: test.id,
      model: test.model,
      result: test.result,
      testedAt: test.tested_at,
    })),
  }));
  const submissions = submissionResult.results.map((row) => ({
    id: row.id,
    promptId: row.prompt_id,
    variantId: row.variant_id,
    project: row.project,
    submittedAt: row.submitted_at,
    submissionRef: row.submission_ref,
    notes: row.notes,
    createdAt: row.created_at,
  }));
  const activeProjects = projectResult.results.filter((project) => project.status === "active");
  return {
    projects: projectResult.results.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      color: row.color,
      status: row.status,
      details: row.details,
      dspEnabled: Boolean(row.dsp_enabled),
      fanoutsEnabled: Boolean(row.fanouts_enabled),
      llmShareLinksEnabled: Boolean(row.llm_share_links_enabled),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      archivedAt: row.archived_at,
    })),
    families: promptResult.results.map((row) => ({
      id: row.id,
      title: row.title,
      tags: row.tags,
      promptText: row.prompt_text,
      sourceUrls: row.source_urls,
      logicTrace: row.logic_trace,
      referenceAnswer: row.reference_answer,
      notes: row.notes,
      archivedAt: row.archived_at,
      archiveReason: row.archive_reason,
      modelTests: promptModelTestResult.results.filter((test) => test.prompt_id === row.id).map((test) => ({
        id: test.id,
        model: test.model,
        result: test.result,
        testedAt: test.tested_at,
      })),
      missingActiveProjects: activeProjects
        .filter((project) => !submissions.some((submission) => {
          const submittedVariant = variants.find((variant) => variant.id === submission.variantId);
          return submission.promptId === row.id && submittedVariant?.projectSlug === project.slug;
        }))
        .map((project) => project.name),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      variants: variants.filter((variant) => variant.promptId === row.id),
    })),
    urls: urlResult.results.map((row) => ({
      id: row.id,
      url: row.url,
      tags: row.tags,
      notes: row.notes,
      addedAt: row.added_at,
      usedAt: row.used_at,
      promptId: row.prompt_id,
      variantId: row.variant_id,
    })),
    submissions,
  };
}

function mapVariant(row: VariantRow) {
  return {
    id: row.id,
    promptId: row.prompt_id,
    project: row.project,
    projectSlug: row.project_slug,
    version: row.version,
    basedOn: row.based_on,
    promptText: row.prompt_text,
    promptUrls: row.prompt_urls,
    dspText: row.dsp_text,
    fanoutsText: row.fanouts_text,
    llmShareLinksText: row.llm_share_links_text,
    logicTrace: row.logic_trace,
    referenceAnswer: row.reference_answer,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requiredText(value: unknown, label: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function optionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function checkboxValue(value: unknown) {
  return value === true || value === "on" || value === "1" ? 1 : 0;
}

function normalizeTags(value: unknown) {
  return Array.from(
    new Set(
      optionalText(value)
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).join(", ");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function validateColor(value: unknown) {
  const color = optionalText(value) || "#809B75";
  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    throw new Error("Choose a valid project color.");
  }
  return color.toUpperCase();
}

function validateUrl(value: unknown) {
  const text = requiredText(value, "URL");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("Enter a complete http:// or https:// URL.");
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error("Enter a complete http:// or https:// URL.");
  }
  return url.toString();
}

function errorResponse(error: unknown) {
  const raw = error instanceof Error ? error.message : "Unexpected error";
  const message = raw.includes("UNIQUE constraint failed: source_urls.url")
    ? "That URL is already in your source collection."
    : raw.includes("UNIQUE constraint failed: projects.name")
      ? "A project with that name already exists."
      : raw.includes("UNIQUE constraint failed: projects.slug")
        ? "A project with that slug already exists."
        : raw.includes("UNIQUE constraint failed: submissions.variant_id")
          ? "That exact variant is already marked submitted."
          : raw;
  return Response.json({ error: message }, { status: 400 });
}
