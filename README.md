# Anatomy Prompts

База готовых промтов для skill [`/anatomy`](https://github.com/wheresryan22/anatomy): изометрические SVG-, HTML- и WebGL-фигуры, которые объясняют идею как настоящий механизм. Каждый промт начинается с `/anatomy` — его копируют с сайта и вставляют в Claude Code.

## Запуск

```bash
npm install
npm run dev        # http://localhost:5173
npm run validate   # проверка всех записей
npm run build      # validate + typecheck + сборка в dist/
```

`dist/` — статический сайт, работает из любой папки любого хостинга.

## Как устроено

```
prompts/<id>.json            одна запись = один промт (схема: schema/prompt.schema.json)
public/examples/<id>.html    эталонный результат anatomy (+ <id>-light.html)
scripts/validate.ts          схема, id = имя файла, /anatomy в начале, переменные, файлы примеров
src/                         сайт: список с фильтрами, страница промта с подстановкой переменных
.claude/skills/visual-prompt скилл, который пишет новые промты и пополняет базу
```

Переменные в промте пишутся `{name}` и объявляются в `variables`; на странице промта для них есть поля, а итоговый текст копируется уже с подставленными значениями.

## Пополнение базы

В Claude Code внутри этой папки:

```
/visual-prompt write объяснить, как работает LRU-кэш       # только промт
/visual-prompt add объяснить, как работает LRU-кэш         # промт + prompts/<id>.json
/visual-prompt add token-bucket                             # сгенерировать пример через /anatomy
```

Генерация примера — это полноценная работа anatomy: Figure занимает до часа, Hero — 2–4 часа.

## Примеры

Шесть примеров (`dial-indicator`, `desk-computer`, `arcade-cabinet`, `raptor-engine`, `ripple-tank`, `turning-dial`) — собранные страницы из `examples/` skill anatomy (MIT, см. `public/examples/LICENSE-anatomy.txt`). Промты для них написаны так, чтобы воспроизводить эти фигуры. Остальные 9 записей пока без примеров.
