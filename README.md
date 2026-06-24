# Niko Travel Phuket

Сайт-витрина туристического агентства на Пхукете с единой каталоговой лентой: экскурсии, аренда и дополнительные услуги в одном интерфейсе.

Проект построен на Vite, контент управляется JSON-данными, а SEO-страницы карточек и разделов генерируются автоматически перед `dev` и `build`.

## Что реализовано

- Единый каталог на главной: экскурсии, аренда, услуги.
- Табы категорий: `Все`, `Морские`, `Наземные`, `Шоу`, `Бордеран и визаран`, `Аренда`, `Другие услуги`.
- Полнотекстовый поиск по каталогу.
- SEO-страницы карточек и разделов (генерация из JSON).
- Форма подбора на главной странице.
- Бронирование на страницах карточек (включая экскурсии с несколькими программами).
- Отправка лидов в email endpoint + fallback в Telegram.
- Передача UTM и click-id параметров в заявки.
- Событие `generate_lead` для аналитики/рекламы.
- Адаптивная верстка для мобильных устройств и десктопа.

## Технологии

- Vite 5
- Vanilla JS (ES modules)
- HTML + CSS
- Node.js script для генерации статических страниц

## Быстрый старт

```bash
npm install
npm run dev
```

По умолчанию локальный адрес: `http://localhost:5173`.

## Команды

```bash
npm run dev      # predev -> генерация страниц, затем запуск Vite
npm run build    # prebuild -> генерация страниц, затем production build
npm run preview  # локальный просмотр dist
```

## Структура проекта

| Путь | Назначение |
| --- | --- |
| index.html | Главная страница и шаблон карточки каталога |
| styles/main.css | Основные стили и адаптивные брейкпоинты |
| scripts/app.js | Логика каталога, фильтров, форм и аналитики |
| scripts/generate-pages.cjs | Генерация SEO-страниц и sitemap |
| data/excursions.json | Данные экскурсий + конфигурация агентства |
| data/rentals.json | Данные аренды |
| data/services.json | Данные дополнительных услуг |
| excursions/ | Сгенерированные страницы экскурсий (корень для прямых маршрутов) |
| rental/ | Сгенерированные страницы аренды (корень для прямых маршрутов) |
| services/ | Сгенерированные страницы услуг (корень для прямых маршрутов) |
| public/excursions/ | Копии страниц для сборки Vite |
| public/rental/ | Копии страниц для сборки Vite |
| public/services/ | Копии страниц для сборки Vite |
| robots.txt, sitemap.xml, 404.html | Базовый SEO и служебные страницы |

## Как управлять контентом

1. Обновите данные в JSON:
- `data/excursions.json`
- `data/rentals.json`
- `data/services.json`
2. Запустите `npm run dev` или `npm run build`.
3. Генератор пересоберет карточки, разделы и sitemap автоматически.

## Важные поля конфигурации

В `data/excursions.json`:

- `agency.currency` - валюта цен (`USD`, `EUR` и т.д.)
- `telegram.managerUsername` - username менеджера без `@`
- `emailService.endpoint` - endpoint для отправки заявок

## Лиды и аналитика

При отправке форм передаются:

- UTM: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
- Click IDs: `gclid`, `fbclid`, `yclid`, `msclkid`
- Контекст: `landingPage`, `lastPage`, `referrer`

Если email-сервис недоступен, включается fallback в Telegram.

## Деплой

Автодеплой на GitHub Pages настроен через workflow:

- `.github/workflows/deploy-pages.yml`

Обычно достаточно push в `main`: pipeline выполняет `npm ci` + `npm run build` и публикует `dist`.

## SEO чек перед запуском на домене

Перед релизом на свой домен проверьте:

1. Canonical и OG URL в `index.html`.
2. URL в `robots.txt` (строка `Sitemap`).
3. URL в `sitemap.xml`.
4. Наличие `CNAME` в `public/` (если используется GitHub Pages custom domain).

## Примечания

- Не открывайте `index.html` напрямую из файловой системы: нужен локальный сервер.
- Генерация страниц выполняется автоматически через `predev`/`prebuild`.
- В проекте предусмотрены fallback-изображения для карточек без валидных URL.