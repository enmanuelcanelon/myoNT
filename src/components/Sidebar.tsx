import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import db, { createPage, deletePage, type Page } from "../db";

interface TreeNode {
  page: Page;
  children: TreeNode[];
}

function buildTree(pages: Page[]): TreeNode[] {
  const byParent = new Map<string | null, Page[]>();
  for (const p of pages) {
    const key = p.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(p);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
  }
  const make = (parentId: string | null): TreeNode[] =>
    (byParent.get(parentId) ?? []).map((page) => ({
      page,
      children: make(page.id),
    }));
  return make(null);
}

interface RowProps {
  node: TreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function Row({ node, depth, selectedId, onSelect }: RowProps) {
  const [open, setOpen] = useState(true);
  const { page, children } = node;
  const hasChildren = children.length > 0;

  const handleAddSub = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(true);
    const id = await createPage(page.id);
    onSelect(id);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      confirm(
        `¿Borrar "${page.title || "Sin título"}" y todas sus subpáginas?`
      )
    ) {
      await deletePage(page.id);
    }
  };

  return (
    <div>
      <div
        className={`tree-row${selectedId === page.id ? " selected" : ""}`}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => onSelect(page.id)}
      >
        <button
          className="twisty"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          style={{ visibility: hasChildren ? "visible" : "hidden" }}
          aria-label="Expandir"
        >
          {open ? "▾" : "▸"}
        </button>
        <span className="row-icon">{page.icon}</span>
        <span className="row-title">{page.title || "Sin título"}</span>
        <span className="row-actions">
          <button onClick={handleAddSub} title="Nueva subpágina">
            +
          </button>
          <button onClick={handleDelete} title="Borrar">
            ×
          </button>
        </span>
      </div>
      {open &&
        children.map((child) => (
          <Row
            key={child.page.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

interface SidebarProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onImport: () => void;
  onExport: () => void;
}

export default function Sidebar({
  selectedId,
  onSelect,
  onImport,
  onExport,
}: SidebarProps) {
  const pages = useLiveQuery(() => db.pages.toArray(), []) ?? [];
  const [query, setQuery] = useState("");

  const tree = useMemo(() => buildTree(pages), [pages]);

  const filtered = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    return pages
      .filter((p) => (p.title || "").toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [query, pages]);

  const handleNewTop = async () => {
    const id = await createPage(null);
    onSelect(id);
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-logo">◆</span> Mi Notion
      </div>

      <input
        className="search"
        placeholder="Buscar…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="tree">
        {filtered ? (
          filtered.length === 0 ? (
            <div className="empty">Sin resultados</div>
          ) : (
            filtered.map((p) => (
              <div
                key={p.id}
                className={`tree-row${selectedId === p.id ? " selected" : ""}`}
                style={{ paddingLeft: 8 }}
                onClick={() => onSelect(p.id)}
              >
                <span className="twisty" style={{ visibility: "hidden" }} />
                <span className="row-icon">{p.icon}</span>
                <span className="row-title">{p.title || "Sin título"}</span>
              </div>
            ))
          )
        ) : tree.length === 0 ? (
          <div className="empty">
            No hay páginas todavía.
            <br />
            Crea una o importa tu Notion.
          </div>
        ) : (
          tree.map((node) => (
            <Row
              key={node.page.id}
              node={node}
              depth={0}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <button className="btn primary" onClick={handleNewTop}>
          + Nueva página
        </button>
        <div className="footer-row">
          <button className="btn" onClick={onImport}>
            ⬇ Importar Notion
          </button>
          <button className="btn" onClick={onExport}>
            ⬆ Exportar todo
          </button>
        </div>
      </div>
    </aside>
  );
}
