import { useEffect, useRef, useState } from "react";
import { updatePage, type Page } from "../db";

const EMOJIS = [
  "📄", "📝", "📌", "✅", "💡", "🚀", "🔥", "⭐", "📚", "🎯",
  "🗒️", "📅", "💻", "🎨", "🧠", "❤️", "🌱", "🏆", "🔖", "📊",
];

export default function PageHeader({ page }: { page: Page }) {
  const [title, setTitle] = useState(page.title);
  const [showEmoji, setShowEmoji] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => setTitle(page.title), [page.id, page.title]);

  const onTitle = (v: string) => {
    setTitle(v);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      updatePage(page.id, { title: v });
    }, 300);
  };

  const pickEmoji = (emoji: string) => {
    updatePage(page.id, { icon: emoji });
    setShowEmoji(false);
  };

  return (
    <div className="page-header">
      <div className="emoji-wrap">
        <button className="page-emoji" onClick={() => setShowEmoji((s) => !s)}>
          {page.icon}
        </button>
        {showEmoji && (
          <div className="emoji-popover">
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => pickEmoji(e)}>
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
      <input
        className="page-title"
        value={title}
        placeholder="Sin título"
        onChange={(e) => onTitle(e.target.value)}
      />
    </div>
  );
}
