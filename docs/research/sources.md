# Sources

| Prefix | Source | How reached | Snapshot | Max confidence alone |
|---|---|---|---|---|
| `survev` | https://github.com/survev/survev (GPL-3.0-or-later), open-source recreation of surviv.io v0.8.82 | git clone (full history) into `.survev/` | commit `c6185e31fe25a4a07def77a2bb25b1710bda90ac` (2026-09-29) | H |
| `changelog` | original surviv.io changelog 0.0.1 → 0.8.82, bundled as `client/public/changelog.html` in survev | same clone | same commit | H |
| `balance` | survev `balance.txt`, the fork's log of balance changes versus the original | same clone | same commit | H (for "the fork changed X") |
| `l10n` | official localization files, survev `client/public/l10n/*.json` | same clone | same commit | H |
| `fandom` | https://survivio.fandom.com (814 articles) | MediaWiki `api.php` dump into `research-cache/fandom/` (page HTML is behind a Cloudflare challenge) | 2026-10-05 | M |
| `wikigg` | https://survev.wiki.gg (344 articles, documents survev) | `api.php` dump into `research-cache/wikigg/` | 2026-10-05 | M |
| `wp-en` | https://en.wikipedia.org/wiki/Surviv.io | `api.php` | 2026-10-05 | M |
| `wp-ko` | https://ko.wikipedia.org | `api.php` (rate-limited, 429) | — | M |
| `namu` | https://namu.wiki (Surviv.io and sub-pages) | WebSearch result snippets only; direct access blocked by a Cloudflare challenge | 2026-10-05 | M, never H alone |
| `kong` | 2026 relaunch of the original game at https://surviv.io (also on Kongregate). Its changelog (`/changelog.html`) is v0.8.82 (Dec 30 2019) followed only by 0.9.0 (Mar 26 2026) – 0.9.3 (Sep 19 2026) fixes. `kong/relaunch-client-defs` = game object and map object definitions extracted from its client bundle (`app.e5465b46.js`) by `tools/research/extract-live-defs.ts`; `kong/relaunch-changelog` = its changelog | HTTPS fetch of the public client bundle | 2026-10-05 | H |
| `web` | any other URL | WebSearch / WebFetch | — | M, never H alone |
| `derived` | arithmetic or inference from other cited facts | — | — | inherits |
| `user` | the project owner's request for a deliberate rebirth deviation from v0.8.82 (`user/<yyyy-mm-dd>-<topic>`); used only in `rebirth-deviations.md`, never for facts about the original game | the request in the working session | date in the id | H (for "the rebirth deliberately changes X") |

Regenerate the dumps with:

```
NODE_USE_ENV_PROXY=1 node tools/scrape/mediawiki.ts fandom https://survivio.fandom.com/api.php
NODE_USE_ENV_PROXY=1 node tools/scrape/mediawiki.ts wikigg https://survev.wiki.gg/api.php
NODE_USE_ENV_PROXY=1 node tools/scrape/mediawiki.ts wikipedia-en https://en.wikipedia.org/w/api.php --titles Surviv.io
```
