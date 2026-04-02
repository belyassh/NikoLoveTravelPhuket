const state = {
  excursions: [],
  filtered: [],
  rentals: [],
  filteredRentals: [],
  selectedId: "",
  selectedRentalId: "",
  telegramUsername: "",
  currency: "USD",
  emailService: null,
  isExcursionSubmitting: false,
  isRentalSubmitting: false
};

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80";

const refs = {
  cardsGrid: document.querySelector("#cardsGrid"),
  cardTemplate: document.querySelector("#cardTemplate"),
  rentalCardsGrid: document.querySelector("#rentalCardsGrid"),
  rentalCardTemplate: document.querySelector("#rentalCardTemplate"),
  searchInput: document.querySelector("#searchInput"),
  tagFilter: document.querySelector("#tagFilter"),
  rentalSearchInput: document.querySelector("#rentalSearchInput"),
  rentalTagFilter: document.querySelector("#rentalTagFilter"),
  form: document.querySelector("#requestForm"),
  submitButton: document.querySelector('#requestForm button[type="submit"]'),
  rentalForm: document.querySelector("#rentalRequestForm"),
  rentalSubmitButton: document.querySelector('#rentalRequestForm button[type="submit"]'),
  excursionSelect: document.querySelector("#excursionSelect"),
  rentalSelect: document.querySelector("#rentalSelect"),
  peopleInput: document.querySelector("#peopleInput"),
  rentalDurationCount: document.querySelector("#rentalDurationCount"),
  rentalStartDate: document.querySelector("#rentalStartDate"),
  rentalEndDate: document.querySelector("#rentalEndDate"),
  totalPrice: document.querySelector("#totalPrice"),
  rentalTotalPrice: document.querySelector("#rentalTotalPrice"),
  formNote: document.querySelector("#formNote"),
  rentalFormNote: document.querySelector("#rentalFormNote"),
  managerLink: document.querySelector("#managerLink"),
  mainNav: document.querySelector("#mainNav"),
  mobileMenuToggle: document.querySelector("#mobileMenuToggle"),
  mobileMenuClose: document.querySelector("#mobileMenuClose"),
  detailsDialog: document.querySelector("#detailsDialog"),
  detailsContent: document.querySelector("#detailsContent"),
  dialogClose: document.querySelector("#dialogClose"),
  statusDialog: document.querySelector("#statusDialog"),
  statusLoader: document.querySelector("#statusLoader"),
  statusTitle: document.querySelector("#statusTitle"),
  statusText: document.querySelector("#statusText"),
  statusActions: document.querySelector("#statusActions"),
  continueShoppingBtn: document.querySelector("#continueShoppingBtn"),
  gotoFaqBtn: document.querySelector("#gotoFaqBtn")
};

initialize().catch((error) => {
  refs.cardsGrid.innerHTML = '<div class="empty-state">Не удалось загрузить данные экскурсий.</div>';
  refs.rentalCardsGrid.innerHTML = '<div class="empty-state">Не удалось загрузить данные аренды.</div>';
  refs.formNote.textContent = "Ошибка загрузки. Проверьте файлы data/excursions.json и data/rentals.json";
  refs.rentalFormNote.textContent = "Ошибка загрузки. Проверьте файлы data/excursions.json и data/rentals.json";
  console.error(error);
});

async function initialize() {
  const [excursionsResponse, rentalsResponse] = await Promise.all([
    fetch("data/excursions.json"),
    fetch("data/rentals.json")
  ]);

  if (!excursionsResponse.ok) {
    throw new Error(`Ошибка загрузки экскурсий: ${excursionsResponse.status}`);
  }

  if (!rentalsResponse.ok) {
    throw new Error(`Ошибка загрузки аренды: ${rentalsResponse.status}`);
  }

  const excursionsData = await excursionsResponse.json();
  const rentalsData = await rentalsResponse.json();

  state.excursions = excursionsData.excursions ?? [];
  state.filtered = [...state.excursions];
  state.rentals = rentalsData.rentals ?? [];
  state.filteredRentals = [...state.rentals];
  state.currency = excursionsData.agency?.currency ?? "USD";
  state.telegramUsername = normalizeTelegramUsername(excursionsData.telegram?.managerUsername);
  state.emailService = normalizeEmailServiceConfig(excursionsData.emailService);

  setupManagerLink();
  populateTagFilter();
  populateRentalTagFilter();
  populateExcursionSelect();
  populateRentalSelect();
  renderCards(state.filtered);
  renderRentalCards(state.filteredRentals);
  bindEvents();
  enforceHorizontalViewport();
  updateTotalPrice();
  syncRentalRangeConstraints();
  updateRentalTotalPrice();
}

