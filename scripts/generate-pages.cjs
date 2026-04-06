const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const SITE_URL = "https://nikophuket.com";

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

    <style>
      :root { color-scheme: dark; }
      body {
        min-height: 100vh;
        margin: 0;
        font-family: "Onest", "Segoe UI", sans-serif;
        background: radial-gradient(circle at 20% 20%, #0f3f55, #0b1820 52%);
        color: #f4f8fb;
      }
      a { color: #7be4d6; }
      main { max-width: 1100px; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
      .seo-head { margin-bottom: 1rem; }
      .seo-head h1 { margin: 0 0 0.5rem; }
      .seo-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
      .seo-card { border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 1rem; background: rgba(11,24,32,0.5); }
      .seo-card h2, .seo-card h3 { margin-top: 0; }
      .seo-list { margin: 0.7rem 0 0; padding-left: 1.1rem; }
      .seo-breadcrumbs { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 1rem; }
      .seo-breadcrumbs a { text-decoration: none; }
      .seo-back { margin-top: 1rem; display: inline-block; }
      .muted { opacity: 0.85; }
    </style>
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  </head>
  <body>
    <main>
      ${body}
      <p class="seo-back"><a href="/index.html">Вернуться на главную Niko Phuket</a></p>
    </main>
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
  return `<article class="seo-card">
    <h3><a href="${urlPath}">${escapeHtml(item.title)}</a></h3>
    <p>${escapeHtml(item.overview || item.description || "")}</p>
    <p class="muted">Стоимость: ${escapeHtml(item.priceLabel)}</p>
  </article>`;
}

function excursionDetailPage(item) {
  const urlPath = `/excursions/${item.slug}.html`;
  const title = `${item.title} | Экскурсия на Пхукете | Niko Phuket`;
  const description = item.overview || item.description || `Экскурсия ${item.title} на Пхукете`;

  const body = `<nav class="seo-breadcrumbs" aria-label="Хлебные крошки">
      <a href="/index.html">Главная</a>
      <span>/</span>
      <a href="/excursions/${item.category}.html">${CATEGORY_LABELS[item.category] || "Экскурсии"}</a>
      <span>/</span>
      <span>${escapeHtml(item.title)}</span>
    </nav>
    <section class="seo-head">
      <h1>${escapeHtml(item.title)}</h1>
      <p>${escapeHtml(description)}</p>
      <p><strong>Стоимость:</strong> ${escapeHtml(item.priceLabel)}</p>
    </section>
    <section class="seo-grid">
      <article class="seo-card">
        <h2>Что входит</h2>
        <ul class="seo-list">${(item.included || []).map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
      </article>
      <article class="seo-card">
        <h2>Что взять с собой</h2>
        <ul class="seo-list">${(item.bring || []).map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
      </article>
    </section>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: item.title,
    description,
    touristType: "Туристы на Пхукете",
    offers: {
      "@type": "Offer",
      price: item.price,
      priceCurrency: "USD",
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

function rentalDetailPage(item) {
  const urlPath = `/rental/${item.slug}.html`;
  const title = `${item.title} | Аренда на Пхукете | Niko Phuket`;
  const description = item.overview || item.description || `Аренда ${item.title} на Пхукете`;

  const prices = item.prices || {};
  const body = `<nav class="seo-breadcrumbs" aria-label="Хлебные крошки">
      <a href="/index.html">Главная</a>
      <span>/</span>
      <a href="/rental/index.html">Аренда</a>
      <span>/</span>
      <a href="/rental/${item.group}.html">${CATEGORY_LABELS[item.group] || "Категория аренды"}</a>
      <span>/</span>
      <span>${escapeHtml(item.title)}</span>
    </nav>
    <section class="seo-head">
      <h1>${escapeHtml(item.title)}</h1>
      <p>${escapeHtml(description)}</p>
      <p><strong>Стоимость от:</strong> ${escapeHtml(item.priceLabel)}</p>
      <p><strong>Депозит:</strong> ${escapeHtml(item.deposit || "По запросу")}</p>
    </section>
    <section class="seo-card">
      <h2>Тарифы</h2>
      <ul class="seo-list">
        <li>День: ${escapeHtml(asPrice(prices.day, "", "USD"))}</li>
        <li>Неделя: ${escapeHtml(asPrice(prices.week, "", "USD"))}</li>
        <li>Месяц: ${escapeHtml(asPrice(prices.month, "", "USD"))}</li>
      </ul>
    </section>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.title,
    description,
    offers: {
      "@type": "Offer",
      price: prices.day || undefined,
      priceCurrency: "USD",
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

  const body = `<nav class="seo-breadcrumbs" aria-label="Хлебные крошки">
      <a href="/index.html">Главная</a>
      <span>/</span>
      <a href="/services/index.html">Услуги</a>
      <span>/</span>
      <a href="/services/${item.category}.html">${CATEGORY_LABELS[item.category] || "Другие услуги"}</a>
      <span>/</span>
      <span>${escapeHtml(item.title)}</span>
    </nav>
    <section class="seo-head">
      <h1>${escapeHtml(item.title)}</h1>
      <p>${escapeHtml(description)}</p>
      <p><strong>Стоимость от:</strong> ${escapeHtml(item.priceLabel)}</p>
    </section>
    <section class="seo-card">
      <h2>Описание услуги</h2>
      <p>${escapeHtml(item.description || "")}</p>
    </section>`;

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
      priceCurrency: "USD",
      url: `${SITE_URL}${urlPath}`
    }
  };

  return { path: urlPath, html: pageTemplate({ title, description, canonicalPath: urlPath, body, jsonLd }) };
}

function categoryPage({ sectionPath, slug, title, description, items, itemPathBuilder }) {
  const urlPath = `/${sectionPath}/${slug}.html`;
  const body = `<nav class="seo-breadcrumbs" aria-label="Хлебные крошки">
      <a href="/index.html">Главная</a>
      <span>/</span>
      <span>${escapeHtml(title)}</span>
    </nav>
    <section class="seo-head">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
    </section>
    <section class="seo-grid">
      ${items.map((item) => cardMarkup(item, itemPathBuilder(item))).join("\n")}
    </section>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: `${SITE_URL}${urlPath}`
  };

  return { path: urlPath, html: pageTemplate({ title, description, canonicalPath: urlPath, body, jsonLd }) };
}

function rentalIndexPage(rentalsByGroup) {
  const urlPath = "/rental/index.html";
  const title = "Аренда на Пхукете: авто, мото, яхты и катамараны | Niko Phuket";
  const description = "Отдельная страница аренды на Пхукете: авто/мото и яхты/катамараны с переходом в категории и карточки.";

  const groupCards = Object.entries(rentalsByGroup)
    .map(([group, items]) => {
      const groupTitle = CATEGORY_LABELS[group] || group;
      const groupDescription = group === "auto-moto"
        ? "Аренда автомобиля или скутера для самостоятельных поездок по острову."
        : "Приватные и групповые морские форматы с капитаном.";

      return `<article class="seo-card">
        <h2><a href="/rental/${group}.html">${escapeHtml(groupTitle)}</a></h2>
        <p>${escapeHtml(groupDescription)}</p>
        <p class="muted">Доступно вариантов: ${items.length}</p>
      </article>`;
    })
    .join("\n");

  const body = `<nav class="seo-breadcrumbs" aria-label="Хлебные крошки">
      <a href="/index.html">Главная</a>
      <span>/</span>
      <span>Аренда</span>
    </nav>
    <section class="seo-head">
      <h1>Аренда на Пхукете</h1>
      <p>Выберите направление аренды: авто/мото для поездок по острову или яхты/катамараны для морского отдыха.</p>
    </section>
    <section class="seo-grid">${groupCards}</section>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Аренда на Пхукете",
    description,
    url: `${SITE_URL}${urlPath}`
  };

  return { path: urlPath, html: pageTemplate({ title, description, canonicalPath: urlPath, body, jsonLd }) };
}

