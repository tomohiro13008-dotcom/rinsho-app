import { render } from 'preact';
import { App } from './app';
import { AppProvider } from './state';
import { themeCss } from './theme';
import { setSetting } from './store/db';
import { registerServiceWorker } from './update';
import './styles.css';

const style = document.createElement('style');
style.textContent = themeCss();
document.head.prepend(style);

render(
  <AppProvider>
    <App />
  </AppProvider>,
  document.getElementById('app')!,
);

// iOS などで保存領域が消えないよう、永続化を求める（結果は設定に表示する）。
if (navigator.storage?.persist) {
  void navigator.storage.persist().then((ok) => setSetting('persisted', ok));
}

// 全資産をキャッシュしてオフラインで動かす（本番ビルドだけ）。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => registerServiceWorker(navigator.serviceWorker));
}
