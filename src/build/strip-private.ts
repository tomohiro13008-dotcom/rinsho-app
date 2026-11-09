// 配布版のビルドで、public:false の出典（書籍の頁など自分用の欄）を content の JSON から落とす。
// Vite の transform から呼ばれる。入力は JSON 文字列、出力も JSON 文字列。

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function strip(node: Json): Json {
  if (Array.isArray(node)) return node.map(strip);
  if (node && typeof node === 'object') {
    const out: { [k: string]: Json } = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === 'sources' && Array.isArray(v)) {
        out[k] = v.filter((s) => !(s && typeof s === 'object' && !Array.isArray(s) && s.public === false)).map(strip);
      } else {
        out[k] = strip(v);
      }
    }
    return out;
  }
  return node;
}

export function stripPrivateSources(code: string): string {
  return JSON.stringify(strip(JSON.parse(code) as Json));
}
