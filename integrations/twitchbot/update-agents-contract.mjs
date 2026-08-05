#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const target = path.resolve(process.argv[2] ?? "AGENTS.md");
const source = fs.readFileSync(target, "utf8");
const start = source.indexOf("## 3. SCALE-агенты (обязательная оркестрация)");
const end = source.indexOf("### 3.1 Active project overlays", start);
if (start < 0 || end < 0) throw new Error(`Cannot locate SCALE contract in ${target}`);

const contract = `## 3. SCALE-агенты (обязательная оркестрация)

S.C.A.L.E. — обязательный способ выполнять нетривиальную работу в этом
репозитории. Это правило действует после \`compact\`, \`clear\`, \`resume\` и в
новом контексте: сначала прочитать \`$twitchbot-scale-orchestration\`, затем
\`$scale-orchestrator\`.

- Для задачи, которая требует исследования, изменения более одного файла,
  архитектурного решения, проверки или работы с внешним состоянием, оркестратор
  ОБЯЗАН маршрутизировать хотя бы одну ограниченную подзадачу подходящему
  \`scale_*\` агенту и независимо проверить её результат.
- Любая составная задача или задача в виде списка пунктов сначала проходит
  через именованный \`scale_orchestrator\` как SCALE Master. Исключение — одна
  атомарная low-risk правка с очевидной проверкой.
- \`scale_orchestrator\` закреплён за
  \`opencode-go/deepseek-v4-flash\` с \`high\`. OpenCodex 2.10+ публикует
  OpenCode Go модели в нативном каталоге Codex и переводит Responses/tool
  traffic; dispatcher, фиктивный provider и DeepSeek API не используются.
- OpenCodex работает как launchd service на \`127.0.0.1:10100\` и сохраняет
  native OpenAI provider как default. При сбое выполнить
  \`.codex/scale-library-src/scripts/scale-codex-recover.sh restore\`; после
  ремонта — \`reconnect\`.
- Каждый SCALE агент обязан начать первое сообщение точной строкой из TOML:
  \`[SCALE agent=<role> model=<model> reasoning=<effort>]\`. Несовпадение —
  ошибка маршрутизации, а не косметика.
- Проверки выполняются пакетно после всей серии изменений: не запускать один и
  тот же suite после каждого пункта, повторять только упавшую проверку после
  исправления и затем один финальный acceptance check.
- Выбирать bare \`scale_*\` для глобальных обязанностей, а
  \`scale_telik_*\` для project-owned overlay-ролей. Один mutation-surface —
  один владелец. Не создавать compatibility-синонимы и не вызывать retired
  \`cell-*\`.
- Overlay-модели разрешаются через \`.codex/scale-project-bindings.json\`.
  Persona, status и webdesign используют OpenCode Go только в пределах
  privacy boundary; identity, injection defense, backend/control boundary и
  центральный reactive orchestrator остаются native Sol/Terra. Sol не
  превышает \`high\`; \`medium\` и \`low\` разрешены и предпочтительны.
- Внешний профиль получает только bounded non-sensitive context, acceptance
  criteria и stop condition. Не передавать secrets, credentials, PII,
  production dumps или security investigations.
- Локальные overlay являются обычными project-owned TOML, поэтому materializer
  их не переписывает. Глобальные роли меняются через SCALE library и проходят
  \`$scale-validate\` перед promotion.

`;

fs.writeFileSync(target, `${source.slice(0, start)}${contract}${source.slice(end)}`);
console.log(`Updated TwitchBot SCALE contract: ${target}`);
