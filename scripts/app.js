const state = {
  excursions: [],
  filtered: [],
  rentals: [],
  filteredRentals: [],
  services: [],
  rentalsLoaded: false,
  rentalLoadPromise: null,
  telegramUsername: "",
  currency: "USD",
  emailService: null,
  isExcursionSubmitting: false,
  isRentalSubmitting: false
};

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80";

const INPUT_DEBOUNCE_MS = 120;
const DATA_CACHE_TTL_MS = 5 * 60 * 1000;
const DATA_CACHE_PREFIX = "niko-travel:data:";
const EXCURSIONS_DATA_URL = new URL("../data/excursions.json", import.meta.url).href;
const RENTALS_DATA_URL = new URL("../data/rentals.json", import.meta.url).href;
const SERVICES_DATA_URL = new URL("../data/services.json", import.meta.url).href;

let priceFormatter = null;
let horizontalClampQueued = false;

const refs = {
  cardsGrid: document.querySelector("#cardsGrid"),
  cardTemplate: document.querySelector("#cardTemplate"),
  rentalSection: document.querySelector("#rental"),
  rentalRequestSection: document.querySelector("#rental-request"),
  rentalCardsGrid: document.querySelector("#rentalCardsGrid"),
  rentalCardTemplate: document.querySelector("#rentalCardTemplate"),
  servicesCardsGrid: document.querySelector("#servicesCardsGrid"),
  serviceCardTemplate: document.querySelector("#serviceCardTemplate"),
  searchInput: document.querySelector("#searchInput"),
  tagFilter: document.querySelector("#tagFilter"),
  rentalSearchInput: document.querySelector("#rentalSearchInput"),
  rentalTagFilter: document.querySelector("#rentalTagFilter"),
  servicesSearchInput: document.querySelector("#servicesSearchInput"),
  servicesTagFilter: document.querySelector("#servicesTagFilter"),
  form: document.querySelector("#requestForm"),
  submitButton: document.querySelector('#requestForm button[type="submit"]'),
  rentalForm: document.querySelector("#rentalRequestForm"),
  rentalSubmitButton: document.querySelector('#rentalRequestForm button[type="submit"]'),
  formNote: document.querySelector("#formNote"),
  rentalFormNote: document.querySelector("#rentalFormNote"),
  managerLink: document.querySelector("#managerLink"),
  mainNav: document.querySelector("#mainNav"),
  mobileMenuToggle: document.querySelector("#mobileMenuToggle"),
  mobileMenuClose: document.querySelector("#mobileMenuClose"),
  detailsDialog: document.querySelector("#detailsDialog"),
  detailsContent: document.querySelector("#detailsContent"),
  dialogClose: document.querySelector("#dialogClose"),
  tgFab: document.querySelector("#tgFab"),
  statusDialog: document.querySelector("#statusDialog"),
  statusLoader: document.querySelector("#statusLoader"),
  statusTitle: document.querySelector("#statusTitle"),
  statusText: document.querySelector("#statusText"),
  statusActions: document.querySelector("#statusActions"),
  continueShoppingBtn: document.querySelector("#continueShoppingBtn"),
  gotoFaqBtn: document.querySelector("#gotoFaqBtn")
};

bindNavigationEvents();

initialize().catch((error) => {
  refs.cardsGrid.innerHTML = '<div class="empty-state">Не удалось загрузить данные экскурсий.</div>';
  refs.rentalCardsGrid.innerHTML = '<div class="empty-state">Не удалось загрузить данные аренды.</div>';
  refs.servicesCardsGrid.innerHTML = '<div class="empty-state">Не удалось загрузить данные услуг.</div>';
  refs.formNote.textContent = "Ошибка загрузки. Проверьте файлы data/excursions.json и data/rentals.json";
  refs.rentalFormNote.textContent = "Ошибка загрузки. Проверьте файлы data/excursions.json и data/rentals.json";
  console.error(error);
});

async function initialize() {
  const excursionsData = await loadJsonData(EXCURSIONS_DATA_URL, "экскурсий");

  state.excursions = (excursionsData.excursions ?? []).map((item) => ({
    ...item,
    _searchIndex: buildExcursionSearchIndex(item)
  }));
  state.filtered = [...state.excursions];
  state.currency = excursionsData.agency?.currency ?? "USD";
  priceFormatter = createPriceFormatter(state.currency);
  state.telegramUsername = normalizeTelegramUsername(excursionsData.telegram?.managerUsername);
  state.emailService = normalizeEmailServiceConfig(excursionsData.emailService);

  setupManagerLink();
  populateExcursionTagFilter();
  renderCards(getTopExcursions(state.excursions));
  await loadAndRenderServices();
  populateServicesTagFilter();
  setupDeferredRentalState();
  bindEvents();
  setupRentalLazyLoading();

  // attach global telegram FAB handler
  if (refs.tgFab) {
    refs.tgFab.addEventListener("click", () => {
      const current = state.currentPreviewItem;
      if (current) {
        const text = `${current.title} — ${window.location.origin}${buildExcursionPagePath(current)}`;
        openTelegramShare(text);
        return;
      }

      openTelegramShare(document.title + " — " + window.location.href);
    });
  }

  if (window.location.hash === "#rental" || window.location.hash === "#rental-request") {
    void ensureRentalsLoaded();
  }

  enforceHorizontalViewport();
}

