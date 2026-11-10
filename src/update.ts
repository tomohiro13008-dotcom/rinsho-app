// 新しい版の知らせ。Service Worker が入れ替わったら、画面の上に「読み込む」を出す。
// 勝手に読み込み直さない（現場でカードを見ている最中に画面が変わらないように）。
import { useEffect, useState } from 'preact/hooks';

let ready = false;
const listeners = new Set<() => void>();

export function markUpdateReady() {
  ready = true;
  listeners.forEach((f) => f());
}

export function useUpdateReady(): boolean {
  const [v, setV] = useState(ready);
  useEffect(() => {
    const f = () => setV(true);
    listeners.add(f);
    if (ready) setV(true);
    return () => void listeners.delete(f);
  }, []);
  return v;
}

/** 登録し、入れ替わりを見張る。アプリに戻ってきたときにも新しい版を確かめる。 */
export function registerServiceWorker(sw: ServiceWorkerContainer) {
  // 最初の登録（まだ制御していない）での controllerchange は知らせない。
  const hadController = !!sw.controller;
  sw.addEventListener('controllerchange', () => {
    if (hadController) markUpdateReady();
  });
  void sw.register('./sw.js').then((reg) => {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void reg.update().catch(() => {});
    });
  });
}
