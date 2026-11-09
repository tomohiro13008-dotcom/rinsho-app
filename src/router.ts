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