function bindNavigationEvents() {
  refs.mobileMenuToggle.addEventListener("click", openMobileMenu);
  refs.mobileMenuClose.addEventListener("click", closeMobileMenu);

  refs.mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href") || "";
      if (!href.startsWith("#")) {
        closeMobileMenu();
        return;
      }

      const target = document.querySelector(href);
      if (!target) {
        closeMobileMenu();
        return;
      }

      event.preventDefault();
      closeMobileMenu();
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMobileMenu();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) {
      closeMobileMenu();
    }

    queueHorizontalClamp();
  });

  window.addEventListener("scroll", queueHorizontalClamp, { passive: true });

  window.addEventListener("touchend", () => {
    queueHorizontalClamp();
  }, { passive: true });
}

function bindEvents() {
  refs.rentalSearchInput.addEventListener("input", debounce(async () => {
    if (await ensureRentalsLoaded()) {
      applyRentalFilters();
    }
  }, INPUT_DEBOUNCE_MS));
  refs.rentalTagFilter.addEventListener("change", async () => {
    if (await ensureRentalsLoaded()) {
      applyRentalFilters();
    }
  });
  if (refs.searchInput) {
    refs.searchInput.addEventListener("input", debounce(() => {
      applyExcursionFilters();
    }, INPUT_DEBOUNCE_MS));
  }
  if (refs.tagFilter) {
    refs.tagFilter.addEventListener("change", () => {
      applyExcursionFilters();
    });
  }

  if (refs.servicesSearchInput) {
    refs.servicesSearchInput.addEventListener("input", debounce(() => {
      applyServiceFilters();
    }, INPUT_DEBOUNCE_MS));
  }
  if (refs.servicesTagFilter) {
    refs.servicesTagFilter.addEventListener("change", () => {
      applyServiceFilters();
    });
  }
  refs.form.addEventListener("submit", onFormSubmit);
  refs.rentalForm.addEventListener("submit", onRentalFormSubmit);
  refs.dialogClose.addEventListener("click", closeDialog);

  const loadRentalsOnIntent = () => {
    void ensureRentalsLoaded();
  };

  refs.rentalSearchInput.addEventListener("focus", loadRentalsOnIntent, { once: true });
  refs.rentalTagFilter.addEventListener("focus", loadRentalsOnIntent, { once: true });
  refs.rentalForm.addEventListener("pointerdown", loadRentalsOnIntent, { once: true, passive: true });

  refs.detailsDialog.addEventListener("click", (event) => {
    const { target } = event;
    if (target === refs.detailsDialog) {
      closeDialog();
    }
  });

  refs.statusDialog.addEventListener("cancel", (event) => {
    if (isAnySubmitting()) {
      event.preventDefault();
    }
  });

  refs.statusDialog.addEventListener("click", (event) => {
    if (event.target === refs.statusDialog && !isAnySubmitting()) {
      closeStatusDialog();
    }
  });

  refs.continueShoppingBtn.addEventListener("click", () => {
    closeStatusDialog();
    document.querySelector("#catalog").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  refs.gotoFaqBtn.addEventListener("click", () => {
    closeStatusDialog();
    document.querySelector("#faq").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function openMobileMenu() {
  refs.mainNav.classList.add("is-open");
  document.body.style.overflow = "hidden";
  refs.mobileMenuToggle.setAttribute("aria-expanded", "true");
}

function closeMobileMenu() {
  refs.mainNav.classList.remove("is-open");
  document.body.style.overflow = "";
  refs.mobileMenuToggle.setAttribute("aria-expanded", "false");
}

function enforceHorizontalViewport() {
  if (window.scrollX !== 0) {
    window.scrollTo(0, window.scrollY);
  }
}

function queueHorizontalClamp() {
  if (horizontalClampQueued) {
    return;
  }

  horizontalClampQueued = true;
  requestAnimationFrame(() => {
    horizontalClampQueued = false;
    enforceHorizontalViewport();
  });
}

function setupManagerLink() {
  if (state.telegramUsername) {
    refs.managerLink.href = `https://t.me/${state.telegramUsername}`;
    refs.managerLink.textContent = `Менеджер в Telegram: @${state.telegramUsername}`;
    return;
  }

  refs.managerLink.href = "https://t.me/share/url";
  refs.managerLink.textContent = "Открыть Telegram";
}

function populateRentalTagFilter() {
  refs.rentalTagFilter.querySelectorAll('option:not([value="all"])').forEach((option) => option.remove());
  const categories = [...new Set(state.rentals.map((item) => item.category).filter(Boolean))].sort();

  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = formatRentalCategory(category);
    refs.rentalTagFilter.append(option);
  }
}

function populateExcursionTagFilter() {
  if (!refs.tagFilter) return;
  refs.tagFilter.querySelectorAll('option:not([value="all"])').forEach((option) => option.remove());
  const categories = [...new Set(state.excursions.map((item) => item.category).filter(Boolean))].sort();

  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    refs.tagFilter.append(option);
  }
}

function applyExcursionFilters() {
  const query = (refs.searchInput && refs.searchInput.value || "").trim().toLowerCase();
  const category = (refs.tagFilter && refs.tagFilter.value) || "all";

  state.filtered = state.excursions.filter((item) => {
    const byCategory = category === "all" || item.category === category;
    const byQuery = !query || (item._searchIndex || buildExcursionSearchIndex(item)).includes(query);
    return byCategory && byQuery;
  });

  renderCards(state.filtered);
}

function populateServicesTagFilter() {
  if (!refs.servicesTagFilter) return;
  refs.servicesTagFilter.querySelectorAll('option:not([value="all"])').forEach((option) => option.remove());
  const categories = [...new Set(state.services.map((item) => item.category).filter(Boolean))].sort();

  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    refs.servicesTagFilter.append(option);
  }
}

function applyServiceFilters() {
  const query = (refs.servicesSearchInput && refs.servicesSearchInput.value || "").trim().toLowerCase();
  const category = (refs.servicesTagFilter && refs.servicesTagFilter.value) || "all";

  const filtered = state.services.filter((item) => {
    const byCategory = category === "all" || item.category === category;
    const byQuery = !query || (item._searchIndex || buildServiceSearchIndex(item)).includes(query);
    return byCategory && byQuery;
  });

  renderServiceCards(filtered);
}

function openDetailsModal(item, type) {
  if (!refs.detailsContent || !refs.detailsDialog) return;

  // build content
  refs.detailsContent.replaceChildren();

  const images = type === "rental" ? getRentalImages(item) : type === "service" ? (Array.isArray(item.images) ? item.images : [getServiceImage(item)]) : getExcursionImages(item);

  const container = document.createElement("div");
  container.className = "details-inner";

  // slider
  const slider = document.createElement("div");
  slider.className = "slider";
  const img = document.createElement("img");
  img.src = images[0];
  img.alt = item.title;
  slider.appendChild(img);

  // simple prev/next
  if (images.length > 1) {
    let idx = 0;
    const prev = document.createElement("button");
    prev.className = "slider-control slider-prev";
    prev.type = "button";
    prev.textContent = "◀";
    prev.addEventListener("click", () => {
      idx = (idx - 1 + images.length) % images.length;
      img.src = images[idx];
    });

    const next = document.createElement("button");
    next.className = "slider-control slider-next";
    next.type = "button";
    next.textContent = "▶";
    next.addEventListener("click", () => {
      idx = (idx + 1) % images.length;
      img.src = images[idx];
    });

    slider.appendChild(prev);
    slider.appendChild(next);
  }

  const body = document.createElement("div");
  body.className = "details-body";
  const title = document.createElement("h3");
  title.textContent = item.title;
  const desc = document.createElement("p");
  desc.className = "details-meta";
  desc.textContent = item.description || item.overview || "";

  const actions = document.createElement("div");
  actions.className = "status-actions";

  const openFull = document.createElement("button");
  openFull.className = "btn btn-primary";
  openFull.type = "button";
  openFull.textContent = "Открыть подробную страницу";
  openFull.addEventListener("click", () => {
    let path = "/";
    if (type === "excursion") path = buildExcursionPagePath(item);
    if (type === "rental") path = buildRentalPagePath(item);
    if (type === "service") path = buildServicePagePath(item);
    refs.detailsDialog.close();
    window.location.href = path;
  });

  const requestBtn = document.createElement("button");
  requestBtn.className = "btn btn-ghost";
  requestBtn.type = "button";
  requestBtn.textContent = "Запросить";
  requestBtn.addEventListener("click", () => {
    refs.detailsDialog.close();
    if (type === "excursion") window.location.href = `${buildExcursionPagePath(item)}#request`;
    if (type === "rental") window.location.href = `${buildRentalPagePath(item)}#request`;
    if (type === "service") window.location.href = `${buildServicePagePath(item)}#request`;
  });

  actions.appendChild(openFull);
  actions.appendChild(requestBtn);

  body.appendChild(title);
  body.appendChild(desc);
  body.appendChild(actions);

  const detailsLayout = document.createElement("div");
  detailsLayout.className = "details-layout";
  detailsLayout.appendChild(slider);
  detailsLayout.appendChild(body);

  const detailsWrapper = document.createElement("div");
  detailsWrapper.className = "details-content-inner";
  detailsWrapper.appendChild(detailsLayout);

  refs.detailsContent.replaceChildren(detailsWrapper);
  refs.detailsDialog.showModal();
  state.currentPreviewItem = item;
}

function openTelegramShare(prefillText) {
  const text = String(prefillText || "").slice(0, 800);
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`;
  // attempt to open in new window/tab
  window.open(shareUrl, "_blank", "noopener,noreferrer");
}

function getTopExcursions(items) {
  const withRank = items
    .filter((item) => Number.isFinite(Number(item.topRank)) && Number(item.topRank) >= 1 && Number(item.topRank) <= 6)
    .sort((a, b) => Number(a.topRank) - Number(b.topRank));

  if (withRank.length) {
    return withRank.slice(0, 6);
  }

  return [...items].slice(0, 6);
}

function renderCards(items) {
  if (!items.length) {
    refs.cardsGrid.replaceChildren(createEmptyState("По вашему запросу экскурсии не найдены."));
    return;
  }

  const fragment = document.createDocumentFragment();
  let index = 0;

  for (const item of items) {
    const node = refs.cardTemplate.content.cloneNode(true);
    const card = node.querySelector(".tour-card");
    const image = node.querySelector(".tour-card-image");
    const images = getExcursionImages(item);

    image.src = images[0];
    image.alt = item.title;

    node.querySelector(".tour-card-title").textContent = item.title;
    node.querySelector(".tour-card-overview").textContent = item.overview;
    node.querySelector(".tour-card-price").textContent = formatPrice(item.price);

    const detailsBtn = node.querySelector('[data-action="details"]');
    const selectBtn = node.querySelector('[data-action="select"]');
    detailsBtn.addEventListener("click", () => {
      openDetailsModal(item, "excursion");
    });
    selectBtn.addEventListener("click", () => {
      window.location.href = `${buildExcursionPagePath(item)}#request`;
    });

    card.style.animationDelay = `${Math.min(320, index * 60)}ms`;
    index += 1;
    fragment.append(node);
  }

  refs.cardsGrid.replaceChildren(fragment);
}

