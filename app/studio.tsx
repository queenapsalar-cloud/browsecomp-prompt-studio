"use client";

import {
  Archive,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  CirclePause,
  CirclePlay,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  FileText,
  FolderCog,
  FolderOpen,
  GitBranch,
  Inbox,
  Link2,
  Loader2,
  Network,
  Plus,
  RotateCcw,
  Save,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type View = "prompts" | "urls" | "submissions" | "projects" | "archive";
type ProjectStatus = "active" | "inactive" | "archived";
type Project = {
  id: number;
  name: string;
  slug: string;
  color: string;
  status: ProjectStatus;
  details: string;
  dspEnabled: boolean;
  fanoutsEnabled: boolean;
  llmShareLinksEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};
type Variant = {
  id: string;
  promptId: string;
  project: string;
  projectSlug: string;
  version: number;
  basedOn: string;
  promptText: string;
  promptUrls: string;
  dspText: string;
  fanoutsText: string;
  llmShareLinksText: string;
  logicTrace: string;
  referenceAnswer: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  modelTests: ModelTest[];
};
type ModelTest = { id: number; model: string; result: "pass" | "fail"; testedAt: string };
type Family = {
  id: string;
  title: string;
  tags: string;
  promptText: string;
  sourceUrls: string;
  logicTrace: string;
  referenceAnswer: string;
  notes: string;
  archivedAt: string | null;
  archiveReason: string | null;
  missingActiveProjects: string[];
  createdAt: string;
  updatedAt: string;
  modelTests: ModelTest[];
  variants: Variant[];
};
type SourceUrl = {
  id: number;
  url: string;
  tags: string;
  notes: string;
  addedAt: string;
  usedAt: string | null;
  promptId: string | null;
  variantId: string | null;
};
type Submission = {
  id: number;
  promptId: string;
  variantId: string;
  project: string;
  submittedAt: string;
  submissionRef: string;
  notes: string;
  createdAt: string;
};
type Workspace = {
  projects: Project[];
  families: Family[];
  urls: SourceUrl[];
  submissions: Submission[];
};
type Modal =
  | { type: "newPrompt" }
  | { type: "addUrl" }
  | { type: "editMain"; familyId: string }
  | { type: "editVariant"; variantId: string }
  | { type: "useUrl"; urlId: number }
  | { type: "submit"; variantId: string }
  | { type: "editProject"; projectId: number }
  | { type: "newProject" };

const emptyWorkspace: Workspace = {
  projects: [
    { id: 1, name: "Sample", slug: "sample", color: "#B9E8D0", status: "active", details: "", dspEnabled: false, fanoutsEnabled: false, llmShareLinksEnabled: false, createdAt: "", updatedAt: "", archivedAt: null },
  ],
  families: [],
  urls: [],
  submissions: [],
};

export default function Studio() {
  const [view, setView] = useState<View>("prompts");
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<Modal | null>(null);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [urlFilter, setUrlFilter] = useState<"unused" | "used">("unused");

  const showToast = useCallback((message: string, error = false) => {
    setToast({ message, error });
    window.setTimeout(() => setToast(null), 3600);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/workspace", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || "Could not load the studio.");
        }
        if (active) setWorkspace(body.workspace);
      })
      .catch((error) => {
        if (active) {
          showToast(
            error instanceof Error ? error.message : "Could not load the studio.",
            true,
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [showToast]);

  useEffect(() => {
    if (!modal) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [modal]);

  async function mutate(payload: Record<string, unknown>, success: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The change could not be saved.");
      setWorkspace(body.workspace);
      showToast(success);
      return body as Record<string, unknown> & { workspace: Workspace };
    } catch (error) {
      showToast(error instanceof Error ? error.message : "The change could not be saved.", true);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function createVariant(familyId: string, project: Project) {
    const body = await mutate(
      { action: "createVariant", promptId: familyId, project: project.slug },
      `Created the next ${project.name} variant.`,
    );
    if (body?.createdId) {
      setModal({ type: "editVariant", variantId: String(body.createdId) });
    }
  }

  const unusedUrls = workspace.urls.filter((source) => !source.usedAt);
  const submittedIds = useMemo(
    () => new Set(workspace.submissions.map((submission) => submission.variantId)),
    [workspace.submissions],
  );
  const variantCount = workspace.families.reduce(
    (total, family) => total + family.variants.length,
    0,
  );
  const activeFamilies = workspace.families.filter((family) => !family.archivedAt);
  const archivedFamilies = workspace.families.filter((family) => family.archivedAt);
  const availableTags = Array.from(new Set(activeFamilies.flatMap((family) => splitTags(family.tags)))).sort();
  const filteredFamilies = activeFamilies.filter((family) => {
    const tags = splitTags(family.tags);
    const matchesQuery = `${family.id} ${family.title} ${family.tags}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (!tagFilter || tags.includes(tagFilter));
  });

  if (loading) {
    return (
      <main className="loading-state">
        <div className="loading-inner">
          <Loader2 className="spin" size={28} aria-hidden="true" />
          Opening your prompt studio…
        </div>
      </main>
    );
  }

  const heading = {
    prompts: ["Prompt library", "Build a canonical prompt, then shape distinct versions for each project."],
    urls: ["URL Inbox", "Collect promising sources now and connect them to prompts when you use them."],
    submissions: ["Submissions", "A durable record of the exact project variant submitted each time."],
    projects: ["Projects", "Choose which destinations are active, pause work, or archive projects without losing history."],
    archive: ["Prompt archive", "Completed and manually archived prompt families, preserved with their full history."],
  }[view];

  const primaryAction =
    view === "urls"
      ? { label: "Add URL", modal: { type: "addUrl" } as Modal }
      : view === "projects"
        ? { label: "New project", modal: { type: "newProject" } as Modal }
        : { label: "New prompt", modal: { type: "newPrompt" } as Modal };

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand-mark" aria-label="BrowseComp Prompt Studio">
          <Sparkles size={21} aria-hidden="true" />
        </div>
        <Navigation view={view} setView={setView} unusedCount={unusedUrls.length} />
        <div className="sidebar-note">
          <strong>Main → variants</strong>
          Submitted versions stay locked, so every project keeps an exact record.
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="product-name">BrowseComp Prompt Studio</p>
            <p className="topbar-kicker">A quiet workspace for difficult questions</p>
          </div>
          <button
            className="primary-button"
            onClick={() => setModal(primaryAction.modal)}
          >
            <Plus size={19} aria-hidden="true" />
            <span className="desktop-label">{primaryAction.label}</span>
          </button>
        </header>

        <section className="page-heading">
          <h1>{heading[0]}</h1>
          <p>{heading[1]}</p>
        </section>

        {view === "prompts" && (
          <PromptDashboard
            workspace={workspace}
            families={filteredFamilies}
            query={query}
            setQuery={setQuery}
            availableTags={availableTags}
            tagFilter={tagFilter}
            setTagFilter={setTagFilter}
            variantCount={variantCount}
            unusedUrls={unusedUrls}
            submittedIds={submittedIds}
            setView={setView}
            setModal={setModal}
            createVariant={createVariant}
          />
        )}

        {view === "urls" && (
          <UrlInbox
            sources={workspace.urls}
            filter={urlFilter}
            setFilter={setUrlFilter}
            setModal={setModal}
          />
        )}

        {view === "submissions" && (
          <SubmissionList submissions={workspace.submissions} busy={busy} setModal={setModal} mutate={mutate} />
        )}

        {view === "projects" && (
          <ProjectManager
            projects={workspace.projects}
            families={workspace.families}
            submissions={workspace.submissions}
            busy={busy}
            setModal={setModal}
            mutate={mutate}
          />
        )}

        {view === "archive" && (
          <PromptArchive families={archivedFamilies} busy={busy} setModal={setModal} mutate={mutate} />
        )}
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <MobileNavButton active={view === "prompts"} onClick={() => setView("prompts")} icon={<FolderOpen size={19} />} label="Prompts" />
        <MobileNavButton active={view === "urls"} onClick={() => setView("urls")} icon={<Inbox size={19} />} label="URL Inbox" />
        <MobileNavButton active={view === "submissions"} onClick={() => setView("submissions")} icon={<ClipboardCheck size={19} />} label="Submitted" />
        <MobileNavButton active={view === "projects"} onClick={() => setView("projects")} icon={<FolderCog size={19} />} label="Projects" />
        <MobileNavButton active={view === "archive"} onClick={() => setView("archive")} icon={<Archive size={19} />} label="Archive" />
      </nav>

      {modal && (
        <ModalLayer
          key={
            modal.type === "editMain"
              ? `${modal.type}-${modal.familyId}`
              : modal.type === "editVariant" || modal.type === "submit"
                ? `${modal.type}-${modal.variantId}`
                : modal.type === "useUrl"
                  ? `${modal.type}-${modal.urlId}`
                  : modal.type
          }
          modal={modal}
          workspace={workspace}
          submittedIds={submittedIds}
          busy={busy}
          close={() => setModal(null)}
          setModal={setModal}
          mutate={mutate}
        />
      )}

      {toast && (
        <div className={`toast${toast.error ? " error" : ""}`} role="status">
          {toast.error ? <X size={17} aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

function Navigation({ view, setView, unusedCount }: { view: View; setView: (view: View) => void; unusedCount: number }) {
  return (
    <div className="nav-list">
      <button className={`nav-button${view === "prompts" ? " active" : ""}`} onClick={() => setView("prompts")}>
        <FileText size={20} aria-hidden="true" /> Prompts
      </button>
      <button className={`nav-button${view === "urls" ? " active" : ""}`} onClick={() => setView("urls")}>
        <Inbox size={20} aria-hidden="true" /> URL Inbox
        {unusedCount > 0 && <span className="nav-badge">{unusedCount}</span>}
      </button>
      <button className={`nav-button${view === "submissions" ? " active" : ""}`} onClick={() => setView("submissions")}>
        <ClipboardCheck size={20} aria-hidden="true" /> Submissions
      </button>
      <button className={`nav-button${view === "projects" ? " active" : ""}`} onClick={() => setView("projects")}>
        <FolderCog size={20} aria-hidden="true" /> Projects
      </button>
      <button className={`nav-button${view === "archive" ? " active" : ""}`} onClick={() => setView("archive")}>
        <Archive size={20} aria-hidden="true" /> Prompt Archive
      </button>
    </div>
  );
}

function MobileNavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button className={active ? "active" : ""} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function PromptDashboard({ workspace, families, query, setQuery, availableTags, tagFilter, setTagFilter, variantCount, unusedUrls, submittedIds, setView, setModal, createVariant }: {
  workspace: Workspace;
  families: Family[];
  query: string;
  setQuery: (value: string) => void;
  availableTags: string[];
  tagFilter: string;
  setTagFilter: (value: string) => void;
  variantCount: number;
  unusedUrls: SourceUrl[];
  submittedIds: Set<string>;
  setView: (view: View) => void;
  setModal: (modal: Modal) => void;
  createVariant: (familyId: string, project: Project) => void;
}) {
  return (
    <div className="dashboard-grid">
      <div className="main-column">
        <div className="stats-grid">
          <StatCard value={workspace.families.filter((family) => !family.archivedAt).length} label="Prompt families" icon={<FolderOpen size={25} />} />
          <StatCard value={variantCount} label="Variants" icon={<Network size={25} />} />
          <StatCard value={workspace.submissions.length} label="Submitted" icon={<Send size={25} />} />
        </div>

        <div className="section-heading">
          <h2>Prompt families</h2>
          <span className="section-count">{families.length} {families.length === 1 ? "family" : "families"}</span>
        </div>
        {workspace.families.some((family) => !family.archivedAt) && (
          <div className="toolbar">
            <label className="search-field">
              <Search size={17} aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by title, ID, or tag" aria-label="Search prompt families" />
            </label>
            <label className="tag-filter"><select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} aria-label="Filter prompts by tag"><option value="">All tags</option>{availableTags.map((tag) => <option value={tag} key={tag}>{tag}</option>)}</select></label>
          </div>
        )}
        {families.length ? (
          <div className="family-list">
            {families.map((family) => (
              <FamilyCard key={family.id} family={family} projects={workspace.projects.filter((project) => project.status === "active")} submittedIds={submittedIds} setModal={setModal} createVariant={createVariant} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<BookOpen size={28} />}
            title={workspace.families.some((family) => !family.archivedAt) ? "No matching prompts" : "Start your first prompt family"}
            description={workspace.families.some((family) => !family.archivedAt) ? "Try a different title, ID, or tag filter." : "Create one canonical prompt, then branch distinct variants for each active project."}
            action={workspace.families.some((family) => !family.archivedAt) ? undefined : <button className="primary-button" onClick={() => setModal({ type: "newPrompt" })}><Plus size={18} /> New prompt</button>}
          />
        )}
      </div>

      <aside className="panel inbox-panel">
        <div className="panel-icon-title">
          <div className="panel-icon"><Archive size={22} aria-hidden="true" /></div>
          <h2>URL Inbox</h2>
        </div>
        <p className="inbox-number">{unusedUrls.length}</p>
        <p className="inbox-caption">unused {unusedUrls.length === 1 ? "source" : "sources"}</p>
        <div className="inbox-preview">
          {unusedUrls.slice(0, 3).map((source) => (
            <div className="inbox-preview-item" key={source.id}>
              <strong>{hostname(source.url)}</strong>
              <span>{source.tags || "Unsorted source"}</span>
            </div>
          ))}
          {!unusedUrls.length && <div className="inbox-preview-item"><strong>Inbox clear</strong><span>Add links as you research</span></div>}
        </div>
        <button className="ghost-button" onClick={() => setView("urls")}>
          Review sources <ChevronRight size={18} aria-hidden="true" />
        </button>
      </aside>
    </div>
  );
}

function StatCard({ value, label, icon }: { value: number; label: string; icon: React.ReactNode }) {
  return <article className="stat-card"><div><p className="stat-value">{value}</p><p className="stat-label">{label}</p></div><div className="stat-icon">{icon}</div></article>;
}

function FamilyCard({ family, projects, submittedIds, setModal, createVariant }: {
  family: Family;
  projects: Project[];
  submittedIds: Set<string>;
  setModal: (modal: Modal) => void;
  createVariant: (familyId: string, project: Project) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="family-card">
      <div className="family-header">
        <button className="family-main-button" onClick={() => setModal({ type: "editMain", familyId: family.id })}>
          <div className="family-icon"><FileText size={19} aria-hidden="true" /></div>
          <div className="family-title-block">
            <p className="family-title"><span>{family.title}</span> <em>({family.id})</em></p>
            <div className="family-meta">
              <span><GitBranch size={13} /> {family.variants.length} {family.variants.length === 1 ? "variant" : "variants"}</span>
              <span><Clock3 size={13} /> Updated {formatRelativeDate(family.updatedAt)}</span>
            </div>
            {family.tags && <div className="prompt-tags">{splitTags(family.tags).map((tag) => <span key={tag}>{tag}</span>)}</div>}
          </div>
          <span className="view-label">Edit main</span>
        </button>
        <button className={`family-expand-button${expanded ? " expanded" : ""}`} onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-label={`${expanded ? "Hide" : "Show"} variants for ${family.title}`}><ChevronRight size={20} aria-hidden="true" /></button>
      </div>
      {expanded && <div className="project-list">
        {projects.map((project) => {
          const variants = family.variants.filter((variant) => variant.projectSlug === project.slug).sort((a, b) => b.version - a.version);
          const latest = variants[0];
          const submitted = latest ? submittedIds.has(latest.id) : false;
          return (
            <div className="project-row" key={project.slug}>
              <div className="project-name"><span className="project-dot" style={{ background: project.color }} />{project.name}</div>
              <div className="project-version">{latest ? `V${latest.version}` : "—"}</div>
              <span className={`status-pill ${latest ? (submitted ? "submitted" : "draft") : "empty"}`}>
                {latest ? (submitted ? <><CheckCircle2 size={13} /> Submitted</> : "Draft") : "No variant"}
              </span>
              <div className="project-actions">
                {latest && <button className="project-action" onClick={() => setModal({ type: "editVariant", variantId: latest.id })}><span>Open</span><ChevronRight size={17} /></button>}
                <button className="project-action" onClick={() => createVariant(family.id, project)} aria-label={`Create next ${project.name} variant`}><Plus size={16} /><span>{latest ? "New version" : "Create"}</span></button>
              </div>
            </div>
          );
        })}
      </div>}
    </article>
  );
}

function UrlInbox({ sources, filter, setFilter, setModal }: { sources: SourceUrl[]; filter: "unused" | "used"; setFilter: (filter: "unused" | "used") => void; setModal: (modal: Modal) => void }) {
  const visible = sources.filter((source) => filter === "used" ? Boolean(source.usedAt) : !source.usedAt);
  return (
    <>
      <div className="toolbar">
        <div className="segmented" aria-label="Source status">
          <button className={filter === "unused" ? "active" : ""} onClick={() => setFilter("unused")}>Unused</button>
          <button className={filter === "used" ? "active" : ""} onClick={() => setFilter("used")}>Used</button>
        </div>
      </div>
      {visible.length ? <div className="source-list">{visible.map((source) => (
        <article className="source-card" key={source.id}>
          <div>
            <p className="source-title"><Link2 size={17} aria-hidden="true" /><a href={source.url} target="_blank" rel="noreferrer">{source.url}</a><ExternalLink size={13} aria-hidden="true" /></p>
            <div className="source-meta">
              <span>Added {formatDate(source.addedAt)}</span>
              {source.tags.split(",").filter(Boolean).map((tag) => <span className="tag" key={tag}>{tag.trim()}</span>)}
              {source.notes && <span>{source.notes}</span>}
              {source.usedAt && <span>Used by {source.variantId || source.promptId}</span>}
            </div>
          </div>
          {!source.usedAt && <button className="secondary-button" onClick={() => setModal({ type: "useUrl", urlId: source.id })}>Use source <ChevronRight size={16} /></button>}
        </article>
      ))}</div> : <EmptyState icon={<Inbox size={28} />} title={filter === "unused" ? "Your URL inbox is clear" : "No used sources yet"} description={filter === "unused" ? "Add promising links here before you know which prompt will need them." : "When you use an inbox URL, its prompt association will appear here."} action={filter === "unused" ? <button className="primary-button" onClick={() => setModal({ type: "addUrl" })}><Plus size={18} /> Add URL</button> : undefined} />}
    </>
  );
}

function SubmissionList({ submissions, busy, setModal, mutate }: { submissions: Submission[]; busy: boolean; setModal: (modal: Modal) => void; mutate: (payload: Record<string, unknown>, success: string) => Promise<(Record<string, unknown> & { workspace: Workspace }) | null> }) {
  if (!submissions.length) return <EmptyState icon={<Send size={28} />} title="No submissions recorded" description="Open a project variant from the prompt library and record it when you submit. The submitted version will be locked." />;
  return <div className="submission-list">{submissions.map((submission) => (
    <article className="submission-card" key={submission.id}>
      <div>
        <p className="submission-title"><CheckCircle2 size={18} color="#2D6442" />{submission.variantId}</p>
        <div className="submission-meta"><span>{submission.project}</span><span>Submitted {formatDate(submission.submittedAt)}</span>{submission.submissionRef && <span>Ref: {submission.submissionRef}</span>}{submission.notes && <span>{submission.notes}</span>}</div>
      </div>
      <div className="submission-actions">
        <button className="ghost-button danger" disabled={busy} onClick={async () => { if (!window.confirm(`Reverse the submission of ${submission.variantId}? The variant will become editable again.`)) return; await mutate({ action: "reverseSubmission", submissionId: submission.id }, `Reversed submission of ${submission.variantId}.`); }}><RotateCcw size={16} /> Reverse submission</button>
        <button className="ghost-button" onClick={() => setModal({ type: "editVariant", variantId: submission.variantId })}>View locked version <ChevronRight size={16} /></button>
      </div>
    </article>
  ))}</div>;
}

function PromptArchive({ families, busy, setModal, mutate }: {
  families: Family[];
  busy: boolean;
  setModal: (modal: Modal) => void;
  mutate: (payload: Record<string, unknown>, success: string) => Promise<(Record<string, unknown> & { workspace: Workspace }) | null>;
}) {
  if (!families.length) return <EmptyState icon={<Archive size={28} />} title="Archive is empty" description="Prompt families will appear here after manual archiving or after submission to every active project." />;
  return <div className="archive-list">
    {families.map((family) => <article className="archive-card" key={family.id}>
      <div className="archive-card-main">
        <div className="archive-title-row"><h2>{family.title} <em>({family.id})</em></h2><span className={`archive-reason ${family.archiveReason === "complete" ? "complete" : "manual"}`}>{family.archiveReason === "complete" ? "All active projects used" : "Manually archived"}</span></div>
        <p>Archived {family.archivedAt ? formatDate(family.archivedAt) : "recently"} · {family.variants.length} {family.variants.length === 1 ? "variant" : "variants"}</p>
        {family.missingActiveProjects.length ? <div className="archive-gap"><strong>Not used on:</strong>{family.missingActiveProjects.map((project) => <span key={project}>{project}</span>)}</div> : <div className="archive-complete-note"><CheckCircle2 size={15} /> Used on every active project</div>}
      </div>
      <div className="archive-actions">
        <button className="secondary-button compact" onClick={() => setModal({ type: "editMain", familyId: family.id })}>View prompt</button>
        <button className="primary-button compact" disabled={busy} onClick={() => mutate({ action: "reactivatePrompt", id: family.id }, `Reactivated ${family.title}.`)}><RotateCcw size={15} /> Reactivate</button>
      </div>
    </article>)}
  </div>;
}

function ProjectManager({ projects, families, submissions, busy, setModal, mutate }: {
  projects: Project[];
  families: Family[];
  submissions: Submission[];
  busy: boolean;
  setModal: (modal: Modal) => void;
  mutate: (payload: Record<string, unknown>, success: string) => Promise<(Record<string, unknown> & { workspace: Workspace }) | null>;
}) {
  const counts = {
    active: projects.filter((project) => project.status === "active").length,
    inactive: projects.filter((project) => project.status === "inactive").length,
    archived: projects.filter((project) => project.status === "archived").length,
  };

  async function setStatus(project: Project, status: ProjectStatus) {
    const verb = status === "active" ? "active" : status === "inactive" ? "paused" : "archived";
    await mutate(
      { action: "setProjectStatus", projectId: project.id, status },
      `${project.name} is now ${verb}.`,
    );
  }

  return (
    <div className="project-management">
      <div className="stats-grid project-stats">
        <StatCard value={counts.active} label="Active projects" icon={<CirclePlay size={25} />} />
        <StatCard value={counts.inactive} label="Paused projects" icon={<CirclePause size={25} />} />
        <StatCard value={counts.archived} label="Archived projects" icon={<Archive size={25} />} />
      </div>
      <div className="section-heading">
        <h2>Project destinations</h2>
        <button className="secondary-button" onClick={() => setModal({ type: "newProject" })}><Plus size={17} /> Add project</button>
      </div>
      <div className="project-catalog">
        {projects.map((project) => {
          const variantCount = families.reduce(
            (total, family) => total + family.variants.filter((variant) => variant.projectSlug === project.slug).length,
            0,
          );
          const submissionCount = submissions.filter((submission) => submission.project === project.name).length;
          return (
            <article className={`project-manage-card ${project.status}`} key={project.id}>
              <div className="project-manage-main">
                <span className="project-swatch" style={{ background: project.color }} aria-hidden="true" />
                <div>
                  <div className="project-manage-title">
                    <h3>{project.name}</h3>
                    <span className={`project-state ${project.status}`}>{project.status}</span>
                  </div>
                  <p>/{project.slug} · {variantCount} {variantCount === 1 ? "variant" : "variants"} · {submissionCount} submitted</p>
                </div>
              </div>
              <div className="project-manage-actions">
                <button className="secondary-button compact" onClick={() => setModal({ type: "editProject", projectId: project.id })}><FolderCog size={16} /> Details</button>
                {project.status === "active" && <button className="secondary-button compact" disabled={busy} onClick={() => setStatus(project, "inactive")}><CirclePause size={16} /> Pause</button>}
                {project.status !== "active" && <button className="secondary-button compact" disabled={busy} onClick={() => setStatus(project, "active")}><CirclePlay size={16} /> {project.status === "archived" ? "Restore" : "Activate"}</button>}
                {project.status !== "archived" && <button className="ghost-button danger" disabled={busy} onClick={() => setStatus(project, "archived")}><Archive size={16} /> Archive</button>}
              </div>
            </article>
          );
        })}
      </div>
      <div className="project-policy-note">
        <RotateCcw size={18} aria-hidden="true" />
        <span><strong>History is preserved.</strong> Pausing or archiving removes a project from new prompt work, but its variants, sources, and submissions remain stored.</span>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return <div className="empty-state"><div><div className="empty-state-icon">{icon}</div><h3>{title}</h3><p>{description}</p>{action}</div></div>;
}

function ModalLayer({ modal, workspace, submittedIds, busy, close, setModal, mutate }: {
  modal: Modal;
  workspace: Workspace;
  submittedIds: Set<string>;
  busy: boolean;
  close: () => void;
  setModal: (modal: Modal) => void;
  mutate: (payload: Record<string, unknown>, success: string) => Promise<(Record<string, unknown> & { workspace: Workspace }) | null>;
}) {
  const family = modal.type === "editMain" ? workspace.families.find((item) => item.id === modal.familyId) : undefined;
  const variant = modal.type === "editVariant" || modal.type === "submit" ? workspace.families.flatMap((item) => item.variants).find((item) => item.id === modal.variantId) : undefined;
  const source = modal.type === "useUrl" ? workspace.urls.find((item) => item.id === modal.urlId) : undefined;
  const project = modal.type === "editProject" ? workspace.projects.find((item) => item.id === modal.projectId) : undefined;

  async function submitForm(event: FormEvent<HTMLFormElement>, payload: Record<string, unknown>, message: string, stayOpen = false) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const body = await mutate({ ...payload, ...data }, message);
    if (body && !stayOpen) close();
  }

  if ((modal.type === "editMain" && !family) || ((modal.type === "editVariant" || modal.type === "submit") && !variant) || (modal.type === "useUrl" && !source) || (modal.type === "editProject" && !project)) return null;

  let content: React.ReactNode;
  if (modal.type === "newPrompt") {
    content = <FormModal title="New prompt family" subtitle="Start with the canonical question. Project variants branch from this version." close={close} editor>
      <form className="editor-form" onSubmit={(event) => submitForm(event, { action: "createPrompt" }, "Created a new prompt family.")}>
        <div className="editor-columns">
          <div className="editor-primary-scroll">
            <Field label="Title"><input name="title" required autoFocus placeholder="e.g. Early navigation" /></Field>
            <Field label="Tags" help="Separate searchable tags with commas."><input name="tags" placeholder="history, science, geography" /></Field>
            <Field label="Canonical prompt"><textarea className="prompt-area" name="promptText" placeholder="Write the complete BrowseComp prompt…" /></Field>
            <Field label="Logic trace"><textarea className="logic-trace-area" name="logicTrace" placeholder="Capture the reasoning path, checks, and evidence used…" /></Field>
          </div>
          <aside className="editor-notes-column"><MainUrlDrawer defaultValue="" /><AnswerDrawer defaultValue="" placeholder="Expected answer and acceptable variants…" /><Field label="Notes"><textarea className="notes-area" name="notes" placeholder="Difficulty, reasoning, review notes…" /></Field></aside>
        </div>
        <ModalActions close={close} busy={busy} label="Create prompt" />
      </form>
    </FormModal>;
  } else if (modal.type === "newProject") {
    content = <FormModal title="Add project" subtitle="New projects start active and appear in every prompt family." close={close}>
      <form className="form-grid" onSubmit={(event) => submitForm(event, { action: "createProject" }, "Added a new active project.")}>
        <Field label="Project name"><input name="name" required autoFocus placeholder="e.g. Atlas" /></Field>
        <Field label="Slug" help="Optional. Lowercase letters, numbers, and hyphens only."><input name="slug" placeholder="atlas" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></Field>
        <Field label="Project color"><input className="color-input" name="color" type="color" defaultValue="#8B75B5" /></Field>
        <Field label="Project details" help="These requirements appear beneath the project title in every variant."><textarea name="details" placeholder="Project-specific requirements and reminders…" /></Field>
        <ProjectFeatureChecks />
        <ModalActions close={close} busy={busy} label="Add project" />
      </form>
    </FormModal>;
  } else if (modal.type === "editProject" && project) {
    content = <FormModal title={project.name} subtitle="Project details and variant fields" close={close}>
      <form className="form-grid" onSubmit={(event) => submitForm(event, { action: "updateProject", projectId: project.id }, "Saved the project details.")}>
        <Field label="Project details" help="Shown as reminder text beneath this project's title on every variant."><textarea name="details" defaultValue={project.details} placeholder="Project-specific requirements and reminders…" /></Field>
        <ProjectFeatureChecks project={project} />
        <ModalActions close={close} busy={busy} label="Save details" icon={<Save size={17} />} />
      </form>
    </FormModal>;
  } else if (modal.type === "addUrl") {
    content = <FormModal title="Add URL to inbox" subtitle="Keep a promising source until a prompt is ready to use it." close={close}>
      <form className="form-grid" onSubmit={(event) => submitForm(event, { action: "addUrl" }, "Added URL to the inbox.")}>
        <Field label="URL"><input name="url" type="url" required autoFocus placeholder="https://…" /></Field>
        <Field label="Tags" help="Separate tags with commas."><input name="tags" placeholder="history, primary-source" /></Field>
        <Field label="Notes"><textarea name="notes" placeholder="Why this source may be useful…" /></Field>
        <ModalActions close={close} busy={busy} label="Add to inbox" />
      </form>
    </FormModal>;
  } else if (modal.type === "editMain" && family) {
    content = <FormModal title={`${family.id} · ${family.title}`} subtitle="Canonical main prompt · never submitted directly" close={close} editor>
      <form className="editor-form" onSubmit={(event) => submitForm(event, { action: "updatePrompt", id: family.id }, "Saved the main prompt.")}>
        <div className="editor-columns">
          <div className="editor-primary-scroll">
            <div className="editor-banner"><span>Changes here become the starting point for each project’s first variant.</span><GitBranch size={18} /></div>
            <Field label="Title"><input name="title" required defaultValue={family.title} /></Field>
            <Field label="Tags" help="Separate searchable tags with commas."><input name="tags" defaultValue={family.tags} placeholder="history, science, geography" /></Field>
            <Field label="Canonical prompt"><textarea className="prompt-area" name="promptText" defaultValue={family.promptText} /></Field>
            <Field label="Logic trace"><textarea className="logic-trace-area" name="logicTrace" defaultValue={family.logicTrace} placeholder="Capture the reasoning path, checks, and evidence used…" /></Field>
          </div>
          <aside className="editor-notes-column"><MainUrlDrawer defaultValue={family.sourceUrls} /><AnswerDrawer defaultValue={family.referenceAnswer} /><ModelTestsDrawer tests={family.modelTests} targetId={family.id} targetType="main" busy={busy} mutate={mutate} /><Field label="Notes"><textarea className="notes-area" name="notes" defaultValue={family.notes} /></Field></aside>
        </div>
        <div className="modal-actions split-actions">
          <div className="modal-action-group">{!family.archivedAt && <button type="button" className="ghost-button danger" disabled={busy} onClick={async () => { const body = await mutate({ action: "archivePrompt", id: family.id }, `Archived ${family.title}.`); if (body) close(); }}><Archive size={16} /> Archive prompt</button>}<button type="button" className="ghost-button danger" disabled={busy || family.variants.some((item) => submittedIds.has(item.id))} title={family.variants.some((item) => submittedIds.has(item.id)) ? "A main prompt with submitted variants cannot be deleted." : "Permanently delete this main prompt and its unsubmitted variants."} onClick={async () => { if (!window.confirm(`Delete “${family.title}” and all of its unsubmitted variants? This cannot be undone.`)) return; const body = await mutate({ action: "deletePrompt", id: family.id }, `Deleted ${family.title}.`); if (body) close(); }}><X size={16} /> Delete prompt</button></div>
          <div className="modal-action-group"><button type="button" className="secondary-button" onClick={close}>Cancel</button><button type="submit" className="primary-button" disabled={busy}>{busy ? <Loader2 className="spin" size={17} /> : <Save size={17} />} Save main</button></div>
        </div>
      </form>
    </FormModal>;
  } else if (modal.type === "editVariant" && variant) {
    const parent = workspace.families.find((item) => item.id === variant.promptId)!;
    const siblings = parent.variants.filter((item) => item.projectSlug === variant.projectSlug).sort((a, b) => a.version - b.version);
    const variantProject = workspace.projects.find((item) => item.slug === variant.projectSlug);
    const locked = submittedIds.has(variant.id);
    const projectHasSubmission = siblings.some((item) => submittedIds.has(item.id));
    content = <FormModal title={parent.title} subtitle={`${variant.project} · ${variant.id} · based on ${variant.basedOn}`} close={close} editor>
      <form className="editor-form" onSubmit={(event) => submitForm(event, { action: "updateVariant", id: variant.id }, "Saved the project variant.")}>
        <div className="editor-columns">
          <div className="editor-primary-scroll">
            {variantProject?.details && <p className="project-details-reminder">{variantProject.details}</p>}
            {siblings.length > 1 && <div className="version-tabs" aria-label={`${variant.project} versions`}>{siblings.map((sibling) => <button type="button" className={sibling.id === variant.id ? "active" : ""} key={sibling.id} onClick={() => setModal({ type: "editVariant", variantId: sibling.id })}>V{sibling.version}</button>)}</div>}
            <div className={`editor-banner${locked ? " locked" : ""}`}><span>{locked ? "This submitted version is locked to preserve its exact contents." : `Edit this copy independently from ${variant.basedOn}.`}</span>{locked ? <CheckCircle2 size={18} /> : <GitBranch size={18} />}</div>
            <CopyableTextareaField label="Project prompt" name="promptText" className="prompt-area" defaultValue={variant.promptText} mainValue={parent.promptText} disabled={locked} />
            <CopyableTextareaField label="Logic trace" name="logicTrace" className="logic-trace-area" defaultValue={variant.logicTrace} mainValue={parent.logicTrace} disabled={locked} placeholder="Capture the reasoning path, checks, and evidence used…" />
            {(variantProject?.dspEnabled || variant.dspText) && <Field label="DSP"><textarea name="dspText" defaultValue={variant.dspText} disabled={locked} placeholder="DSP notes or content for this variant…" /></Field>}
            {(variantProject?.fanoutsEnabled || variant.fanoutsText) && <Field label="Fanouts"><textarea name="fanoutsText" defaultValue={variant.fanoutsText} disabled={locked} placeholder="Fanout notes or content for this variant…" /></Field>}
            {(variantProject?.llmShareLinksEnabled || variant.llmShareLinksText) && <Field label="LLM Share Links" help="Store one share link per line."><textarea className="url-area" name="llmShareLinksText" defaultValue={variant.llmShareLinksText} disabled={locked} placeholder={"https://chat.example.com/share/…\nhttps://another.example.com/share/…"} /></Field>}
          </div>
          <aside className="editor-notes-column"><VariantUrlDrawer defaultValue={variant.promptUrls} mainUrls={parent.sourceUrls} disabled={locked} /><AnswerDrawer defaultValue={variant.referenceAnswer} mainValue={parent.referenceAnswer} disabled={locked} /><ModelTestsDrawer tests={variant.modelTests} targetId={variant.id} targetType="variant" busy={busy} mutate={mutate} /><CopyableTextareaField label="Notes" name="notes" className="notes-area" defaultValue={variant.notes} mainValue={parent.notes} disabled={locked} /></aside>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost-button danger" disabled={busy || projectHasSubmission} title={projectHasSubmission ? "A submitted variant exists for this project, so its variants cannot be deleted." : "Permanently delete this variant."} onClick={async () => { if (!window.confirm(`Delete ${variant.id}? This cannot be undone.`)) return; const body = await mutate({ action: "deleteVariant", id: variant.id }, `Deleted ${variant.id}.`); if (body) close(); }}><X size={16} /> Delete variant</button>
          <button type="button" className="secondary-button" onClick={close}>Close</button>
          {!locked && <button type="button" className="secondary-button" onClick={() => setModal({ type: "submit", variantId: variant.id })}><Send size={16} /> Record submission</button>}
          {!locked && <button type="submit" className="primary-button" disabled={busy}>{busy ? <Loader2 className="spin" size={17} /> : <Save size={17} />} Save variant</button>}
        </div>
      </form>
    </FormModal>;
  } else if (modal.type === "useUrl" && source) {
    const targets = workspace.families.flatMap((item) => [{ id: item.id, label: `${item.id} · Main` }, ...item.variants.map((variant) => ({ id: variant.id, label: `${variant.id} · ${variant.project}` }))]);
    content = <FormModal title="Use source" subtitle={source.url} close={close}>
      <form className="form-grid" onSubmit={(event) => submitForm(event, { action: "useUrl", urlId: source.id }, "Moved the URL to used sources.")}>
        <Field label="Attach to"><select name="targetId" required autoFocus defaultValue=""><option value="" disabled>Choose a main prompt or variant</option>{targets.map((target) => <option value={target.id} key={target.id}>{target.label}</option>)}</select></Field>
        {!targets.length && <div className="editor-banner">Create a main prompt before using this source.</div>}
        <ModalActions close={close} busy={busy || !targets.length} label="Mark used" />
      </form>
    </FormModal>;
  } else if (modal.type === "submit" && variant) {
    content = <FormModal title="Record submission" subtitle={`${variant.id} → ${variant.project}`} close={close}>
      <form className="form-grid" onSubmit={(event) => submitForm(event, { action: "submitVariant", variantId: variant.id }, "Recorded the exact submitted variant.")}>
        <div className="editor-banner"><span>Submitting locks this version. Create V{variant.version + 1} for future edits.</span><CheckCircle2 size={18} /></div>
        <FieldRow>
          <Field label="Submission date"><input name="submittedAt" type="date" required defaultValue={today()} /></Field>
          <Field label="Submission reference"><input name="submissionRef" placeholder="Optional ID or link" /></Field>
        </FieldRow>
        <Field label="Notes"><textarea name="notes" placeholder="Anything useful about this submission…" /></Field>
        <ModalActions close={close} busy={busy} label="Record submission" icon={<Send size={17} />} />
      </form>
    </FormModal>;
  } else {
    return null;
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>{content}</div>;
}

function ProjectFeatureChecks({ project }: { project?: Project }) {
  return <fieldset className="feature-checks">
    <legend>Additional variant boxes</legend>
    <label><input type="checkbox" name="dspEnabled" defaultChecked={project?.dspEnabled} /> DSP</label>
    <label><input type="checkbox" name="fanoutsEnabled" defaultChecked={project?.fanoutsEnabled} /> Fanouts</label>
    <label><input type="checkbox" name="llmShareLinksEnabled" defaultChecked={project?.llmShareLinksEnabled} /> LLM Share Links</label>
  </fieldset>;
}

function ModelTestsDrawer({ tests, targetId, targetType, busy, mutate }: { tests: ModelTest[]; targetId: string; targetType: "main" | "variant"; busy: boolean; mutate: (payload: Record<string, unknown>, success: string) => Promise<(Record<string, unknown> & { workspace: Workspace }) | null> }) {
  const [model, setModel] = useState("");
  const [result, setResult] = useState<"pass" | "fail">("pass");
  const payload = targetType === "main" ? { action: "recordPromptModelTest", promptId: targetId } : { action: "recordModelTest", variantId: targetId };
  return <details className="url-drawer model-tests-drawer" open>
    <summary><span><ClipboardCheck size={14} /> LLM model tests</span><span className="drawer-hint">{tests.length} tested · Open / close</span></summary>
    <section className="model-tests">
      <div className="model-tests-heading"><p>Add a separate pass/fail record for every test of this exact {targetType === "main" ? "main prompt" : "variant"}.</p></div>
      {tests.length > 0 && <div className="model-test-list">{tests.map((test) => <div className="model-test-row" key={test.id}><strong>{test.model}</strong><span className={`test-result ${test.result}`}>{test.result === "pass" ? <CheckCircle2 size={13} /> : <X size={13} />}{test.result}</span><time dateTime={test.testedAt}>Tested {formatDate(test.testedAt)}</time></div>)}</div>}
      <div className="model-test-entry">
        <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="Specific LLM, e.g. GPT-5.2 Thinking" aria-label="Specific LLM tested" />
        <select value={result} onChange={(event) => setResult(event.target.value as "pass" | "fail")} aria-label="LLM test result"><option value="pass">Pass</option><option value="fail">Fail</option></select>
        <button type="button" className="secondary-button compact" disabled={busy || !model.trim()} onClick={async () => { const saved = await mutate({ ...payload, model: model.trim(), result }, `Recorded ${model.trim()} as ${result}.`); if (saved) setModel(""); }}><Save size={15} /> Record</button>
      </div>
    </section>
  </details>;
}

function MainUrlDrawer({ defaultValue }: { defaultValue: string }) {
  return <details className="url-drawer" open>
    <summary><span><Link2 size={14} /> Prompt URLs</span><span className="drawer-hint">Open / close</span></summary>
    <div className="url-drawer-body">
      <textarea aria-label="Prompt URLs" className="url-area" name="sourceUrls" defaultValue={defaultValue} placeholder={"https://example.com/source-one\nhttps://example.com/source-two"} />
      <span className="field-help">Store one source URL per line.</span>
    </div>
  </details>;
}

function VariantUrlDrawer({ defaultValue, mainUrls, disabled }: { defaultValue: string; mainUrls: string; disabled: boolean }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  return <details className="url-drawer" open>
    <summary><span><Link2 size={14} /> Prompt URLs</span><span className="drawer-hint">Open / close</span></summary>
    <div className="url-drawer-body">
      <button type="button" className="inline-copy-button" disabled={disabled || !mainUrls} onClick={() => { if (textareaRef.current) textareaRef.current.value = mainUrls; }}>Copy from main</button>
      <textarea ref={textareaRef} aria-label="Prompt URLs" className="url-area" name="promptUrls" defaultValue={defaultValue} disabled={disabled} placeholder={"https://example.com/source-one\nhttps://example.com/source-two"} />
      <span className="field-help">Store one URL per line. Copying replaces the current list.</span>
    </div>
  </details>;
}

function AnswerDrawer({ defaultValue, mainValue, disabled = false, placeholder = "Expected answer and acceptable variants…" }: { defaultValue: string; mainValue?: string; disabled?: boolean; placeholder?: string }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  return <details className="url-drawer answer-drawer" open>
    <summary><span><BookOpen size={14} /> Answer</span><span className="drawer-hint">Open / close</span></summary>
    <div className="url-drawer-body">
      {mainValue !== undefined && <button type="button" className="inline-copy-button" disabled={disabled || !mainValue} onClick={() => { if (textareaRef.current) textareaRef.current.value = mainValue; }}>Copy from main</button>}
      <textarea ref={textareaRef} aria-label="Answer" className="answer-area" name="referenceAnswer" defaultValue={defaultValue} disabled={disabled} placeholder={placeholder} />
    </div>
  </details>;
}

function CopyableTextareaField({ label, name, defaultValue, mainValue, disabled, className, placeholder, help }: { label: string; name: string; defaultValue: string; mainValue: string; disabled: boolean; className?: string; placeholder?: string; help?: string }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  return <div className="field">
    <div className="field-heading"><span className="field-label">{label}</span><button type="button" className="inline-copy-button" disabled={disabled || !mainValue} onClick={() => { if (textareaRef.current) textareaRef.current.value = mainValue; }}>Copy from main</button></div>
    <textarea ref={textareaRef} aria-label={label} className={className} name={name} defaultValue={defaultValue} disabled={disabled} placeholder={placeholder} />
    {help && <span className="field-help">{help}</span>}
  </div>;
}

function FormModal({ title, subtitle, close, children, wide = false, editor = false }: { title: string; subtitle: string; close: () => void; children: React.ReactNode; wide?: boolean; editor?: boolean }) {
  return <section className={`modal${wide ? " wide" : ""}${editor ? " editor" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title"><header className="modal-header"><div><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={close} aria-label="Close dialog"><X size={20} /></button></header><div className="modal-body">{children}</div></section>;
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{help && <span className="field-help">{help}</span>}</label>;
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="field-row">{children}</div>;
}

function ModalActions({ close, busy, label, icon }: { close: () => void; busy: boolean; label: string; icon?: React.ReactNode }) {
  return <div className="modal-actions"><button type="button" className="secondary-button" onClick={close}>Cancel</button><button type="submit" className="primary-button" disabled={busy}>{busy ? <Loader2 className="spin" size={17} /> : icon}{label}</button></div>;
}

function formatDate(value: string) {
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatRelativeDate(value: string) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function hostname(value: string) {
  try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return value; }
}

function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function splitTags(value: string) {
  return value.split(",").map((tag) => tag.trim()).filter(Boolean);
}