function bindEvents() {
  refs.searchInput.addEventListener("input", applyFilters);
  refs.tagFilter.addEventListener("change", applyFilters);
  refs.rentalSearchInput.addEventListener("input", applyRentalFilters);
  refs.rentalTagFilter.addEventListener("change", applyRentalFilters);
  refs.excursionSelect.addEventListener("change", onSelectFromForm);
  refs.rentalSelect.addEventListener("change", onRentalSelectFromForm);
  refs.peopleInput.addEventListener("input", updateTotalPrice);
  refs.rentalStartDate.addEventListener("change", onRentalDateRangeChange);
  refs.rentalEndDate.addEventListener("change", onRentalDateRangeChange);
  refs.form.addEventListener("submit", onFormSubmit);
  refs.rentalForm.addEventListener("submit", onRentalFormSubmit);
  refs.dialogClose.addEventListener("click", closeDialog);
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

    enforceHorizontalViewport();
  });

  window.addEventListener("scroll", enforceHorizontalViewport, { passive: true });

  window.addEventListener("touchend", () => {
    requestAnimationFrame(enforceHorizontalViewport);
  }, { passive: true });

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

function setupManagerLink() {
  if (state.telegramUsername) {
    refs.managerLink.href = `https://t.me/${state.telegramUsername}`;
    refs.managerLink.textContent = `Менеджер в Telegram: @${state.telegramUsername}`;
    return;
  }

  refs.managerLink.href = "https://t.me/share/url";
  refs.managerLink.textContent = "Открыть Telegram";
}

function populateTagFilter() {
  const tags = [...new Set(state.excursions.flatMap((item) => item.tags || []))].sort();

  for (const tag of tags) {
    const option = document.createElement("option");
    option.value = tag;
    option.textContent = capitalize(tag);
    refs.tagFilter.append(option);
  }
}

function populateExcursionSelect() {
  const fragment = document.createDocumentFragment();

  for (const excursion of state.excursions) {
    const option = document.createElement("option");
    option.value = excursion.id;
    option.textContent = `${excursion.title} (${formatPrice(excursion.price)})`;
    fragment.append(option);
  }

  refs.excursionSelect.append(fragment);
}

function populateRentalTagFilter() {
  const categories = [...new Set(state.rentals.map((item) => item.category).filter(Boolean))].sort();

  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = formatRentalCategory(category);
    refs.rentalTagFilter.append(option);
  }
}

function populateRentalSelect() {
  const fragment = document.createDocumentFragment();

  for (const rental of state.rentals) {
    const option = document.createElement("option");
    option.value = rental.id;
    option.textContent = `${rental.title} (от ${formatPrice(getRentalPrice(rental, "month"))} / месяц • ${formatPrice(getRentalPrice(rental, "week"))} / неделя)`;
    fragment.append(option);
  }

  refs.rentalSelect.append(fragment);
}

function applyFilters() {
  const query = refs.searchInput.value.trim().toLowerCase();
  const tag = refs.tagFilter.value;

  state.filtered = state.excursions.filter((item) => {
    const byTag = tag === "all" || (item.tags || []).includes(tag);
    const searchSource = [item.title, item.overview, ...(item.tags || [])].join(" ").toLowerCase();
    const byQuery = !query || searchSource.includes(query);
    return byTag && byQuery;
  });

  renderCards(state.filtered);
}

function renderCards(items) {
  refs.cardsGrid.innerHTML = "";

  if (!items.length) {
    refs.cardsGrid.innerHTML = '<div class="empty-state">По вашему запросу экскурсии не найдены.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

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

    detailsBtn.addEventListener("click", () => openDetails(item.id));
    selectBtn.addEventListener("click", () => selectExcursion(item.id, true));

    card.style.animationDelay = `${Math.min(320, fragment.childNodes.length * 60)}ms`;
    fragment.append(node);
  }

  refs.cardsGrid.append(fragment);
}

function applyRentalFilters() {
  const query = refs.rentalSearchInput.value.trim().toLowerCase();
  const category = refs.rentalTagFilter.value;

  state.filteredRentals = state.rentals.filter((item) => {
    const byCategory = category === "all" || item.category === category;
    const searchSource = [
      item.title,
      item.overview,
      item.description,
      item.category,
      String(getRentalPrice(item, "day")),
      String(getRentalPrice(item, "week")),
      String(getRentalPrice(item, "month")),
      String(getRentalPrice(item, "year"))
    ].join(" ").toLowerCase();
    const byQuery = !query || searchSource.includes(query);
    return byCategory && byQuery;
  });

  renderRentalCards(state.filteredRentals);
}