function applyRentalFilters() {
  if (!state.rentalsLoaded) {
    return;
  }

  const query = refs.rentalSearchInput.value.trim().toLowerCase();
  const category = refs.rentalTagFilter.value;

  state.filteredRentals = state.rentals.filter((item) => {
    const byCategory = category === "all" || item.category === category;
    const byQuery = !query || item._searchIndex.includes(query);
    return byCategory && byQuery;
  });

  renderRentalCards(state.filteredRentals);
}

function renderRentalCards(items) {
  if (!items.length) {
    refs.rentalCardsGrid.replaceChildren(createEmptyState("По вашему запросу варианты аренды не найдены."));
    return;
  }

  const fragment = document.createDocumentFragment();
  let index = 0;

  for (const item of items) {
    const node = refs.rentalCardTemplate.content.cloneNode(true);
    const card = node.querySelector(".rental-card");
    const image = node.querySelector(".tour-card-image");
    const images = getRentalImages(item);

    image.src = images[0];
    image.alt = item.title;

    node.querySelector(".tour-card-title").textContent = item.title;
    node.querySelector(".tour-card-overview").textContent = item.overview;
    node.querySelector(".rental-card-meta").textContent = `${formatRentalCategory(item.category)} • ${item.transmission}`;
    node.querySelector(".tour-card-price").textContent = `От ${formatPrice(getRentalPrice(item, "day"))} / день`;

    const detailsBtn = node.querySelector('[data-action="details"]');
    const requestBtn = node.querySelector('[data-action="request"]');

    detailsBtn.addEventListener("click", () => {
      openDetailsModal(item, "rental");
    });
    requestBtn.addEventListener("click", () => {
      window.location.href = `${buildRentalPagePath(item)}#request`;
    });

    card.style.animationDelay = `${Math.min(320, index * 60)}ms`;
    index += 1;
    fragment.append(node);
  }

  refs.rentalCardsGrid.replaceChildren(fragment);
}

