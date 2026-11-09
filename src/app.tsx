import { useRoute } from './router';
import { useAppMaybe } from './state';
import { CardView, Home, StateList } from './screens/field';
import { DrillView, Learn, Practice, SpecialtyView } from './screens/learn';
import { Dashboard } from './screens/dashboard';
import { Settings } from './screens/settings';
import { DrugView, FieldView, RefHome, TopicQuiz, TopicView } from './screens/reference';
import type { QueueSource } from './types';

const SOURCES: QueueSource[] = ['field', 'briefing', 'review', 'new', 'manual'];

function Screen() {
  const { parts, query } = useRoute();
  const [a, b, c] = parts;
  switch (a) {
    case undefined:
      return <Home />;
    case 'state':
      return <StateList stateId={b} />;
    case 'card':
      return <CardView key={b} cardId={b} from={query.get('from')} />;
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
      <a href="#/dash" aria-current={cur(['dash'])}>
        記録
      </a>
      <a href="#/settings" aria-current={cur(['settings'])}>
        設定
      </a>
    </nav>
  );
}

export function App() {
  const { data } = useAppMaybe();
  return (
    <div class="app">
      <header class="appbar">
        <a href="#/" class="appname">
          臨床力カード
        </a>
        {data ? (
          <a href="#/settings" class="facility" data-testid="facility">
            施設：{data.active.name}
          </a>
        ) : null}
      </header>
      {data ? <Screen /> : <main class="page"><p>読み込み中…</p></main>}
      <Nav />
    </div>
  );
}
