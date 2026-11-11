import { useEffect, useState } from 'preact/hooks';

export interface Route {
  parts: string[];
  query: URLSearchParams;
}

function parse(): Route {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(qs ?? '') };
}

export function useRoute(): Route {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const on = () => {
      setR(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    // 最初の描画からこの登録までの間に変わったハッシュを取りこぼさない
    const now = parse();
    setR((prev) => (prev.parts.join('/') === now.parts.join('/') && prev.query.toString() === now.query.toString() ? prev : now));
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

export const go = (hash: string) => {
  location.hash = hash;
};

// アプリ内でたどったハッシュの列。戻るボタンは、アプリ内に前の画面があれば履歴を戻り、
// なければ（リンクから直接開いたとき）上の階層へ行く。ブラウザの戻ると同じ動きにそろえる。
const trail: string[] = [location.hash || '#/'];
window.addEventListener('hashchange', () => {
  const h = location.hash || '#/';
  if (trail.length > 1 && trail[trail.length - 2] === h) trail.pop();
  else if (trail[trail.length - 1] !== h) trail.push(h);
});

export const canGoBack = () => trail.length > 1;

export function goBack(fallback: string) {
  if (canGoBack()) {
    history.back();
    return;
  }
  // 上の階層へは置き換えで行く（そこで戻るを押したとき、元の画面へ行ったり来たりしないため）
  trail[trail.length - 1] = fallback;
  location.replace(fallback);
}