function renderServiceCards(items) {
  if (!items.length) {
    refs.servicesCardsGrid.replaceChildren(createEmptyState("Список услуг скоро появится."));
    return;
  }

  const fragment = document.createDocumentFragment();
  let index = 0;

  for (const item of items) {
    const node = refs.serviceCardTemplate.content.cloneNode(true);
    const card = node.querySelector(".service-card");
    const image = node.querySelector(".tour-card-image");

    image.src = getServiceImage(item);
    image.alt = item.title;

    node.querySelector(".tour-card-title").textContent = item.title;
    node.querySelector(".tour-card-overview").textContent = item.overview || item.description || "";
    node.querySelector(".rental-card-meta").textContent = formatServiceCategory(item.category);
    node.querySelector(".tour-card-price").textContent = `От ${formatPrice(item.priceFrom || 0)}${item.unit ? ` ${item.unit}` : ""}`;

    const detailsBtn = node.querySelector('[data-action="details"]');
    const requestBtn = node.querySelector('[data-action="request"]');

    detailsBtn.addEventListener("click", () => {
      openDetailsModal(item, "service");
    });
    requestBtn.addEventListener("click", () => {
      window.location.href = `${buildServicePagePath(item)}#request`;
    });

    card.style.animationDelay = `${Math.min(320, index * 60)}ms`;
    index += 1;
    fragment.append(node);
  }

  refs.servicesCardsGrid.replaceChildren(fragment);
}

function closeDialog() {
  refs.detailsDialog.close();
}