function renderRentalCards(items) {
  refs.rentalCardsGrid.innerHTML = "";

  if (!items.length) {
    refs.rentalCardsGrid.innerHTML = '<div class="empty-state">По вашему запросу варианты аренды не найдены.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

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

    detailsBtn.addEventListener("click", () => openRentalDetails(item.id));
    requestBtn.addEventListener("click", () => requestRental(item.id));

    card.style.animationDelay = `${Math.min(320, fragment.childNodes.length * 60)}ms`;
    fragment.append(node);
  }

  refs.rentalCardsGrid.append(fragment);
}

function openRentalDetails(rentalId) {
  const rental = getRentalById(rentalId);
  if (!rental) {
    return;
  }

  const images = getRentalImages(rental);
  let slideIndex = 0;

  refs.detailsContent.innerHTML = `
    <div class="details-layout">
      <div class="slider">
        <img src="${images[0]}" alt="${rental.title}" data-slider-image />
        <button class="slider-control slider-prev" type="button" aria-label="Предыдущее фото">‹</button>
        <button class="slider-control slider-next" type="button" aria-label="Следующее фото">›</button>
      </div>
      <div class="details-body">
        <h3>${rental.title}</h3>
        <p class="details-meta">${rental.overview}</p>
        <p class="details-meta">${rental.description}</p>
        <p><strong>Категория:</strong> ${formatRentalCategory(rental.category)}</p>
        <p><strong>Стоимость:</strong> ${formatRentalPriceSummary(rental)}</p>
        <p><strong>Депозит:</strong> ${rental.deposit || "Уточняется"}</p>
        <p><strong>Коробка / режим:</strong> ${rental.transmission || "Уточняется"}</p>
        <div class="details-lists">
          <div>
            <strong>Что включено</strong>
            <ul>${(rental.included || []).map((point) => `<li>${point}</li>`).join("")}</ul>
          </div>
        </div>
        <button class="btn btn-primary" type="button" data-action="request-rental">Запросить аренду</button>
      </div>
    </div>
  `;

  const sliderImage = refs.detailsContent.querySelector("[data-slider-image]");
  const prevButton = refs.detailsContent.querySelector(".slider-prev");
  const nextButton = refs.detailsContent.querySelector(".slider-next");
  const requestButton = refs.detailsContent.querySelector('[data-action="request-rental"]');

  const updateSlide = (step) => {
    const length = images.length;
    slideIndex = (slideIndex + step + length) % length;
    sliderImage.src = images[slideIndex];
  };

  if (images.length <= 1) {
    prevButton.hidden = true;
    nextButton.hidden = true;
  }

  prevButton.addEventListener("click", () => updateSlide(-1));
  nextButton.addEventListener("click", () => updateSlide(1));
  requestButton.addEventListener("click", () => {
    requestRental(rental.id);
    closeDialog();
  });

  refs.detailsDialog.showModal();
}

async function requestRental(rentalId) {
  const rental = getRentalById(rentalId);
  if (!rental) {
    return;
  }

  selectRental(rental.id, true);
  refs.rentalFormNote.textContent = `Вы выбрали «${rental.title}». Заполните форму и отправьте заявку.`;
}

function onRentalDateRangeChange() {
  syncRentalRangeConstraints();
  updateRentalTotalPrice();
}

