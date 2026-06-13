import Dexie, { type EntityTable } from "dexie";

export interface Page {
  id: string;
  title: string;
  icon: string;
  parentId: string | null;
  /** BlockNote document, stored as JSON. `null` until first edited. */
  content: unknown[] | null;
  order: number;
  createdAt: number;
  updatedAt: number;
}

const db = new Dexie("MiNotionDB") as Dexie & {
  pages: EntityTable<Page, "id">;
};

db.version(1).stores({
  pages: "id, parentId, order, updatedAt",
});

export function uid(): string {
  return crypto.randomUUID();
}

export async function createPage(
  parentId: string | null = null,
  title = "",
  icon = "📄"
): Promise<string> {
  const id = uid();
  const now = Date.now();
  const siblings = await db.pages.where({ parentId: parentId ?? null }).count();
  await db.pages.add({
    id,
    title,
    icon,
    parentId,
    content: null,
    order: siblings,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updatePage(id: string, changes: Partial<Page>): Promise<void> {
  await db.pages.update(id, { ...changes, updatedAt: Date.now() });
}

/** Deletes a page and all of its descendants. */
export async function deletePage(id: string): Promise<void> {
  const toDelete: string[] = [];
  const collect = async (pageId: string) => {
    toDelete.push(pageId);
    const children = await db.pages.where({ parentId: pageId }).toArray();
    for (const child of children) await collect(child.id);
  };
  await collect(id);
  await db.pages.bulkDelete(toDelete);
}

export default db;