async function onFormSubmit(event) {
  event.preventDefault();

  if (!refs.form.checkValidity()) {
    refs.form.reportValidity();
    return;
  }

  const formData = new FormData(refs.form);
  const requestDetails = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    hotel: formData.get("hotel"),
    telegramNick: formData.get("telegramNick"),
    adultsCount: Math.max(1, Number(formData.get("adultsCount")) || 1),
    childrenCount: Math.max(0, Number(formData.get("childrenCount")) || 0),
    vacationStart: formData.get("vacationStart"),
    vacationEnd: formData.get("vacationEnd")
  };

  if (requestDetails.vacationEnd < requestDetails.vacationStart) {
    refs.formNote.textContent = "Проверьте даты отдыха: дата окончания не может быть раньше даты начала.";
    return;
  }

  const message = [
    "Привет! Я хочу оставить заявку на подбор экскурсии, вот мои данные:",
    `Имя и фамилия: ${requestDetails.firstName} ${requestDetails.lastName}`,
    `Телефон: ${requestDetails.phone}`,
    `Отель: ${requestDetails.hotel}`,
    `Telegram: ${requestDetails.telegramNick}`,
    `Взрослые: ${requestDetails.adultsCount}`,
    `Дети: ${requestDetails.childrenCount}`,
    `Даты отдыха: ${requestDetails.vacationStart} - ${requestDetails.vacationEnd}`
  ].join("\n");

  setExcursionSubmittingState(true);
  showStatusDialog({
    title: "Отправляем запрос...",
    text: "Пожалуйста, подождите.",
    mode: "loading"
  });

  try {
    if (state.emailService?.endpoint) {
      const result = await sendRequestViaEmailService(requestDetails, message);

      if (result.ok) {
        refs.formNote.textContent = "Заявка на подбор отправлена. Мы свяжемся с вами в ближайшее время.";
        refs.form.reset();
        showStatusDialog({
          title: "Мы приняли вашу заявку на подбор",
          text: "Менеджер свяжется с вами в ближайшее время.",
          mode: "success"
        });
        return;
      }

      refs.formNote.textContent = result.error || "Не удалось отправить заявку на email. Открываем Telegram как резервный канал.";
    }

    const telegramUrl = buildTelegramRequestUrl();
    window.open(telegramUrl, "_blank", "noopener,noreferrer");

    if (state.telegramUsername) {
      const copied = await copyToClipboard(message);
      refs.formNote.textContent = copied
        ? `Открыт чат @${state.telegramUsername}. Текст заявки скопирован, вставьте его в диалог.`
        : `Открыт чат @${state.telegramUsername}. Скопируйте текст заявки вручную и отправьте менеджеру.`;
    } else {
      refs.formNote.textContent = "Открываем Telegram с готовым текстом заявки...";
    }

    showStatusDialog({
      title: "Нужна отправка через Telegram",
      text: "Мы открыли резервный канал. Завершите отправку заявки в Telegram.",
      mode: "fallback"
    });
  } finally {
    setExcursionSubmittingState(false);
  }
}

async function onRentalFormSubmit(event) {
  event.preventDefault();

  if (!refs.rentalForm.checkValidity()) {
    refs.rentalForm.reportValidity();
    return;
  }

  const formData = new FormData(refs.rentalForm);
  const requestDetails = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    hotel: formData.get("hotel"),
    telegramNick: formData.get("telegramNick"),
    rentalDuration: formData.get("rentalDuration")
  };

  const message = [
    "Привет! Я хочу оставить заявку на аренду, вот мои данные:",
    `Имя и фамилия: ${requestDetails.firstName} ${requestDetails.lastName}`,
    `Телефон: ${requestDetails.phone}`,
    `Отель: ${requestDetails.hotel}`,
    `Telegram: ${requestDetails.telegramNick}`,
    `Желаемая длительность аренды: ${requestDetails.rentalDuration}`
  ].join("\n");

  setRentalSubmittingState(true);
  showStatusDialog({
    title: "Отправляем запрос...",
    text: "Пожалуйста, подождите.",
    mode: "loading"
  });

  try {
    if (state.emailService?.endpoint) {
      const result = await sendRentalRequestViaEmailService(requestDetails, message);

      if (result.ok) {
        refs.rentalFormNote.textContent = "Заявка на аренду отправлена. Мы свяжемся с вами в ближайшее время.";
        refs.rentalForm.reset();
        showStatusDialog({
          title: "Мы приняли вашу заявку",
          text: "Менеджер свяжется с вами в ближайшее время.",
          mode: "success"
        });
        return;
      }

      refs.rentalFormNote.textContent = result.error || "Не удалось отправить заявку на email. Открываем Telegram как резервный канал.";
    }

    const telegramUrl = buildTelegramRequestUrl();
    window.open(telegramUrl, "_blank", "noopener,noreferrer");

    if (state.telegramUsername) {
      const copied = await copyToClipboard(message);
      refs.rentalFormNote.textContent = copied
        ? `Открыт чат @${state.telegramUsername}. Текст заявки скопирован, вставьте его в диалог.`
        : `Открыт чат @${state.telegramUsername}. Скопируйте текст заявки вручную и отправьте менеджеру.`;
    } else {
      refs.rentalFormNote.textContent = "Открываем Telegram с готовым текстом заявки...";
    }

    showStatusDialog({
      title: "Нужна отправка через Telegram",
      text: "Мы открыли резервный канал. Завершите отправку заявки в Telegram.",
      mode: "fallback"
    });
  } finally {
    setRentalSubmittingState(false);
  }
}

function setExcursionSubmittingState(isSubmitting) {
  state.isExcursionSubmitting = isSubmitting;
  refs.submitButton.disabled = isSubmitting;
  refs.submitButton.textContent = isSubmitting ? "Отправляем..." : "Отправить заявку на подбор";
}

