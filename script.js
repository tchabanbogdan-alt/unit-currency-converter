/*
  Конвертер валют і одиниць виміру — клієнтський скрипт
  Практикум 8: обробка подій та форми, клієнтська валідація
*/

/* ===== Дані ===== */

// Курси валют відносно долара США: 1 USD = rates[код]
const rates = { USD: 1, EUR: 0.92, UAH: 41.5 };

// Поріг, вище якого курс позначається класом big-rate
const BIG_RATE = 10;

// Історія виконаних конвертацій
const history = [];

/* ===== Елементи сторінки ===== */

const ratesList = document.querySelector('#rates-list');
const ratesCount = document.querySelector('#rates-count');

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

// Переводить суму з однієї валюти в іншу через курс до долара
function convertCurrency(amount, from, to) {
  const inUsd = amount / rates[from];
  return convert(inUsd, rates[to]);
}

// Будує список курсів у контейнері #rates-list
function renderRates(ratesObject) {
  ratesList.innerHTML = '';

  for (const [code, rate] of Object.entries(ratesObject)) {
    const item = document.createElement('li');

    item.textContent = `${code}: ${rate}`;
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
function updateRatesCount(ratesObject) {
  const total = Object.keys(ratesObject).length;
  ratesCount.textContent = `Валют у списку: ${total}`;
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