function servicesIndexPage(categories) {
  const urlPath = "/services/index.html";
  const title = "Дополнительные услуги на Пхукете: Fast Track, Border Run, трансферы | Niko Phuket";
  const description = "Сервисы для удобного отдыха на Пхукете: fast track, border run, трансферы и другие услуги.";

  const cards = categories.map((category) => `<article class="seo-card">
      <h2><a href="/services/${category.slug}.html">${escapeHtml(category.title)}</a></h2>
      <p>${escapeHtml(category.description)}</p>
    </article>`).join("\n");

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
  const excursionsData = readJson(path.join(DATA_DIR, "excursions.json"));
  const rentalsData = readJson(path.join(DATA_DIR, "rentals.json"));
  const servicesData = readJson(path.join(DATA_DIR, "services.json"));

  const currency = excursionsData.agency?.currency || "USD";
  const excursions = normalizeExcursions(excursionsData.excursions || [], currency);
  const rentals = normalizeRentals(rentalsData.rentals || [], currency);
  const services = normalizeServices(servicesData.services || [], currency);

  ["excursions", "rental", "services"].forEach((folder) => {
    fs.rmSync(path.join(PUBLIC_DIR, folder), { recursive: true, force: true });
  });

  const generated = [];

  excursions.forEach((item) => {
    const page = excursionDetailPage(item);
    writeFile(path.join(PUBLIC_DIR, page.path), page.html);
    generated.push(page.path);
  });

  const excursionsByCategory = excursions.reduce((acc, item) => {
    acc[item.category] = acc[item.category] || [];
    acc[item.category].push(item);
    return acc;
  }, {});

  Object.entries(excursionsByCategory).forEach(([category, items]) => {
    const title = `${CATEGORY_LABELS[category] || "Экскурсии"} на Пхукете | Niko Phuket`;
    const description = `Подборка категории: ${CATEGORY_LABELS[category] || "экскурсии"} на Пхукете с ценами и деталями.`;
    const page = categoryPage({
      sectionPath: "excursions",
      slug: category,
      title,
      description,
      items,
      itemPathBuilder: (item) => `/excursions/${item.slug}.html`
    });

    writeFile(path.join(PUBLIC_DIR, page.path), page.html);
    generated.push(page.path);
  });

  rentals.forEach((item) => {
    const page = rentalDetailPage(item);
    writeFile(path.join(PUBLIC_DIR, page.path), page.html);
    generated.push(page.path);
  });

  const rentalsByGroup = rentals.reduce((acc, item) => {
    acc[item.group] = acc[item.group] || [];
    acc[item.group].push(item);
    return acc;
  }, {});

  const rentalIndex = rentalIndexPage(rentalsByGroup);
  writeFile(path.join(PUBLIC_DIR, rentalIndex.path), rentalIndex.html);
  generated.push(rentalIndex.path);

  Object.entries(rentalsByGroup).forEach(([group, items]) => {
    const title = `${CATEGORY_LABELS[group] || "Аренда"} на Пхукете | Niko Phuket`;
    const description = `Страница категории аренды: ${CATEGORY_LABELS[group] || "аренда"} на Пхукете.`;
    const page = categoryPage({
      sectionPath: "rental",
      slug: group,
      title,
      description,
      items,
      itemPathBuilder: (item) => `/rental/${item.slug}.html`
    });

    writeFile(path.join(PUBLIC_DIR, page.path), page.html);
    generated.push(page.path);
  });

  services.forEach((item) => {
    const page = serviceDetailPage(item);
    writeFile(path.join(PUBLIC_DIR, page.path), page.html);
    generated.push(page.path);
  });

  const servicesByCategory = services.reduce((acc, item) => {
    acc[item.category] = acc[item.category] || [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const serviceCategories = Object.keys(servicesByCategory).map((category) => ({
    slug: category,
    title: `${CATEGORY_LABELS[category] || "Услуги"} на Пхукете`,
    description: `Категория дополнительных услуг: ${CATEGORY_LABELS[category] || category}.`
  }));

  const servicesIndex = servicesIndexPage(serviceCategories);
  writeFile(path.join(PUBLIC_DIR, servicesIndex.path), servicesIndex.html);
  generated.push(servicesIndex.path);

  Object.entries(servicesByCategory).forEach(([category, items]) => {
    const title = `${CATEGORY_LABELS[category] || "Услуги"} на Пхукете | Niko Phuket`;
    const description = `Услуги категории ${CATEGORY_LABELS[category] || category} на Пхукете.`;
    const page = categoryPage({
      sectionPath: "services",
      slug: category,
      title,
      description,
      items,
      itemPathBuilder: (item) => `/services/${item.slug}.html`
    });

    writeFile(path.join(PUBLIC_DIR, page.path), page.html);
    generated.push(page.path);
  });

  const staticPaths = ["/", "/privacy.html", "/refund-policy.html"];
  const sitemapXml = buildSitemap([...staticPaths, ...generated]);
  writeFile(path.join(ROOT, "sitemap.xml"), sitemapXml);
  writeFile(path.join(PUBLIC_DIR, "sitemap.xml"), sitemapXml);

  console.log(`Generated ${generated.length} SEO pages and updated sitemap.`);
}

main();
