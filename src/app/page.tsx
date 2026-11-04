"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Workspace = { id: string; name: string; owner_id: string };
type Notebook = { id: string; workspace_id: string; title: string; position: number };
type Page = { id: string; notebook_id: string; title: string; content: any; position: number; updated_at: string; updated_by?: string | null };
type DocumentNode = { type: string; text?: string; content?: DocumentNode[] };

const supabase = (() => { try { return createClient(); } catch { return null; } })();

function getText(content: any): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  const walk = (node: any): string => {
    if (!node) return "";
    if (node.type === "text") return node.text || "";
    const children = Array.isArray(node.content) ? node.content.map(walk).join("") : "";
    return node.type === "paragraph" || node.type === "heading" ? children + "\n\n" : children;
  };
  return walk(content).trim();
}

function toDocument(value: string): DocumentNode {
  const content: DocumentNode[] = value.split(/\\n{2,}/).filter(Boolean).map((paragraph) => ({
    type: "paragraph",
    content: paragraph.split("\\n").flatMap((line, index): DocumentNode[] => [
      ...(index ? [{ type: "hardBreak" }] : []),
      ...(line ? [{ type: "text", text: line }] : []),
    ]),
  }));
  if (!content.length) content.push({ type: "paragraph" });
  return { type: "doc", content };
}

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [notebookId, setNotebookId] = useState("");
  const [pageId, setPageId] = useState("");
  const [draft, setDraft] = useState("");
  const [newWorkspace, setNewWorkspace] = useState("");
  const [newNotebook, setNewNotebook] = useState("");
  const [newPage, setNewPage] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState("");

  useEffect(() => {
    if (!supabase) {
      setError("Aplikasi belum terhubung ke Supabase. Tambahkan URL dan publishable key di Environment Variables Vercel.");
      setAuthLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }: { data: { session: any } }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event: string, nextSession: any) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  const loadData = useCallback(async (preferredWorkspaceId = workspaceId, preferredNotebookId = notebookId, preferredPageId = pageId) => {
    if (!supabase || !session?.user?.id) return;
    setError("");
    const { data: memberships, error: membershipError } = await supabase
      .from("workspace_members").select("workspace_id").eq("user_id", session.user.id);
    if (membershipError) { setError(membershipError.message); return; }
    const ids = (memberships || []).map((m: any) => m.workspace_id);
    const { data: owned, error: ownedError } = await supabase
      .from("workspaces").select("id,name,owner_id").eq("owner_id", session.user.id);
    if (ownedError) { setError(ownedError.message); return; }
    const combined = [...(owned || []), ...(ids.length ? (await supabase.from("workspaces").select("id,name,owner_id").in("id", ids)).data || [] : [])];
    const unique = Array.from(new Map(combined.map((w: any) => [w.id, w])).values()) as Workspace[];
    setWorkspaces(unique);
    const activeWorkspace = unique.some((w) => w.id === preferredWorkspaceId) ? preferredWorkspaceId : unique[0]?.id || "";
    setWorkspaceId(activeWorkspace);
    if (!activeWorkspace) { setNotebooks([]); setPages([]); setNotebookId(""); setPageId(""); return; }
    const { data: books, error: bookError } = await supabase.from("notebooks").select("id,workspace_id,title,position").eq("workspace_id", activeWorkspace).order("position");
    if (bookError) { setError(bookError.message); return; }
    setNotebooks(books || []);
    const activeBook = (books || []).some((b: any) => b.id === preferredNotebookId) ? preferredNotebookId : books?.[0]?.id || "";
    setNotebookId(activeBook);
    if (!activeBook) { setPages([]); setPageId(""); return; }
    const { data: docs, error: pageError } = await supabase.from("pages").select("id,notebook_id,title,content,position,updated_at").eq("notebook_id", activeBook).order("position");
    if (pageError) { setError(pageError.message); return; }
    setPages(docs || []);
    const activePage = (docs || []).some((p: any) => p.id === preferredPageId) ? preferredPageId : docs?.[0]?.id || "";
    setPageId(activePage);
    const selected = (docs || []).find((p: any) => p.id === activePage);
    setDraft(selected ? getText(selected.content) : "");
  }, [session, workspaceId, notebookId, pageId]);

  useEffect(() => { if (session) void loadData(); }, [session, loadData]);

  const selectedPage = useMemo(() => pages.find((p) => p.id === pageId), [pages, pageId]);

  const draftRef = useRef(draft);
  const savedContentRef = useRef(selectedPage?.content);
  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { savedContentRef.current = selectedPage?.content; }, [selectedPage?.content]);

  useEffect(() => {
    if (!supabase || !pageId) return;
    const channel = supabase
      .channel("page-live-" + pageId)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "pages",
        filter: "id=eq." + pageId,
      }, (payload: { new: Page }) => {
        const incoming = payload.new as Page;
        if (incoming.updated_by === session?.user?.id) return;
        if (draftRef.current !== getText(savedContentRef.current)) {
          setError("Halaman berubah dari perangkat lain. Perubahan lokal kamu belum ditimpa; simpan kembali setelah meninjau.");
          return;
        }
        setPages((old) => old.map((p) => p.id === incoming.id ? incoming : p));
        setDraft(getText(incoming.content));
        setLastSaved(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [pageId, session?.user?.id]);

  useEffect(() => {
    if (!supabase || !selectedPage || !session?.user?.id) return;
    if (draft === getText(selectedPage.content)) return;
    const timeout = window.setTimeout(async () => {
      setSaving(true);
      const { error: saveError } = await supabase.from("pages").update({
        content: toDocument(draft),
        updated_by: session.user.id,
        updated_at: new Date().toISOString(),
      }).eq("id", selectedPage.id);
      if (saveError) setError(saveError.message);
      else {
        setLastSaved(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
        setPages((old) => old.map((p) => p.id === selectedPage.id ? { ...p, content: toDocument(draft) } : p));
      }
      setSaving(false);
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [draft, selectedPage, session]);

  async function authenticate(event: React.FormEvent) {
    event.preventDefault(); if (!supabase) { setError("Supabase belum dikonfigurasi."); return; } setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "signup") {
        const { error: signError } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName }, emailRedirectTo: window.location.origin } });
        if (signError) throw signError;
        setMessage("Pendaftaran berhasil. Periksa email jika konfirmasi email diaktifkan.");
      } else {
        const { error: signError } = await supabase.auth.signInWithPassword({ email, password });
        if (signError) throw signError;
      }
    } catch (e: any) { setError(e.message || "Terjadi kesalahan."); }
    finally { setBusy(false); }
  }

  async function createWorkspace(event: React.FormEvent) {
    event.preventDefault(); if (!supabase || !newWorkspace.trim() || !session) return;
    setBusy(true); setError("");
    const { data, error: createError } = await supabase.from("workspaces").insert({ name: newWorkspace.trim(), owner_id: session.user.id }).select("id").single();
    if (createError || !data) { setError(createError?.message || "Workspace gagal dibuat."); }
    else {
      const { error: memberError } = await supabase.from("workspace_members").insert({ workspace_id: data.id, user_id: session.user.id, role: "editor" });
      if (memberError) setError(memberError.message);
      setNewWorkspace(""); await loadData(data.id, "", "");
    }
    setBusy(false);
  }

  async function createWorkspaceQuick() {
    const name = window.prompt("Nama workspace baru");
    if (!supabase || !name?.trim() || !session) return;
    setBusy(true); setError("");
    const { data, error: createError } = await supabase.from("workspaces").insert({ name: name.trim(), owner_id: session.user.id }).select("id").single();
    if (createError || !data) { setError(createError?.message || "Workspace gagal dibuat."); }
    else {
      const { error: memberError } = await supabase.from("workspace_members").insert({ workspace_id: data.id, user_id: session.user.id, role: "editor" });
      if (memberError) setError(memberError.message);
      await loadData(data.id, "", "");
    }
    setBusy(false);
  }

  async function createNotebook(event: React.FormEvent) {
    event.preventDefault(); if (!supabase || !newNotebook.trim() || !workspaceId || !session) return;
    setBusy(true);
    const { data, error: createError } = await supabase.from("notebooks").insert({ title: newNotebook.trim(), workspace_id: workspaceId, created_by: session.user.id, position: notebooks.length }).select("id").single();
    if (createError || !data) setError(createError?.message || "Notebook gagal dibuat."); else { setNewNotebook(""); await loadData(workspaceId, data.id, ""); }
    setBusy(false);
  }

  async function createPage(event: React.FormEvent) {
    event.preventDefault(); if (!supabase || !newPage.trim() || !notebookId || !session) return;
    setBusy(true);
    const { data, error: createError } = await supabase.from("pages").insert({ title: newPage.trim(), notebook_id: notebookId, created_by: session.user.id, updated_by: session.user.id, position: pages.length }).select("id").single();
    if (createError || !data) setError(createError?.message || "Halaman gagal dibuat."); else { setNewPage(""); await loadData(workspaceId, notebookId, data.id); }
    setBusy(false);
  }

  async function savePage() {
    if (!supabase || !selectedPage || !session) return;
    setSaving(true); setError("");
    const { error: saveError } = await supabase.from("pages").update({ content: toDocument(draft), updated_by: session.user.id, updated_at: new Date().toISOString() }).eq("id", selectedPage.id);
    if (saveError) setError(saveError.message);
    else { setLastSaved(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })); setPages((old) => old.map((p) => p.id === selectedPage.id ? { ...p, content: toDocument(draft) } : p)); }
    setSaving(false);
  }

  async function renamePage(title: string) {
    if (!supabase || !selectedPage || !title.trim()) return;
    const { error: renameError } = await supabase.from("pages").update({ title: title.trim() }).eq("id", selectedPage.id);
    if (renameError) setError(renameError.message);
    else setPages((old) => old.map((p) => p.id === selectedPage.id ? { ...p, title: title.trim() } : p));
  }

  if (authLoading) return <div className="auth-wrap"><div className="subtle">Memuat Prima Notebook…</div></div>;

  if (!session) return (
    <main className="auth-wrap">
      <section className="auth-card">
        <div className="brand"><div className="brand-mark">P</div><span>Prima Notebook</span></div>
        <h1>{mode === "signin" ? "Selamat datang kembali" : "Buat akun baru"}</h1>
        <p className="subtle">Catatan, ide, dan kerja tim dalam satu ruang.</p>
        <form onSubmit={authenticate}>
          {mode === "signup" && <div className="field"><label>Nama tampilan</label><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nama kamu" required /></div>}
          <div className="field"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" required /></div>
          <div className="field"><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 6 karakter" minLength={6} required /></div>
          <button className="btn primary" style={{ width: "100%", marginTop: 8 }} disabled={busy}>{busy ? "Memproses…" : mode === "signin" ? "Masuk" : "Daftar"}</button>
        </form>
        {error && <p className="error">{error}</p>}{message && <p className="success">{message}</p>}
        <p className="subtle" style={{ marginTop: 20, textAlign: "center" }}>{mode === "signin" ? "Belum punya akun?" : "Sudah punya akun?"} <button className="btn" style={{ padding: "5px 9px", marginLeft: 5 }} onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setMessage(""); }}>{mode === "signin" ? "Daftar" : "Masuk"}</button></p>
      </section>
    </main>
  );

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">P</div><span className="brand-name">Prima Notebook</span></div>
        <div>
          <div className="workspace-head"><span className="workspace-label">Workspace</span><button className="btn" style={{ padding: "3px 8px" }} onClick={createWorkspaceQuick}>+</button></div>
          {workspaces.map((w) => <button key={w.id} className={"nav-item " + (workspaceId === w.id ? "active" : "")} style={{ width: "100%", border: 0, background: workspaceId === w.id ? "#282342" : "transparent", textAlign: "left" }} onClick={() => { setWorkspaceId(w.id); setNotebookId(""); setPageId(""); }}><span>▦</span><span className="nav-label">{w.name}</span></button>)}
        </div>
        <div>
          <div className="workspace-head"><span className="workspace-label">Notebook</span><span className="workspace-label">{notebooks.length}</span></div>
          {notebooks.map((b) => <button key={b.id} className={"nav-item " + (notebookId === b.id ? "active" : "")} style={{ width: "100%", border: 0, background: notebookId === b.id ? "#282342" : "transparent", textAlign: "left" }} onClick={() => { setNotebookId(b.id); setPageId(""); }}>{notebookId === b.id ? "▾" : "▸"}<span className="nav-label">{b.title}</span></button>)}
          {workspaceId && <form onSubmit={createNotebook} style={{ display: "flex", gap: 5, marginTop: 8 }}><input aria-label="Nama notebook" value={newNotebook} onChange={(e) => setNewNotebook(e.target.value)} placeholder="+ Notebook baru" className="editor-input" style={{ padding: "8px", fontSize: 11, minWidth: 0 }} /><button className="btn" style={{ padding: "6px 8px" }} disabled={busy}>+</button></form>}
        </div>
        <div className="side-bottom"><div className="nav-item"><span>◉</span><span className="nav-label">{session.user.email}</span></div><button className="nav-item" style={{ width: "100%", border: 0, background: "transparent", textAlign: "left" }} onClick={() => { if (supabase) void supabase.auth.signOut(); }}><span>↪</span><span className="nav-label">Keluar</span></button></div>
      </aside>
      <section className="main-area">
        <header className="topbar"><div className="breadcrumb">Workspace / {workspaces.find((w) => w.id === workspaceId)?.name || "Pilih workspace"} / {notebooks.find((b) => b.id === notebookId)?.title || "Notebook"}</div><div className="card-meta">● Live sync aktif</div></header>
        <div className="content">
          {error && <p className="error">{error}</p>}
          {!workspaces.length ? <div className="empty"><div className="empty-icon">✦</div><h1>Mulai workspace pertamamu</h1><p className="subtle">Buat ruang untuk mengatur notebook dan catatanmu.</p><form onSubmit={createWorkspace} style={{ display: "flex", gap: 8, maxWidth: 420, margin: "22px auto 0" }}><input className="editor-input" value={newWorkspace} onChange={(e) => setNewWorkspace(e.target.value)} placeholder="Contoh: Personal atau Tim Prima" required /><button className="btn primary" disabled={busy}>Buat</button></form></div>
          : !notebooks.length ? <div className="empty"><div className="empty-icon">▤</div><h1>Buat notebook pertamamu</h1><p className="subtle">Notebook membantu memisahkan catatan berdasarkan topik.</p><form onSubmit={createNotebook} style={{ display: "flex", gap: 8, maxWidth: 420, margin: "22px auto 0" }}><input className="editor-input" value={newNotebook} onChange={(e) => setNewNotebook(e.target.value)} placeholder="Nama notebook" required /><button className="btn primary" disabled={busy}>Buat</button></form></div>
          : <><div className="welcome"><div><div className="eyebrow">Ruang kerja kamu</div><h1>{selectedPage?.title || "Catatan dan ide"}</h1><p className="subtle">Simpan pemikiranmu dan lanjutkan kapan saja.</p></div><form onSubmit={createPage} style={{ display: "flex", gap: 8, alignItems: "center" }}><input className="editor-input" style={{ width: 150, padding: 9, fontSize: 12 }} value={newPage} onChange={(e) => setNewPage(e.target.value)} placeholder="Nama halaman baru" /><button className="btn primary" disabled={busy}>+ Halaman</button></form></div>
          <div className="grid-cards" style={{ marginBottom: 20 }}>{pages.map((p) => <button key={p.id} className="card" style={{ textAlign: "left", borderColor: pageId === p.id ? "#8173ef" : undefined }} onClick={() => { setPageId(p.id); setDraft(getText(p.content)); }}><div className="card-title">▤ {p.title}</div><div className="card-meta">Diperbarui {new Date(p.updated_at).toLocaleDateString("id-ID")}</div></button>)}</div>
          {selectedPage ? <><div className="toolbar"><button className="btn" onClick={() => { const title = window.prompt("Ubah judul halaman", selectedPage.title); if (title) void renamePage(title); }}>Ubah judul</button><button className="btn primary" onClick={savePage} disabled={saving}>{saving ? "Menyimpan…" : "Simpan perubahan"}</button><span className="card-meta" style={{ alignSelf: "center" }}>{saving ? "Menyimpan…" : lastSaved ? "Terakhir disimpan " + lastSaved : "Autosave aktif"}</span></div><div className="editor"><textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Mulai tulis catatanmu di sini…" /></div></> : <div className="empty"><div className="empty-icon">✎</div><h2 style={{ fontSize: 18 }}>Pilih atau buat halaman</h2><p className="subtle">Semua catatan dalam notebook ini akan muncul di sini.</p></div>}
          </>}
        </div>
      </section>
    </main>
  );
}