function setRentalSubmittingState(isSubmitting) {
  state.isRentalSubmitting = isSubmitting;
  refs.rentalSubmitButton.disabled = isSubmitting;
  refs.rentalSubmitButton.textContent = isSubmitting ? "Отправляем..." : "Отправить заявку на аренду";
}

function isAnySubmitting() {
  return state.isExcursionSubmitting || state.isRentalSubmitting;
}

function showStatusDialog({ title, text, mode }) {
  refs.statusTitle.textContent = title;
  refs.statusText.textContent = text;

  const isLoading = mode === "loading";
  refs.statusLoader.hidden = !isLoading;
  refs.statusActions.hidden = mode !== "success";

  if (!refs.statusDialog.open) {
    refs.statusDialog.showModal();
  }
}

function closeStatusDialog() {
  if (refs.statusDialog.open) {
    refs.statusDialog.close();
  }
}

async function sendRequestViaEmailService(requestDetails, message) {
  try {
    const payload = new FormData();
    payload.append("_subject", "Новая заявка на подбор экскурсии");
    payload.append("name", `${requestDetails.firstName} ${requestDetails.lastName}`);
    payload.append("phone", requestDetails.phone);
    payload.append("hotel", requestDetails.hotel);
    payload.append("telegramNick", requestDetails.telegramNick);
    payload.append("adultsCount", String(requestDetails.adultsCount));
    payload.append("childrenCount", String(requestDetails.childrenCount));
    payload.append("vacationStart", requestDetails.vacationStart);
    payload.append("vacationEnd", requestDetails.vacationEnd);
    payload.append("leadType", "Заявка на подбор экскурсии");
    payload.append("source", "Niko Travel selection request form");
    payload.append("submittedAt", new Date().toISOString());
    payload.append("message", message);

    const response = await fetch(state.emailService.endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json"
      },
      body: payload
    });

    const responseData = await response.json().catch(() => null);

    if (response.ok) {
      return { ok: true, error: "" };
    }

    const apiError = extractEmailServiceError(responseData);
    console.error("Email service error", response.status, responseData);
    return { ok: false, error: apiError || "Сервис email отклонил заявку." };
  } catch (error) {
    console.error("Email service unavailable", error);
    return { ok: false, error: "Сервис email временно недоступен." };
  }
}

async function sendRentalRequestViaEmailService(requestDetails, message) {
  try {
    const payload = new FormData();
    payload.append("_subject", "Новая заявка на аренду");
    payload.append("name", `${requestDetails.firstName} ${requestDetails.lastName}`);
    payload.append("phone", requestDetails.phone);
    payload.append("hotel", requestDetails.hotel);
    payload.append("telegramNick", requestDetails.telegramNick);
    payload.append("rentalDuration", requestDetails.rentalDuration);
    payload.append("leadType", "Заявка на аренду");
    payload.append("source", "Niko Travel rental request form");
    payload.append("submittedAt", new Date().toISOString());
    payload.append("message", message);

    const response = await fetch(state.emailService.endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json"
      },
      body: payload
    });

    const responseData = await response.json().catch(() => null);

    if (response.ok) {
      return { ok: true, error: "" };
    }

    const apiError = extractEmailServiceError(responseData);
    console.error("Email service error", response.status, responseData);
    return { ok: false, error: apiError || "Сервис email отклонил заявку." };
  } catch (error) {
    console.error("Email service unavailable", error);
    return { ok: false, error: "Сервис email временно недоступен." };
  }
}

function extractEmailServiceError(responseData) {
  if (!responseData || typeof responseData !== "object") {
    return "";
  }

  if (Array.isArray(responseData.errors) && responseData.errors.length) {
    return responseData.errors.map((item) => item.message).filter(Boolean).join(" ");
  }

  return typeof responseData.error === "string" ? responseData.error : "";
}

function normalizeEmailServiceConfig(config) {
  if (!config || typeof config !== "object") {
    return null;
  }

  const endpoint = String(config.endpoint || "").trim();
  if (!endpoint) {
    return null;
  }

  return { endpoint };
}

function buildTelegramRequestUrl() {
  if (state.telegramUsername) {
    return `https://t.me/${state.telegramUsername}`;
  }

  return "https://t.me/share/url";
}

