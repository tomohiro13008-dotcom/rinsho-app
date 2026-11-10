/// <reference types="vite/client" />
/** 配布版のビルドなら true（書籍の頁など public:false の出典を落としている）。 */
declare const __PUBLIC_BUILD__: boolean;
/** ビルドしたコミット（Netlify の COMMIT_REF の先頭7桁。手元のビルドは local）。 */
declare const __BUILD_ID__: string;
