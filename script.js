/*
  Конвертер валют і одиниць виміру — клієнтський скрипт
  Практикум 9: клієнт для відомого API (fetch/AJAX)
*/

/* ===== Налаштування запиту ===== */

// Курси беремо з відкритого API Frankfurter, джерело даних — Національний банк України
const API_URL = 'https://api.frankfurter.dev/v2/providers/nbu/rates';

// Валюти, які показує застосунок (у відповіді їх значно більше)
const CURRENCIES = ['USD', 'EUR', 'UAH'];

/* ===== Дані ===== */

// Резервні курси: показуються, доки триває запит або якщо API недоступний
let rates = { EUR: 1, USD: 1.11, UAH: 50.5 };

// Поріг, вище якого курс позначається класом big-rate
const BIG_RATE = 10;

// Історія виконаних конвертацій
const history = [];

/* ===== Елементи сторінки ===== */

const ratesList = document.querySelector('#rates-list');
const ratesCount = document.querySelector('#rates-count');
const ratesStatus = document.querySelector('#rates-status');
const ratesError = document.querySelector('#rates-error');
const reloadButton = document.querySelector('#reload-rates');

const form = document.querySelector('#converter-form');
const amountInput = document.querySelector('#amount');
const unitFrom = document.querySelector('#unit-from');
const unitTo = document.querySelector('#unit-to');
const swapButton = document.querySelector('#swap-units');

const resultValue = document.querySelector('#result-value');
const historyList = document.querySelector('#history-list');
const historyEmpty = document.querySelector('#history-empty');

const EMPTY_RESULT = 'Результат конвертації з\'явиться після введення значення.';

/* ===== Функції ===== */

// Округлює число до двох знаків після коми
const round2 = (value) => Math.round(value * 100) / 100;

// Переводить суму за заданим курсом
const convert = (amount, rate) => amount * rate;

// Переводить суму з однієї валюти в іншу через курс до базової
function convertCurrency(amount, from, to) {
  const inUsd = amount / rates[from];
  return convert(inUsd, rates[to]);
}

// Показує або ховає ознаку завантаження
function showLoading(isLoading) {
  ratesStatus.hidden = !isLoading;
  reloadButton.disabled = isLoading;
}

// Виводить зрозуміле повідомлення про помилку окремим елементом
function showError(message) {
  ratesError.textContent = message;
  ratesError.hidden = false;
}

// Ховає попереднє повідомлення про помилку
function hideError() {
  ratesError.hidden = true;
}

// Будує список курсів у контейнері #rates-list
function renderRates(ratesObject) {
  ratesList.innerHTML = '';

  for (const [code, rate] of Object.entries(ratesObject)) {
    const item = document.createElement('li');

    item.textContent = `${code}: ${round2(rate)}`;
    item.classList.add('rate-item');
    item.dataset.rate = rate;

    // Курс вище порогу позначаємо окремим класом
    if (rate > BIG_RATE) {
      item.classList.add('big-rate');
    }

    ratesList.append(item);
  }
}

// Оновлює підсумковий рядок під списком курсів
function updateRatesCount(ratesObject, date) {
  const total = Object.keys(ratesObject).length;

  ratesCount.textContent = date
    ? `Валют у списку: ${total} · дані за ${date}`
    : `Валют у списку: ${total}`;
}

// Перераховує поточне значення форми й оновлює блок результату
function showResult() {
  const amount = Number(amountInput.value);
  const from = unitFrom.value.toUpperCase();
  const to = unitTo.value.toUpperCase();

  if (amountInput.value === '' || amount <= 0) {
    resultValue.textContent = EMPTY_RESULT;
    return;
  }

  resultValue.textContent = `${amount} ${from} = ${round2(convertCurrency(amount, from, to))} ${to}`;
}

// Будує список історії конвертацій
function renderHistory(items) {
  historyList.innerHTML = '';

  for (const item of items) {
    const entry = document.createElement('li');

    entry.textContent = `${item.amount} ${item.from} = ${item.result} ${item.to}`;
    entry.classList.add('history-item');
    entry.dataset.result = item.result;

    historyList.append(entry);
  }

  historyEmpty.hidden = items.length > 0;
}

// Завантажує актуальні курси валют з API Frankfurter (https://frankfurter.dev)
async function loadRates() {
  showLoading(true);
  hideError();

  try {
    const response = await fetch(API_URL);

    // fetch не вважає 404 чи 422 помилкою, тому статус перевіряємо вручну
    if (!response.ok) {
      if (response.status === 422) {
        throw new Error('Перевірте код валюти: сервер не підтримує одну з них.');
      }

      throw new Error(`Сервер відповів кодом ${response.status}.`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Сервер повернув порожній перелік курсів.');
    }

    // Відповідь — масив записів { date, base, quote, rate }, тому збираємо з них об'єкт курсів
    const loaded = {};
    const base = data[0].base;
    const date = data[0].date;

    // Базова валюта у відповідь не входить — її курс до себе завжди 1
    loaded[base] = 1;

    for (const entry of data) {
      if (CURRENCIES.includes(entry.quote)) {
        loaded[entry.quote] = entry.rate;
      }
    }

    rates = loaded;

    renderRates(rates);
    updateRatesCount(rates, date);
    showResult();
  } catch (error) {
    // Мережевий збій fetch повертає як TypeError — для нього окреме повідомлення
    const message = error instanceof TypeError
      ? 'Немає з\'єднання з мережею. Показано збережені курси.'
      : error.message;

    showError(message);
    console.error(error);
  } finally {
    showLoading(false);
  }
}

/* ===== Обробники подій ===== */

// Власна перевірка суми під час введення
amountInput.addEventListener('input', () => {
  if (amountInput.value !== '' && Number(amountInput.value) <= 0) {
    amountInput.setCustomValidity('Сума має бути додатною');
  } else {
    amountInput.setCustomValidity('');
  }

  showResult();
});

// Зміна одиниці миттєво перераховує результат без надсилання форми
unitFrom.addEventListener('change', showResult);
unitTo.addEventListener('change', showResult);

// Кнопка обміну міняє одиниці місцями
swapButton.addEventListener('click', () => {
  const current = unitFrom.value;

  unitFrom.value = unitTo.value;
  unitTo.value = current;

  showResult();
});

// Кнопка «Оновити курси» повторює запит без перезавантаження сторінки
reloadButton.addEventListener('click', loadRates);

// Надсилання форми додає запис до історії конвертацій
form.addEventListener('submit', (event) => {
  event.preventDefault();

  const amount = Number(amountInput.value);
  const from = unitFrom.value.toUpperCase();
  const to = unitTo.value.toUpperCase();
  const result = round2(convertCurrency(amount, from, to));

  resultValue.textContent = `${amount} ${from} = ${result} ${to}`;

  history.push({ amount, from, to, result });
  renderHistory(history);

  form.reset();
  amountInput.setCustomValidity('');
});

/* ===== Початковий стан ===== */

renderRates(rates);
updateRatesCount(rates);
renderHistory(history);
loadRates();