import { goBack, useRoute } from './router';
import { drillById, topicById } from './content';
import { useAppMaybe } from './state';
import { CardView, Home, MarkView, StateList } from './screens/field';
import { DrillView, Learn, Practice, SpecialtyView } from './screens/learn';
import { Dashboard } from './screens/dashboard';
import { Settings } from './screens/settings';
import { DrugView, FieldView, RefHome, TopicQuiz, TopicView } from './screens/reference';
import { Toc } from './screens/toc';
import type { QueueSource } from './types';
import { useUpdateReady } from './update';

const SOURCES: QueueSource[] = ['marked', 'field', 'briefing', 'review', 'new', 'manual'];

function Screen() {
  const { parts, query } = useRoute();
  const [a, b, c] = parts;
  switch (a) {
    case undefined:
      return <Home />;
    case 'state':
      return <StateList stateId={b} />;
    case 'card':
      return c === 'mark' ? <MarkView key={b} cardId={b} /> : <CardView key={b} cardId={b} from={query.get('from')} />;
    case 'learn':
      return <Learn />;
    case 'practice':
      return <Practice key={`${b}/${c}`} cardId={b} source={SOURCES.includes(c as QueueSource) ? (c as QueueSource) : 'manual'} />;
    case 'drill':
      return <DrillView key={b} drillId={b} />;
    case 'specialty':
      return <SpecialtyView id={b} />;
    case 'ref':
      return b === 'field' && c ? <FieldView id={c} /> : <RefHome />;
    case 'topic':
      return c === 'quiz' ? <TopicQuiz key={b} id={b} /> : <TopicView key={b} id={b} />;
    case 'drug':
      return <DrugView key={b} id={b} />;
    case 'index':
      return <Toc />;
    case 'dash':
      return <Dashboard />;
    case 'settings':
      return <Settings />;
    default:
      return <Home />;
  }
}

function Nav() {
  const { parts } = useRoute();
  const a = parts[0];
  const cur = (keys: (string | undefined)[]) => (keys.includes(a) ? 'page' : undefined);
  return (
    <nav class="tabbar" aria-label="モード">
      <a href="#/" aria-current={cur([undefined, 'state', 'card'])}>
        現場
      </a>
      <a href="#/learn" aria-current={cur(['learn', 'practice', 'drill', 'specialty'])}>
        学習
      </a>
      <a href="#/ref" aria-current={cur(['ref', 'topic', 'drug'])}>
        参照
      </a>
      <a href="#/index" aria-current={cur(['index'])}>
        目次
      </a>
      <a href="#/dash" aria-current={cur(['dash'])}>
        記録
      </a>
      <a href="#/settings" aria-current={cur(['settings'])}>
        設定
      </a>
    </nav>
  );
}

/** 戻る先がないとき（直接開いたとき）に行く上の階層。タブの入口では null（戻るを出さない）。 */
export function parentOf(parts: string[]): string | null {
  const [a, b, c] = parts;
  switch (a) {
    case 'state':
      return '#/';
    case 'card':
      return c === 'mark' ? `#/card/${b}` : '#/';
    case 'practice':
      return '#/learn';
    case 'drill': {
      const d = drillById.get(b);
      return d && !d.cardId && d.specialty ? `#/specialty/${d.specialty}` : '#/learn';
    }
    case 'specialty':
      return '#/learn';
    case 'ref':
      return b === 'field' && c ? '#/ref' : null;
    case 'topic': {
      if (c === 'quiz') return `#/topic/${b}`;
      const t = topicById.get(b);
      return t ? `#/ref/field/${t.field}` : '#/ref';
    }
    case 'drug':
      return '#/ref';
    default:
      return null;
  }
}

function BackButton() {
  const { parts } = useRoute();
  const up = parentOf(parts);
  if (!up) return null;
  return (
    <button type="button" class="back" data-testid="back" onClick={() => goBack(up)}>
      <span aria-hidden="true">‹</span> 戻る
    </button>
  );
}

function UpdateNotice() {
  const ready = useUpdateReady();
  if (!ready) return null;
  return (
    <div class="notice update-notice" role="status" data-testid="update-notice">
      <span>新しい版があります。</span>
      <button type="button" class="btn btn-small" onClick={() => location.reload()}>
        読み込む
      </button>
    </div>
  );
}

export function App() {
  const { data } = useAppMaybe();
  return (
    <div class="app">
      <header class="appbar">
        <BackButton />
        <a href="#/" class="appname">
          臨床力カード
        </a>
        {data ? (
          <a href="#/settings" class="facility" data-testid="facility">
            施設：{data.active.name}
          </a>
        ) : null}
      </header>
      <UpdateNotice />
      {data ? <Screen /> : <main class="page"><p>読み込み中…</p></main>}
      <Nav />
    </div>
  );
}