function openDetails(excursionId) {
  const excursion = getExcursionById(excursionId);
  if (!excursion) {
    return;
  }

  const images = getExcursionImages(excursion);
  let slideIndex = 0;

  refs.detailsContent.innerHTML = `
    <div class="details-layout">
      <div class="slider">
        <img src="${images[0]}" alt="${excursion.title}" data-slider-image />
        <button class="slider-control slider-prev" type="button" aria-label="Предыдущее фото">‹</button>
        <button class="slider-control slider-next" type="button" aria-label="Следующее фото">›</button>
      </div>
      <div class="details-body">
        <h3>${excursion.title}</h3>
        <p class="details-meta">${excursion.overview}</p>
        <p class="details-meta">${excursion.description}</p>
        <p><strong>Стоимость:</strong> ${formatPrice(excursion.price)} / чел.</p>
        <p>${(excursion.tags || []).map((tag) => `<span class="details-chip">${capitalize(tag)}</span>`).join("")}</p>
        <div class="details-lists">
          <div>
            <strong>Что включено</strong>
            <ul>${(excursion.included || []).map((point) => `<li>${point}</li>`).join("")}</ul>
          </div>
          <div>
            <strong>Что взять с собой</strong>
            <ul>${(excursion.bring || []).map((point) => `<li>${point}</li>`).join("")}</ul>
          </div>
        </div>
        <button class="btn btn-primary" type="button" data-action="choose-from-dialog">Выбрать экскурсию</button>
      </div>
    </div>
  `;

  const sliderImage = refs.detailsContent.querySelector("[data-slider-image]");
  const prevButton = refs.detailsContent.querySelector(".slider-prev");
  const nextButton = refs.detailsContent.querySelector(".slider-next");
  const chooseButton = refs.detailsContent.querySelector('[data-action="choose-from-dialog"]');

  const updateSlide = (step) => {
    const length = images.length;
    slideIndex = (slideIndex + step + length) % length;
    sliderImage.src = images[slideIndex];
  };

  if (images.length <= 1) {
    prevButton.hidden = true;
    nextButton.hidden = true;
  }

  prevButton.addEventListener("click", () => updateSlide(-1));
  nextButton.addEventListener("click", () => updateSlide(1));
  chooseButton.addEventListener("click", () => {
    selectExcursion(excursion.id, true);
    closeDialog();
  });

  refs.detailsDialog.showModal();
}

function closeDialog() {
  refs.detailsDialog.close();
}