function normalizeTelegramUsername(value) {
  if (!value) {
    return "";
  }

  let normalized = String(value).trim();
  normalized = normalized.replace(/^https?:\/\//i, "");
  normalized = normalized.replace(/^t\.me\//i, "");
  normalized = normalized.replace(/^@+/, "");
  normalized = normalized.split(/[/?#]/)[0];

  return normalized;
}

async function copyToClipboard(text) {
  if (!navigator.clipboard || !window.isSecureContext) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function getExcursionById(excursionId) {
  return state.excursions.find((item) => item.id === excursionId);
}

function getRentalById(rentalId) {
  return state.rentals.find((item) => item.id === rentalId);
}

function buildServicePagePath(service) {
  const slug = service?.slug || service?.id;
  return `/services/${slug}.html`;
}

function buildExcursionPagePath(excursion) {
  const slug = excursion?.slug || excursion?.id;
  return `/excursions/${slug}.html`;
}

function buildRentalPagePath(rental) {
  const slug = rental?.slug || rental?.id;
  return `/rental/${slug}.html`;
}

function syncRentalRangeConstraints() {
  const today = new Date().toISOString().slice(0, 10);
  refs.rentalStartDate.min = today;

  const startDate = refs.rentalStartDate.value;
  if (startDate) {
    refs.rentalEndDate.min = startDate;
  } else {
    refs.rentalEndDate.min = today;
  }

  if (refs.rentalStartDate.value && refs.rentalEndDate.value && refs.rentalEndDate.value < refs.rentalStartDate.value) {
    refs.rentalEndDate.setCustomValidity("Дата окончания не может быть раньше даты начала.");
  } else {
    refs.rentalEndDate.setCustomValidity("");
  }
}

function getRentalDurationInfo() {
  const startDate = refs.rentalStartDate.value;
  const endDate = refs.rentalEndDate.value;

  if (!startDate || !endDate) {
    return {
      valid: false,
      count: 0,
      message: "Выберите диапазон дат"
    };
  }

  if (endDate < startDate) {
    return {
      valid: false,
      count: 0,
      message: "Проверьте диапазон дат"
    };
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const days = Math.max(1, Math.floor((end - start) / 86400000) + 1);

  return { valid: true, count: days, message: "" };
}

function getExcursionImages(excursion) {
  const images = Array.isArray(excursion?.images)
    ? excursion.images.filter((url) => typeof url === "string" && url.trim())
    : [];

  return images.length ? images : [FALLBACK_IMAGE];
}

function getRentalImages(rental) {
  const images = Array.isArray(rental?.images)
    ? rental.images.filter((url) => typeof url === "string" && url.trim())
    : [];

  return images.length ? images : [FALLBACK_IMAGE];
}

function getServiceImage(service) {
  const images = Array.isArray(service?.images)
    ? service.images.filter((url) => typeof url === "string" && url.trim())
    : [];

  return images[0] || FALLBACK_IMAGE;
}

function getRentalPrice(rental, durationUnit) {
  const prices = rental?.prices || {};

  if (durationUnit === "week") {
    return Number(prices.week) || 0;
  }

  if (durationUnit === "month") {
    return Number(prices.month) || 0;
  }

  if (durationUnit === "year") {
    return Number(prices.year) || 0;
  }

  return Number(prices.day) || 0;
}

function formatRentalPriceSummary(rental) {
  return `${formatPrice(getRentalPrice(rental, "day"))} / день • ${formatPrice(getRentalPrice(rental, "week"))} / неделя • ${formatPrice(getRentalPrice(rental, "month"))} / месяц • ${formatPrice(getRentalPrice(rental, "year"))} / год`;
}

function formatPrice(value) {
  if (!priceFormatter) {
    priceFormatter = createPriceFormatter(state.currency);
  }

  return priceFormatter.format(value);
}

function createPriceFormatter(currency) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  });
}

function buildExcursionSearchIndex(item) {
  return [item.title, item.overview, ...(item.tags || [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildRentalSearchIndex(item) {
  return [
    item.title,
    item.overview,
    item.description,
    item.category,
    String(getRentalPrice(item, "day")),
    String(getRentalPrice(item, "week")),
    String(getRentalPrice(item, "month")),
    String(getRentalPrice(item, "year"))
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function createEmptyState(text) {
  const node = document.createElement("div");
  node.className = "empty-state";
  node.textContent = text;
  return node;
}

function debounce(fn, wait) {
  let timeoutId;

  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), wait);
  };
}

function setupDeferredRentalState() {
  refs.rentalCardsGrid.classList.add("is-pending");
  refs.rentalCardsGrid.replaceChildren(createEmptyState("Загружаем варианты аренды..."));
  setRentalControlsEnabled(false);
}

async function loadAndRenderServices() {
  try {
    const servicesData = await loadJsonData(SERVICES_DATA_URL, "услуг");
    state.services = (servicesData.services ?? []).map((item) => ({ ...item, _searchIndex: buildServiceSearchIndex(item) }));
    renderServiceCards(state.services);
  } catch (error) {
    refs.servicesCardsGrid.replaceChildren(createEmptyState("Не удалось загрузить данные услуг."));
    console.error(error);
  }
}

function setRentalControlsEnabled(isEnabled) {
  refs.rentalSearchInput.disabled = !isEnabled;
  refs.rentalTagFilter.disabled = !isEnabled;
}

function setupRentalLazyLoading() {
  if (!("IntersectionObserver" in window)) {
    void ensureRentalsLoaded();
    return;
  }

  const targets = [refs.rentalSection, refs.rentalRequestSection].filter(Boolean);
  if (!targets.length) {
    void ensureRentalsLoaded();
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) {
      return;
    }

    observer.disconnect();
    void ensureRentalsLoaded();
  }, {
    rootMargin: "300px 0px"
  });

  targets.forEach((target) => observer.observe(target));
}

function applyRentalsData(rentalsData) {
  state.rentals = (rentalsData.rentals ?? []).map((item) => ({
    ...item,
    _searchIndex: buildRentalSearchIndex(item)
  }));
  state.filteredRentals = [...state.rentals];
  populateRentalTagFilter();
  refs.rentalCardsGrid.classList.remove("is-pending");
  renderRentalCards(state.filteredRentals);
  setRentalControlsEnabled(true);
}

async function ensureRentalsLoaded() {
  if (state.rentalsLoaded) {
    return true;
  }

  if (state.rentalLoadPromise) {
    return state.rentalLoadPromise;
  }

  state.rentalLoadPromise = (async () => {
    try {
      const rentalsData = await loadJsonData(RENTALS_DATA_URL, "аренды");
      applyRentalsData(rentalsData);
      state.rentalsLoaded = true;
      return true;
    } catch (error) {
      refs.rentalCardsGrid.classList.remove("is-pending");
      refs.rentalCardsGrid.replaceChildren(createEmptyState("Не удалось загрузить данные аренды."));
      refs.rentalFormNote.textContent = "Ошибка загрузки данных аренды.";
      console.error(error);
      return false;
    } finally {
      state.rentalLoadPromise = null;
    }
  })();

  return state.rentalLoadPromise;
}

async function loadJsonData(url, label) {
  const cacheKey = `${DATA_CACHE_PREFIX}${url}`;
  const cached = readCachedJson(cacheKey);
  const isFresh = cached && Date.now() - cached.timestamp <= DATA_CACHE_TTL_MS;

  if (isFresh) {
    return cached.payload;
  }

  try {
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Ошибка загрузки ${label}: ${response.status}`);
    }

    const payload = await response.json();
    writeCachedJson(cacheKey, payload);
    return payload;
  } catch (error) {
    if (cached) {
      return cached.payload;
    }

    throw error;
  }
}

function readCachedJson(cacheKey) {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    if (!Number.isFinite(parsed.timestamp) || !("payload" in parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeCachedJson(cacheKey, payload) {
  try {
    localStorage.setItem(cacheKey, JSON.stringify({
      timestamp: Date.now(),
      payload
    }));
  } catch {
    // Ignore quota and private mode failures to keep UX unaffected.
  }
}

function capitalize(value) {
  if (!value) {
    return "";
  }
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function formatRentalCategory(category) {
  const labels = {
    moto: "Мото",
    auto: "Авто",
    "yachts-catamarans": "Яхты и катамараны"
  };

  return labels[category] || capitalize(category);
}

function formatServiceCategory(category) {
  const labels = {
    "fast-track": "Fast Track",
    "border-run": "Border Run",
    transfer: "Трансферы"
  };

  return labels[category] || capitalize(category);
}

function calculateBestRentalCost(rental, totalDays) {
  const units = [
    { key: "year", days: 365 },
    { key: "month", days: 30 },
    { key: "week", days: 7 },
    { key: "day", days: 1 }
  ];

  const dp = Array(totalDays + 1).fill(Infinity);
  const pick = Array(totalDays + 1).fill(null);
  dp[0] = 0;

  for (let d = 1; d <= totalDays; d += 1) {
    for (const unit of units) {
      if (d < unit.days) {
        continue;
      }

      const price = getRentalPrice(rental, unit.key);
      if (!price || !Number.isFinite(price)) {
        continue;
      }

      const prev = dp[d - unit.days];
      if (!Number.isFinite(prev)) {
        continue;
      }

      const candidate = prev + price;
      if (candidate < dp[d]) {
        dp[d] = candidate;
        pick[d] = unit.key;
      }
    }
  }

  if (!Number.isFinite(dp[totalDays])) {
    return {
      total: getRentalPrice(rental, "day") * totalDays,
      bundle: { day: totalDays, week: 0, month: 0, year: 0 }
    };
  }

  const bundle = { day: 0, week: 0, month: 0, year: 0 };
  let cursor = totalDays;

  while (cursor > 0) {
    const key = pick[cursor] || "day";
    const unitDays = key === "year" ? 365 : key === "month" ? 30 : key === "week" ? 7 : 1;
    bundle[key] += 1;
    cursor -= unitDays;
  }

  return {
    total: dp[totalDays],
    bundle
  };
}

function formatBundleLabel(bundle) {
  const parts = [];

  if (bundle.year) {
    parts.push(`${bundle.year} ${bundle.year === 1 ? "год" : "года"}`);
  }

  if (bundle.month) {
    parts.push(`${bundle.month} ${bundle.month === 1 ? "месяц" : "мес."}`);
  }

  if (bundle.week) {
    parts.push(`${bundle.week} ${bundle.week === 1 ? "неделя" : "нед."}`);
  }

  if (bundle.day) {
    parts.push(`${bundle.day} ${pluralizeDays(bundle.day)}`);
  }

  return parts.length ? parts.join(" + ") : "0 дней";
}

function pluralizeDays(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return "день";
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "дня";
  }

  return "дней";
}

function setRentalAutoCalculatedState() {
  refs.rentalDurationCount.value = "Рассчитывается автоматически";
  refs.rentalTotalPrice.value = "Рассчитывается автоматически";
  refs.rentalDurationCount.classList.add("input-muted");
  refs.rentalTotalPrice.classList.add("input-muted");
}
