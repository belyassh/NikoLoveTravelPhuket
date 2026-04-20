const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const STYLES_SRC = path.join(ROOT, "styles", "main.css");
const IMAGE_SRC = path.join(ROOT, "image.png");
const FAVICON_SRC = path.join(ROOT, "niko_phuket_favicon.ico");
const SITE_URL = "https://nikophuket.com";
const FALLBACK_CARD_IMAGE = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80";
const TELEGRAM_MANAGER_USERNAME = "hitachi315";

const CATEGORY_LABELS = {
  sea: "Морские экскурсии",
  land: "Наземные экскурсии",
  show: "Шоу и вечерние программы",
  "auto-moto": "Аренда авто и мото",
  "yachts-catamarans": "Яхты и катамараны",
  "fast-track": "Fast Track",
  "border-run": "Border Run",
  transfer: "Трансферы"
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

function copyFileIfExists(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) {
    return;
  }

  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
}

function syncSharedAssets() {
  copyFileIfExists(STYLES_SRC, path.join(PUBLIC_DIR, "styles", "main.css"));
  copyFileIfExists(IMAGE_SRC, path.join(PUBLIC_DIR, "image.png"));
  copyFileIfExists(FAVICON_SRC, path.join(PUBLIC_DIR, "niko_phuket_favicon.ico"));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function asPrice(value, unit, currency) {
  if (typeof value !== "number") {
    return "По запросу";
  }
  return `${value} ${currency}${unit ? ` ${unit}` : ""}`;
}

function getFirstImage(item) {
  const images = Array.isArray(item?.images)
    ? item.images.filter((url) => typeof url === "string" && url.trim())
    : [];

  return images[0] || FALLBACK_CARD_IMAGE;
}

function pageTemplate({ title, description, canonicalPath, body, jsonLd }) {
  const canonical = `${SITE_URL}${canonicalPath}`;
  const ogImage = `${SITE_URL}/image.png`;

  return `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${canonical}" />
    <meta name="robots" content="index,follow" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Niko Phuket" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${ogImage}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${ogImage}" />

    <link rel="icon" href="/niko_phuket_favicon.ico" sizes="any" />
    <link rel="shortcut icon" href="/niko_phuket_favicon.ico" type="image/x-icon" />
    <link rel="apple-touch-icon" href="/image.png" />

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Unbounded:wght@500;700&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="/styles/main.css" />

    <style>
      .seo-main {
        display: grid;
        gap: 1.8rem;
        padding-bottom: 2.8rem;
      }
      .seo-page {
        border-radius: var(--radius-lg);
        border: 1px solid var(--line);
        background: rgba(255, 254, 248, 0.9);
        box-shadow: var(--shadow);
        padding: clamp(1.2rem, 2.5vw, 2rem);
      }
      .seo-head { margin-bottom: 0.9rem; }
      .seo-head h1 { margin: 0 0 0.6rem; }
      .seo-head p {
        color: var(--muted);
        max-width: 760px;
        line-height: 1.5;
      }
      .seo-head-actions {
        margin-top: 0.9rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
      }
      .seo-grid { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); margin-bottom: 1.5rem; align-items: stretch; }
      .seo-grid .seo-card { display: flex; flex-direction: column; height: 100%; }
      .seo-card { border: 1px solid var(--line); border-radius: var(--radius-md); padding: 1.2rem; background: var(--surface); margin-bottom: 1.5rem; }
      @media (min-width: 1401px) {
        .seo-grid { grid-template-columns: repeat(3, 1fr); }
      }
      @media (max-width: 768px) {
        .seo-grid { grid-template-columns: 1fr; }
      }
      .seo-card ul { flex: 1; }
      .seo-card:last-child { margin-bottom: 0; }
      .seo-card-price { background: rgba(12, 122, 109, 0.05); border-left: 4px solid var(--brand); }
      .seo-price-big { font-size: 1.4rem; color: var(--brand); margin: 0; }
      .seo-card h2 { margin: 0 0 0.9rem 0; font-size: 1.1rem; }
      .seo-card h3 { margin: 0.9rem 0 0.6rem 0; }
      .seo-card p { margin-bottom: 0; }
      .seo-card ul { margin: 0; padding-left: 1.3rem; }
      .seo-card li { margin-bottom: 0.5rem; }
      .seo-card li:last-child { margin-bottom: 0; }
      .seo-list { margin: 0.7rem 0 0; padding-left: 1.1rem; }
      .seo-meta-list { margin: 0.7rem 0 0; padding-left: 1.1rem; list-style: none; }
      .seo-meta-list li { margin-bottom: 0.5rem; }
      .seo-itinerary { margin-top: 0.9rem; display: flex; flex-direction: column; gap: 0.6rem; }
      .itinerary-step { display: flex; gap: 0.8rem; padding: 0.6rem; background: var(--bg); border-radius: var(--radius-sm); align-items: flex-start; }
      .itinerary-time { min-width: 60px; font-weight: 600; color: var(--brand); font-size: 0.9rem; }
      .itinerary-activity { flex: 1; font-size: 0.9rem; }
      .seo-breadcrumbs { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 1rem; }
      .seo-breadcrumbs a { color: var(--brand); }
      .seo-back-top { margin-bottom: 0.9rem; }
      .muted { opacity: 0.85; }
      .seo-request-wrap {
        margin-top: 1rem;
      }
      .seo-hero-image {
        border: 1px solid var(--line);
        border-radius: var(--radius-md);
        overflow: hidden;
        margin-bottom: 1rem;
        background: var(--surface);
      }
      .seo-hero-image img {
        display: block;
        width: 100%;
        height: clamp(220px, 36vw, 420px);
        object-fit: cover;
      }
      .seo-header-links { display: flex; gap: 1rem; align-items: center; }
      .seo-header-links a { color: var(--muted); }
      .seo-header-links a:hover { color: var(--text); }
      @media (max-width: 900px) {
        .seo-header-links { display: none; }
        .seo-page {
          padding: 1.1rem;
        }
        .seo-head h1 {
          font-size: clamp(1.8rem, 10vw, 3rem);
        }
      }
    </style>
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  </head>
  <body>
    <div class="bg-shapes" aria-hidden="true">
      <span class="shape shape-a"></span>
      <span class="shape shape-b"></span>
      <span class="shape shape-c"></span>
    </div>

    <header class="site-header">
      <a class="brand" href="/index.html" aria-label="На главную Niko Phuket">
        <img class="brand-mark" src="/image.png" alt="Логотип Niko Phuket" loading="lazy" decoding="async" />
        <span class="brand-text">Niko Phuket</span>
      </a>
      <nav class="seo-header-links" aria-label="SEO разделы">
        <a href="/excursions/index.html">Экскурсии</a>
        <a href="/rental/index.html">Аренда</a>
        <a href="/services/index.html">Услуги</a>
      </nav>
      <a class="btn btn-ghost" href="/index.html#request">Оставить заявку</a>
    </header>

    <main class="seo-main">
      <section class="seo-page">
        <p class="seo-back-top"><a class="btn btn-ghost" href="/index.html">← Назад</a></p>
        ${body}
      </section>
    </main>

    <footer class="site-footer" id="contacts">
      <div class="footer-grid">
        <section class="footer-block footer-brand" aria-label="О компании Niko Phuket">
          <a class="brand footer-logo" href="/index.html" aria-label="На главную Niko Phuket">
            <img class="brand-mark" src="/image.png" alt="Логотип Niko Phuket" loading="lazy" decoding="async" />
            <span class="brand-text">Niko Phuket</span>
          </a>
          <p class="footer-mission">Создаем маршруты и моменты, которые остаются с вами надолго.</p>
          <p class="footer-hours">Поддержка: ежедневно 09:00-21:00</p>
        </section>

        <nav class="footer-block" aria-label="Разделы сайта">
          <h3>Разделы</h3>
          <a href="/excursions/index.html">Все экскурсии</a>
          <a href="/rental/index.html">Аренда</a>
          <a href="/services/index.html">Услуги</a>
          <a href="/index.html#faq">FAQ</a>
        </nav>

        <section class="footer-block" aria-label="Документы">
          <h3>Документы</h3>
          <a href="/privacy.html">Политика конфиденциальности</a>
          <a href="/refund-policy.html">Условия возврата</a>
        </section>

        <section class="footer-block" aria-label="Контакты">
          <h3>Контакты</h3>
          <a href="https://t.me/hitachi315" target="_blank" rel="noreferrer">Менеджер в Telegram</a>
          <div class="footer-socials">
            <a href="https://t.me/hitachi315" target="_blank" rel="noreferrer">Telegram</a>
            <a href="https://instagram.com" target="_blank" rel="noreferrer">Instagram</a>
            <a href="https://youtube.com" target="_blank" rel="noreferrer">YouTube</a>
          </div>
        </section>
      </div>

      <div class="footer-bottom">
        <p>© 2026 Niko Phuket. Все права защищены.</p>
        <div class="payment-methods" aria-label="Доступные способы оплаты">
          <span>Visa</span>
          <span>Mastercard</span>
          <span>Mir</span>
        </div>
      </div>
    </footer>

    <script>
      (function () {
        const form = document.querySelector('[data-enhanced-request="true"]');
        if (!form) {
          return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        const note = form.querySelector('[data-form-note]');

        const setSubmitting = (isSubmitting) => {
          if (!submitButton) {
            return;
          }
          submitButton.disabled = isSubmitting;
          submitButton.textContent = isSubmitting ? 'Отправляем...' : 'Отправить запрос';
        };

        const buildFallbackMessage = (formData) => {
          const entries = [];
          for (const [key, value] of formData.entries()) {
            if (!value || key.startsWith('_') || key === 'source' || key === 'leadType') {
              continue;
            }
            entries.push(key + ': ' + String(value));
          }
          return ['Здравствуйте! Хочу отправить запрос по услуге/товару.', ...entries].join('\n');
        };

        form.addEventListener('submit', async (event) => {
          event.preventDefault();

          if (!form.checkValidity()) {
            form.reportValidity();
            return;
          }

          const payload = new FormData(form);
          setSubmitting(true);
          if (note) {
            note.textContent = 'Отправляем запрос...';
          }

          try {
            const response = await fetch(form.action, {
              method: 'POST',
              headers: { Accept: 'application/json' },
              body: payload
            });

            if (response.ok) {
              form.reset();
              if (note) {
                note.textContent = 'Запрос отправлен. Менеджер свяжется с вами в ближайшее время.';
              }
              return;
            }

            throw new Error('Email service rejected request');
          } catch (error) {
            const message = buildFallbackMessage(payload);
            const telegramUrl = 'https://t.me/${TELEGRAM_MANAGER_USERNAME}';
            window.open(telegramUrl, '_blank', 'noopener,noreferrer');

            try {
              if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(message);
                if (note) {
                  note.textContent = 'Открыт Telegram. Текст запроса скопирован, вставьте его в чат.';
                }
              } else if (note) {
                note.textContent = 'Открыт Telegram. Вставьте детали запроса вручную.';
              }
            } catch {
              if (note) {
                note.textContent = 'Открыт Telegram. Вставьте детали запроса вручную.';
              }
            }
          } finally {
            setSubmitting(false);
          }
        });
      })();
    </script>
  </body>
</html>`;
}

function normalizeExcursions(raw, currency) {
  return raw.map((item) => ({
    ...item,
    slug: item.slug || item.id,
    category: item.category || "land",
    type: "excursion",
    priceLabel: asPrice(item.price, "за человека", currency)
  }));
}

function normalizeRentals(raw, currency) {
  return raw.map((item) => {
    const group = item.group || (item.category === "yachts-catamarans" ? "yachts-catamarans" : "auto-moto");
    return {
      ...item,
      slug: item.slug || item.id,
      group,
      type: "rental",
      priceLabel: asPrice(item.prices?.day, "в день", currency)
    };
  });
}

function normalizeServices(raw, currency) {
  return raw.map((item) => ({
    ...item,
    slug: item.slug || item.id,
    category: item.category || "transfer",
    type: "service",
    priceLabel: asPrice(item.priceFrom, item.unit || "", currency)
  }));
}

function cardMarkup(item, urlPath) {
  const imageUrl = getFirstImage(item);

  return `<article class="tour-card">
    <img class="tour-card-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async" />
    <div class="tour-card-body">
      <h3 class="tour-card-title">${escapeHtml(item.title)}</h3>
      <p class="tour-card-overview">${escapeHtml(item.overview || item.description || "")}</p>
      <div class="tour-card-foot">
        <p class="tour-card-price">Стоимость: ${escapeHtml(item.priceLabel)}</p>
        <div class="tour-card-actions">
          <a class="btn btn-small btn-ghost" href="${urlPath}">Подробнее</a>
          <a class="btn btn-small btn-primary" href="${urlPath}#request">Запросить</a>
        </div>
      </div>
    </div>
  </article>`;
}

function requestFields(type) {
  const durationField = type === "rental"
    ? `<label class="field field-wide"><span>Желаемая длительность аренды</span><input name="rentalDuration" type="text" placeholder="Например: 5 дней" required /></label>`
    : `<label class="field"><span>Количество взрослых</span><input name="adultsCount" type="number" min="1" value="2" required /></label>
       <label class="field"><span>Количество детей</span><input name="childrenCount" type="number" min="0" value="0" required /></label>
       <label class="field"><span>Даты отдыха: с</span><input name="vacationStart" type="date" required /></label>
       <label class="field"><span>Даты отдыха: по</span><input name="vacationEnd" type="date" required /></label>`;

  return `<label class="field"><span>Имя</span><input name="firstName" type="text" required /></label>
      <label class="field"><span>Фамилия</span><input name="lastName" type="text" required /></label>
      <label class="field field-wide"><span>Телефон</span><input name="phone" type="tel" placeholder="+7..." required /></label>
      <label class="field"><span>Отель</span><input name="hotel" type="text" placeholder="Название отеля" required /></label>
      <label class="field"><span>Ник в Telegram</span><input name="telegramNick" type="text" placeholder="@nickname" required /></label>
      ${durationField}`;
}

function renderProductRequestForm({ type, itemTitle, endpoint }) {
  const subject = type === "rental"
    ? `Новый запрос по аренде: ${itemTitle}`
    : `Новый запрос по экскурсии: ${itemTitle}`;
  const leadType = type === "rental" ? "Запрос по аренде" : "Запрос по экскурсии";
  const source = type === "rental" ? "Niko Phuket rental product page" : "Niko Phuket excursion product page";

  if (!endpoint) {
    return `<div class="seo-request-wrap"><section class="request" id="request">
      <div class="section-head">
        <h2>${type === "rental" ? "Запрос по аренде" : "Запрос по экскурсии"}</h2>
        <p>Для отправки запроса напишите менеджеру в Telegram через кнопку в шапке или на главной странице.</p>
      </div>
      </section></div>`;
  }

    return `<div class="seo-request-wrap"><section class="request" id="request">
      <div class="section-head">
        <h2>${type === "rental" ? "Запрос по аренде" : "Запрос по экскурсии"}</h2>
        <p>Заполните форму: менеджер свяжется с вами для подтверждения деталей.</p>
      </div>
      <form class="request-form" method="POST" action="${endpoint}" data-enhanced-request="true">
        <input type="hidden" name="_subject" value="${escapeHtml(subject)}" />
        <input type="hidden" name="leadType" value="${escapeHtml(leadType)}" />
        <input type="hidden" name="itemTitle" value="${escapeHtml(itemTitle)}" />
        <input type="hidden" name="source" value="${escapeHtml(source)}" />
        <div class="form-grid">
          ${requestFields(type)}
          <input name="_gotcha" type="text" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;opacity:0;pointer-events:none;" aria-hidden="true" />
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">Отправить запрос</button>
          <p class="form-note" data-form-note aria-live="polite"></p>
        </div>
      </form>
    </section></div>`;
}

function excursionDetailPage(item, endpoint) {
  const urlPath = `/excursions/${item.slug}.html`;
  const title = `${item.title} | Экскурсия на Пхукете | Niko Phuket`;
  const description = item.overview || item.description || `Экскурсия ${item.title} на Пхукете`;

  const heroImage = getFirstImage(item);
  
  // Построение стоимости в отдельный блок
  const priceBlockHtml = `<section class="seo-card seo-card-price">
        <h2>💰 Стоимость</h2>
        <p class="seo-price-big"><strong>${escapeHtml(item.priceLabel)}</strong></p>
      </section>`;

  // Построение расписания
  const itineraryHtml = item.itinerary && item.itinerary.length > 0
    ? `<section class="seo-card">
        <h2>📅 Расписание тура</h2>
        <div class="seo-itinerary">
          ${item.itinerary.map((step) => `
            <div class="itinerary-step">
              <span class="itinerary-time">${escapeHtml(step.time)}</span>
              <span class="itinerary-activity">${escapeHtml(step.activity)}</span>
            </div>
          `).join("")}
        </div>
      </section>`
    : '';

  // Построение метаинформации
  const metaHtml = (item.duration || item.groupSize || item.difficulty)
    ? `<section class="seo-card">
        <h2>ℹ️ Основная информация</h2>
        <ul class="seo-meta-list">
          ${item.duration ? `<li><strong>Длительность:</strong> ${escapeHtml(item.duration)}</li>` : ''}
          ${item.groupSize ? `<li><strong>Размер группы:</strong> ${escapeHtml(item.groupSize)}</li>` : ''}
          ${item.difficulty ? `<li><strong>Сложность:</strong> ${escapeHtml(item.difficulty)}</li>` : ''}
        </ul>
      </section>`
    : '';

  // Построение требований
  const requirementsHtml = item.requirements && item.requirements.length > 0
    ? `<section class="seo-card">
        <h2>⚠️ Требования и условия</h2>
        <ul class="seo-list">${item.requirements.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
      </section>`
    : '';

  // Построение примечаний
  const notesHtml = item.notes
    ? `<section class="seo-card">
        <h2>📌 Важные примечания</h2>
        <p>${escapeHtml(item.notes)}</p>
      </section>`
    : '';

  const body = `<div class="seo-hero-image"><img src="${escapeHtml(heroImage)}" alt="${escapeHtml(item.title)}" loading="eager" decoding="async" /></div>
    <nav class="seo-breadcrumbs" aria-label="Хлебные крошки">
      <a href="/index.html">Главная</a>
      <span>/</span>
      <span>Экскурсии</span>
      <span>/</span>
      <span>${escapeHtml(item.title)}</span>
    </nav>
    <section class="seo-head">
      <h1>${escapeHtml(item.title)}</h1>
      <p>${escapeHtml(description)}</p>
    </section>
    ${priceBlockHtml}
    ${metaHtml}
    ${itineraryHtml}
    <section class="seo-grid">
      <article class="seo-card">
        <h2>✅ Что входит</h2>
        <ul class="seo-list">${(item.included || []).map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
      </article>
      <article class="seo-card">
        <h2>🎒 Что взять с собой</h2>
        <ul class="seo-list">${(item.bring || []).map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
      </article>
    </section>
    ${requirementsHtml}
    ${notesHtml}
    ${renderProductRequestForm({ type: "excursion", itemTitle: item.title, endpoint })}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: item.title,
    description,
    duration: item.duration || undefined,
    touristType: "Туристы на Пхукете",
    offers: {
      "@type": "Offer",
      price: item.price,
      priceCurrency: "THB",
      url: `${SITE_URL}${urlPath}`
    },
    provider: {
      "@type": "TravelAgency",
      name: "Niko Phuket",
      url: SITE_URL
    }
  };

  return { path: urlPath, html: pageTemplate({ title, description, canonicalPath: urlPath, body, jsonLd }) };
}

function rentalDetailPage(item, endpoint) {
  const urlPath = `/rental/${item.slug}.html`;
  const title = `${item.title} | Аренда на Пхукете | Niko Phuket`;
  const description = item.overview || item.description || `Аренда ${item.title} на Пхукете`;

  const prices = item.prices || {};
  const heroImage = getFirstImage(item);
  
  // Построение стоимости в отдельный блок
  const priceBlockHtml = `<section class="seo-card seo-card-price">
        <h2>💰 Тарифы</h2>
        <ul class="seo-list">
          <li>День: ${escapeHtml(asPrice(prices.day, "", "THB"))}</li>
          <li>Неделя: ${escapeHtml(asPrice(prices.week, "", "THB"))}</li>
          <li>Месяц: ${escapeHtml(asPrice(prices.month, "", "THB"))}</li>
        </ul>
      </section>`;

  // Построение спецификаций
  const specsHtml = (item.specs || item.fuel || item.duration)
    ? `<section class="seo-card">
        <h2>📋 Характеристики</h2>
        <ul class="seo-meta-list">
          ${item.specs ? `<li><strong>Спецификация:</strong> ${escapeHtml(item.specs)}</li>` : ''}
          ${item.fuel ? `<li><strong>Топливо:</strong> ${escapeHtml(item.fuel)}</li>` : ''}
          ${item.duration ? `<li><strong>Длительность:</strong> ${escapeHtml(item.duration)}</li>` : ''}
        </ul>
      </section>`
    : '';

  // Построение требований
  const requirementsHtml = item.requirements && item.requirements.length > 0
    ? `<section class="seo-card">
        <h2>⚠️ Требования и условия</h2>
        <ul class="seo-list">${item.requirements.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
      </section>`
    : '';

  // Построение примечаний
  const notesHtml = item.notes
    ? `<section class="seo-card">
        <h2>📌 Важные примечания</h2>
        <p>${escapeHtml(item.notes)}</p>
      </section>`
    : '';

  const body = `<div class="seo-hero-image"><img src="${escapeHtml(heroImage)}" alt="${escapeHtml(item.title)}" loading="eager" decoding="async" /></div>
    <nav class="seo-breadcrumbs" aria-label="Хлебные крошки">
      <a href="/index.html">Главная</a>
      <span>/</span>
      <a href="/rental/index.html">Аренда</a>
      <span>/</span>
      <span>${escapeHtml(item.title)}</span>
    </nav>
    <section class="seo-head">
      <h1>${escapeHtml(item.title)}</h1>
      <p>${escapeHtml(description)}</p>
      <p><strong>Депозит:</strong> ${escapeHtml(item.deposit || "По запросу")}</p>
    </section>
    ${priceBlockHtml}
    ${specsHtml}
    <section class="seo-card">
      <h2>✅ Что входит</h2>
      <ul class="seo-list">${(item.included || []).map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
    </section>
    ${requirementsHtml}
    ${notesHtml}
    ${renderProductRequestForm({ type: "rental", itemTitle: item.title, endpoint })}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.title,
    description,
    offers: {
      "@type": "Offer",
      price: prices.day || undefined,
      priceCurrency: "THB",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}${urlPath}`
    },
    brand: {
      "@type": "Organization",
      name: "Niko Phuket"
    }
  };

  return { path: urlPath, html: pageTemplate({ title, description, canonicalPath: urlPath, body, jsonLd }) };
}

function serviceDetailPage(item) {
  const urlPath = `/services/${item.slug}.html`;
  const title = `${item.title} | Услуги на Пхукете | Niko Phuket`;
  const description = item.overview || item.description || `Услуга ${item.title} на Пхукете`;

  // Построение стоимости в отдельный блок
  const priceBlockHtml = `<section class="seo-card seo-card-price">
        <h2>💰 Стоимость</h2>
        <p class="seo-price-big"><strong>${escapeHtml(item.priceLabel)}</strong></p>
      </section>`;

  // Построение информации
  const infoHtml = item.duration
    ? `<section class="seo-card">
        <h2>⏱️ Информация</h2>
        <ul class="seo-meta-list">
          <li><strong>Длительность:</strong> ${escapeHtml(item.duration)}</li>
        </ul>
      </section>`
    : '';

  // Построение включённого
  const includedHtml = item.included && item.included.length > 0
    ? `<section class="seo-card">
        <h2>✅ Что входит</h2>
        <ul class="seo-list">${item.included.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
      </section>`
    : '';

  // Построение примечаний
  const notesHtml = item.notes
    ? `<section class="seo-card">
        <h2>📌 Важно знать</h2>
        <p>${escapeHtml(item.notes)}</p>
      </section>`
    : '';

  const body = `<nav class="seo-breadcrumbs" aria-label="Хлебные крошки">
      <a href="/index.html">Главная</a>
      <span>/</span>
      <a href="/services/index.html">Услуги</a>
      <span>/</span>
      <span>${escapeHtml(item.title)}</span>
    </nav>
    <section class="seo-head">
      <h1>${escapeHtml(item.title)}</h1>
      <p>${escapeHtml(description)}</p>
    </section>
    ${priceBlockHtml}
    ${infoHtml}
    <section class="seo-card">
      <h2>📝 Описание услуги</h2>
      <p>${escapeHtml(item.description || "")}</p>
    </section>
    ${includedHtml}
    ${notesHtml}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: item.title,
    description,
    provider: {
      "@type": "TravelAgency",
      name: "Niko Phuket",
      url: SITE_URL
    },
    areaServed: {
      "@type": "Place",
      name: "Phuket, Thailand"
    },
    offers: {
      "@type": "Offer",
      price: item.priceFrom,
      priceCurrency: "THB",
      url: `${SITE_URL}${urlPath}`
    }
  };

  return { path: urlPath, html: pageTemplate({ title, description, canonicalPath: urlPath, body, jsonLd }) };
}

function categoryPage({ sectionPath, slug, seoTitle, heading, description, items, itemPathBuilder }) {
  const urlPath = `/${sectionPath}/${slug}.html`;
  const body = `<nav class="seo-breadcrumbs" aria-label="Хлебные крошки">
      <a href="/index.html">Главная</a>
      <span>/</span>
      <span>${escapeHtml(heading)}</span>
    </nav>
    <section class="seo-head">
      <h1>${escapeHtml(heading)}</h1>
      <p>${escapeHtml(description)}</p>
    </section>
    <section class="cards-grid">
      ${items.map((item) => cardMarkup(item, itemPathBuilder(item))).join("\n")}
    </section>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: heading,
    description,
    url: `${SITE_URL}${urlPath}`
  };

  return { path: urlPath, html: pageTemplate({ title: seoTitle, description, canonicalPath: urlPath, body, jsonLd }) };
}

function excursionsIndexPage(excursionsByCategory) {
  const sea = excursionsByCategory.sea || [];
  const land = excursionsByCategory.land || [];
  const urlPath = "/excursions/index.html";
  const title = "Все экскурсии на Пхукете: морские и наземные | Niko Phuket";
  const description = "Полный список экскурсий на Пхукете с разделением на морские и наземные направления.";

  const section = (sectionTitle, items) => `<section class="catalog">
      <div class="section-head">
        <h2>${escapeHtml(sectionTitle)}</h2>
        <p>Всего маршрутов: ${items.length}</p>
      </div>
      <div class="seo-grid">
        ${items.map((item) => cardMarkup(item, `/excursions/${item.slug}.html`)).join("\n")}
      </div>
    </section>`;

  const body = `<nav class="seo-breadcrumbs" aria-label="Хлебные крошки">
      <a href="/index.html">Главная</a>
      <span>/</span>
      <span>Все экскурсии</span>
    </nav>
    <section class="seo-head">
      <h1>Все экскурсии на Пхукете</h1>
      <p>Полный каталог без ограничений по количеству: морские и наземные экскурсии отдельными витринами.</p>
      <div class="seo-head-actions"><a class="btn btn-ghost" href="/rental/index.html">Перейти в раздел аренды</a></div>
    </section>
    ${section("Морские экскурсии", sea)}
    ${section("Наземные экскурсии", land)}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Все экскурсии на Пхукете",
    description,
    url: `${SITE_URL}${urlPath}`
  };

  return { path: urlPath, html: pageTemplate({ title, description, canonicalPath: urlPath, body, jsonLd }) };
}

function rentalIndexPage(rentals) {
  const urlPath = "/rental/index.html";
  const title = "Аренда на Пхукете: авто, мото, яхты и катамараны | Niko Phuket";
  const description = "Все предложения аренды на Пхукете: авто, мото, яхты и катамараны с подробной информацией.";

  const cards = rentals.map((item) => cardMarkup(item, `/rental/${item.slug}.html`)).join("\n");

  const body = `<nav class="seo-breadcrumbs" aria-label="Хлебные крошки">
      <a href="/index.html">Главная</a>
      <span>/</span>
      <span>Аренда</span>
    </nav>
    <section class="seo-head">
      <h1>Аренда на Пхукете</h1>
      <p>Полный каталог аренды: авто, мото, яхты и катамараны для вашего комфорта на острове.</p>
    </section>
    <section class="seo-grid">${cards}</section>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Аренда на Пхукете",
    description,
    url: `${SITE_URL}${urlPath}`
  };

  return { path: urlPath, html: pageTemplate({ title, description, canonicalPath: urlPath, body, jsonLd }) };
}

function servicesIndexPage(services) {
  const urlPath = "/services/index.html";
  const title = "Дополнительные услуги на Пхукете: Fast Track, Border Run, трансферы | Niko Phuket";
  const description = "Сервисы для удобного отдыха на Пхукете: fast track, border run, трансферы и другие услуги.";

  const cards = services.map((item) => cardMarkup(item, `/services/${item.slug}.html`)).join("\n");

  const body = `<nav class="seo-breadcrumbs" aria-label="Хлебные крошки">
      <a href="/index.html">Главная</a>
      <span>/</span>
      <span>Услуги</span>
    </nav>
    <section class="seo-head">
      <h1>Дополнительные услуги на Пхукете</h1>
      <p>Собрали популярные сервисы, которые чаще всего нужны гостям острова.</p>
    </section>
    <section class="seo-grid">${cards}</section>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Дополнительные услуги на Пхукете",
    description,
    url: `${SITE_URL}${urlPath}`
  };

  return { path: urlPath, html: pageTemplate({ title, description, canonicalPath: urlPath, body, jsonLd }) };
}

function buildSitemap(urlPaths) {
  const now = new Date().toISOString().slice(0, 10);
  const unique = Array.from(new Set(urlPaths));
  const urlsXml = unique
    .map((urlPath) => `  <url>\n    <loc>${SITE_URL}${urlPath}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${urlPath === "/" ? "1.0" : "0.8"}</priority>\n  </url>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>\n`;
}

function main() {
  syncSharedAssets();

  const excursionsData = readJson(path.join(DATA_DIR, "excursions.json"));
  const rentalsData = readJson(path.join(DATA_DIR, "rentals.json"));
  const servicesData = readJson(path.join(DATA_DIR, "services.json"));

  const currency = excursionsData.agency?.currency || "USD";
  const endpoint = excursionsData.emailService?.endpoint || "";
  const excursions = normalizeExcursions(excursionsData.excursions || [], currency);
  const rentals = normalizeRentals(rentalsData.rentals || [], currency);
  const services = normalizeServices(servicesData.services || [], currency);

  ["excursions", "rental", "services"].forEach((folder) => {
    fs.rmSync(path.join(PUBLIC_DIR, folder), { recursive: true, force: true });
  });

  const generated = [];

  excursions.forEach((item) => {
    const page = excursionDetailPage(item, endpoint);
    writeFile(path.join(PUBLIC_DIR, page.path), page.html);
    generated.push(page.path);
  });

  const excursionsByCategory = excursions.reduce((acc, item) => {
    acc[item.category] = acc[item.category] || [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const excursionsIndex = excursionsIndexPage(excursionsByCategory);
  writeFile(path.join(PUBLIC_DIR, excursionsIndex.path), excursionsIndex.html);
  generated.push(excursionsIndex.path);

  rentals.forEach((item) => {
    const page = rentalDetailPage(item, endpoint);
    writeFile(path.join(PUBLIC_DIR, page.path), page.html);
    generated.push(page.path);
  });

  const rentalIndex = rentalIndexPage(rentals);
  writeFile(path.join(PUBLIC_DIR, rentalIndex.path), rentalIndex.html);
  generated.push(rentalIndex.path);

  services.forEach((item) => {
    const page = serviceDetailPage(item);
    writeFile(path.join(PUBLIC_DIR, page.path), page.html);
    generated.push(page.path);
  });

  const servicesIndex = servicesIndexPage(services);
  writeFile(path.join(PUBLIC_DIR, servicesIndex.path), servicesIndex.html);
  generated.push(servicesIndex.path);

  const staticPaths = ["/", "/privacy.html", "/refund-policy.html"];
  const sitemapXml = buildSitemap([...staticPaths, ...generated]);
  writeFile(path.join(ROOT, "sitemap.xml"), sitemapXml);
  writeFile(path.join(PUBLIC_DIR, "sitemap.xml"), sitemapXml);

  console.log(`Generated ${generated.length} SEO pages and updated sitemap.`);
}

main();