function selectExcursion(excursionId, scrollToForm = false) {
  state.selectedId = excursionId;
  refs.excursionSelect.value = excursionId;
  updateTotalPrice();

  if (scrollToForm) {
    document.querySelector("#request").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function onSelectFromForm(event) {
  state.selectedId = event.target.value;
  updateTotalPrice();
}

function onRentalSelectFromForm(event) {
  state.selectedRentalId = event.target.value;
  updateRentalTotalPrice();
}

function updateTotalPrice() {
  const selected = getExcursionById(state.selectedId || refs.excursionSelect.value);
  const count = Math.max(1, Number(refs.peopleInput.value) || 1);

  if (!selected) {
    refs.totalPrice.value = "Выберите экскурсию";
    return;
  }

  const total = selected.price * count;
  refs.totalPrice.value = `${formatPrice(total)} (${count} чел.)`;
}

function updateRentalTotalPrice() {
  const selected = getRentalById(state.selectedRentalId || refs.rentalSelect.value);
  const duration = getRentalDurationInfo();

  if (!selected) {
    setRentalAutoCalculatedState();
    return;
  }

  if (!duration.valid) {
    setRentalAutoCalculatedState();
    return;
  }

  const best = calculateBestRentalCost(selected, duration.count);
  refs.rentalDurationCount.value = `${duration.count} ${pluralizeDays(duration.count)}`;
  refs.rentalTotalPrice.value = `${formatPrice(best.total)} (${formatBundleLabel(best.bundle)})`;
  refs.rentalDurationCount.classList.remove("input-muted");
  refs.rentalTotalPrice.classList.remove("input-muted");
}

async function onFormSubmit(event) {
  event.preventDefault();

  if (!refs.form.checkValidity()) {
    refs.form.reportValidity();
    return;
  }

  const formData = new FormData(refs.form);
  const excursion = getExcursionById(formData.get("excursionId"));

  if (!excursion) {
    refs.formNote.textContent = "Выберите экскурсию из списка.";
    return;
  }

  const peopleCount = Math.max(1, Number(formData.get("peopleCount")) || 1);
  const totalPrice = excursion.price * peopleCount;
  const requestDetails = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    excursionTitle: excursion.title,
    peopleCount,
    totalPrice: formatPrice(totalPrice),
    pickupPoint: formData.get("pickupPoint"),
    desiredDate: formData.get("desiredDate"),
    contact: formData.get("contact"),
    email: formData.get("email")
  };

  const message = [
    "Привет! Я хочу заказать экскурсию, вот детали моей заявки:",
    `Имя и фамилия: ${requestDetails.firstName} ${requestDetails.lastName}`,
    `Экскурсия: ${requestDetails.excursionTitle}`,
    `Количество человек: ${requestDetails.peopleCount}`,
    `Итоговая стоимость: ${requestDetails.totalPrice}`,
    `Отель/точка Google Maps: ${requestDetails.pickupPoint}`,
    `Желаемая дата: ${requestDetails.desiredDate}`,
    `Контакт: ${requestDetails.contact}`,
    `Email: ${requestDetails.email}`
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
        refs.formNote.textContent = "Заявка отправлена. Мы свяжемся с вами в ближайшее время.";
        refs.form.reset();
        refs.peopleInput.value = "1";
        state.selectedId = "";
        updateTotalPrice();
        showStatusDialog({
          title: "Мы приняли вашу заявку",
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
  syncRentalRangeConstraints();

  if (!refs.rentalForm.checkValidity()) {
    refs.rentalForm.reportValidity();
    return;
  }

  const formData = new FormData(refs.rentalForm);
  const rental = getRentalById(formData.get("rentalId"));

  if (!rental) {
    refs.rentalFormNote.textContent = "Выберите вариант аренды из списка.";
    return;
  }

  const duration = getRentalDurationInfo();

  if (!duration.valid) {
    refs.rentalFormNote.textContent = duration.message;
    return;
  }

  const best = calculateBestRentalCost(rental, duration.count);
  const requestDetails = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    rentalTitle: rental.title,
    rentalCategory: formatRentalCategory(rental.category),
    durationCount: duration.count,
    pricingBreakdown: formatBundleLabel(best.bundle),
    dateRange: `${formData.get("startDate")} - ${formData.get("endDate")}`,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    totalPrice: formatPrice(best.total),
    pickupPoint: formData.get("pickupPoint"),
    contact: formData.get("contact"),
    email: formData.get("email")
  };

  const message = [
    "Привет! Я хочу оформить аренду, вот детали моей заявки:",
    `Имя и фамилия: ${requestDetails.firstName} ${requestDetails.lastName}`,
    `Позиция: ${requestDetails.rentalTitle}`,
    `Категория: ${requestDetails.rentalCategory}`,
    `Период аренды: ${requestDetails.durationCount} ${pluralizeDays(requestDetails.durationCount)}`,
    `Диапазон дат: ${requestDetails.dateRange}`,
    `Расчет: ${requestDetails.pricingBreakdown}`,
    `Итоговая стоимость: ${requestDetails.totalPrice}`,
    `Отель/точка подачи: ${requestDetails.pickupPoint}`,
    `Контакт: ${requestDetails.contact}`,
    `Email: ${requestDetails.email}`
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
        state.selectedRentalId = "";
        syncRentalRangeConstraints();
        updateRentalTotalPrice();
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
  refs.submitButton.textContent = isSubmitting ? "Отправляем..." : "Отправить заявку";
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
    payload.append("_subject", `Новая заявка на экскурсию: ${requestDetails.excursionTitle}`);
    payload.append("name", `${requestDetails.firstName} ${requestDetails.lastName}`);
    payload.append("excursion", requestDetails.excursionTitle);
    payload.append("peopleCount", String(requestDetails.peopleCount));
    payload.append("totalPrice", requestDetails.totalPrice);
    payload.append("pickupPoint", requestDetails.pickupPoint);
    payload.append("desiredDate", requestDetails.desiredDate);
    payload.append("contact", requestDetails.contact);
    payload.append("email", requestDetails.email);
    payload.append("_replyto", requestDetails.email);
    payload.append("source", "Vibe Trip website form");
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
    payload.append("_subject", `Новая заявка на аренду: ${requestDetails.rentalTitle}`);
    payload.append("name", `${requestDetails.firstName} ${requestDetails.lastName}`);
    payload.append("rental", requestDetails.rentalTitle);
    payload.append("category", requestDetails.rentalCategory);
    payload.append("durationCount", String(requestDetails.durationCount));
    payload.append("pricingBreakdown", requestDetails.pricingBreakdown);
    payload.append("startDate", requestDetails.startDate);
    payload.append("endDate", requestDetails.endDate);
    payload.append("dateRange", requestDetails.dateRange);
    payload.append("totalPrice", requestDetails.totalPrice);
    payload.append("pickupPoint", requestDetails.pickupPoint);
    payload.append("contact", requestDetails.contact);
    payload.append("email", requestDetails.email);
    payload.append("_replyto", requestDetails.email);
    payload.append("source", "Vibe Trip rental website form");
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

function selectRental(rentalId, scrollToForm = false) {
  state.selectedRentalId = rentalId;
  refs.rentalSelect.value = rentalId;
  updateRentalTotalPrice();

  if (scrollToForm) {
    document.querySelector("#rental-request").scrollIntoView({ behavior: "smooth", block: "start" });
  }
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
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: state.currency,
    maximumFractionDigits: 0
  }).format(value);
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
