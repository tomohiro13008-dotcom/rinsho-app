// 設定：施設プロフィール（段階プリセット＋スイッチ、複数保存と切り替え）、自施設メモ、書き出し・読み込み。
import { useState } from 'preact/hooks';
import { cards, drugs, registry, sceneLabel, topics } from '../content';
import { Section } from '../components';
import { newProfile, presetSwitches } from '../logic/facility';
import { formatDateTime } from '../logic/time';
import * as db from '../store/db';
import { useApp } from '../state';
import type { FacilityProfile } from '../types';

function ProfileEditor({ profile, onSave }: { profile: FacilityProfile; onSave: (p: FacilityProfile) => Promise<void> }) {
  const set = (patch: Partial<FacilityProfile>) => onSave({ ...profile, ...patch });
  return (
    <div class="profile-editor" data-profile={profile.id}>
      <label class="field">
        名前
        <input type="text" value={profile.name} onChange={(e) => set({ name: (e.target as HTMLInputElement).value })} />
      </label>
      <label class="field">
        施設の段階
        <select
          value={profile.tier}
          onChange={(e) => {
            const tier = (e.target as HTMLSelectElement).value;
            if (confirm(`${sceneLabel(tier)}の初期値で設備のスイッチを入れ直します。よいですか。`)) {
              void set({ tier, switches: presetSwitches(registry, tier) });
            } else {
              void set({ tier });
            }
          }}
        >
          {registry.scenes.map((s) => (
            <option value={s.id}>{s.label}</option>
          ))}
        </select>
      </label>
      <fieldset class="switches">
        <legend>この施設にある設備</legend>
        {registry.equipment.map((eq) => (
          <label class="check">
            <input
              type="checkbox"
              name={`eq-${eq.id}`}
              checked={!!profile.switches[eq.id]}
              onChange={(e) => set({ switches: { ...profile.switches, [eq.id]: (e.target as HTMLInputElement).checked } })}
            />
            {eq.label}
          </label>
        ))}
      </fieldset>
      <p class="small muted">救急カートの採用薬の選択は未実装（DESIGN.md の未決）。物の場所は下のメモに書く。</p>
      <label class="field">
        自施設メモ（物の場所・搬送の段取り）
        <textarea rows={4} value={profile.notes} onChange={(e) => set({ notes: (e.target as HTMLTextAreaElement).value })} />
      </label>
      <label class="field">
        連絡先（応援医・上位施設）
        <textarea rows={3} value={profile.contacts} onChange={(e) => set({ contacts: (e.target as HTMLTextAreaElement).value })} />
      </label>
      <p class="small">患者情報は書かない。メモと連絡先はこの端末の中だけに保存する。</p>
    </div>
  );
}

export function Settings() {
  const { data, refresh } = useApp();
  const [msg, setMsg] = useState('');

  const save = async (p: FacilityProfile) => {
    await db.saveProfile(p);
    await refresh();
  };
  const activate = async (id: string) => {
    await db.setSetting('activeProfileId', id);
    await refresh();
  };
  const add = async () => {
    const p = newProfile(registry, 'clinic', `施設${data.profiles.length + 1}`);
    await db.saveProfile(p);
    await db.setSetting('activeProfileId', p.id);
    await refresh();
  };
  const remove = async (id: string) => {
    if (data.profiles.length <= 1) return;
    if (!confirm('この施設プロフィールを消します。よいですか。')) return;
    await db.deleteProfile(id);
    if (data.active.id === id) await db.setSetting('activeProfileId', data.profiles.find((p) => p.id !== id)!.id);
    await refresh();
  };

  const doExport = async () => {
    const now = Date.now();
    await db.setSetting('lastExportAt', now);
    const file = await db.exportAll(now);
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rinsho-app-${formatDateTime(now).replace(/[ :]/g, '-')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setMsg('書き出しました。');
    await refresh();
  };
  const doImport = async (f: File | undefined) => {
    if (!f) return;
    if (!confirm('いまの記録・施設プロフィール・メモを、このファイルの中身で置き換えます。よいですか。')) return;
    try {
      await db.importAll(JSON.parse(await f.text()));
      setMsg('読み込みました。');
      await refresh();
    } catch (e) {
      setMsg(`読み込めませんでした：${(e as Error).message}`);
    }
  };

  return (
    <main class="page">
      <h1>設定</h1>
      <Section title="施設プロフィール">
        <fieldset class="profiles">
          <legend>いま使う施設</legend>
          {data.profiles.map((p) => (
            <div class="row">
              <label class="check">
                <input type="radio" name="active" checked={p.id === data.active.id} onChange={() => activate(p.id)} />
                {p.name}（{sceneLabel(p.tier)}）
              </label>
              {data.profiles.length > 1 ? (
                <button type="button" class="btn btn-small" onClick={() => remove(p.id)}>
                  消す
                </button>
              ) : null}
            </div>
          ))}
        </fieldset>
        <button type="button" class="btn" onClick={add}>
          施設を足す
        </button>
        <h3>「{data.active.name}」を編集</h3>
        <ProfileEditor key={data.active.id} profile={data.active} onSave={save} />
      </Section>
      <Section title="書き出し・読み込み（端末の引越し用）">
        <p class="small">
          記録はこの端末の中だけにあります。最後の書き出し：{data.lastExportAt ? formatDateTime(data.lastExportAt) : 'まだ'}
        </p>
        <div class="row wrap">
          <button type="button" class="btn btn-primary" onClick={doExport}>
            書き出す（JSON）
          </button>
          <label class="btn">
            読み込む
            <input type="file" accept="application/json,.json" class="visually-hidden" onChange={(e) => doImport((e.target as HTMLInputElement).files?.[0])} />
          </label>
        </div>
        {msg ? <p role="status">{msg}</p> : null}
        <p class="small muted">
          保存領域の保護：{data.persisted === null ? '未確認' : data.persisted ? '保護されている' : '保護されていない（ブラウザが消すことがある）'}
        </p>
      </Section>
      <Section title="このアプリについて">
        <p class="small">
          教育・訓練用。患者の情報は入力しない。体重や検査値から量や判定を出す機能はない。AIは入っていない。通信なしで動く。
        </p>
        <p class="small muted">{__PUBLIC_BUILD__ ? '配布版（自分用の出典を除いたビルド）' : '自分用のビルド'}</p>
        <p class="small muted" data-testid="build-id">
          版：{__BUILD_ID__}・カード{cards.length}枚・参照{topics.length}項目・薬{drugs.length}剤
        </p>
      </Section>
    </main>
  );
}
