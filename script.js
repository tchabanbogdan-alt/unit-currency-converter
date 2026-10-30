/*
  Конвертер валют і одиниць виміру — клієнтський скрипт
  Практикум 7: маніпуляція DOM за допомогою JavaScript
*/

console.log('script.js підключено');

/* ===== Дані (практикум 6) ===== */

// Курси валют відносно долара США: 1 USD = rates[код]
const rates = { USD: 1, EUR: 0.92, UAH: 41.5 };

// Поріг, вище якого результат конвертації вважається великою сумою
const LARGE_AMOUNT = 1000;

// Поріг, вище якого курс позначається класом big-rate
const BIG_RATE = 10;

// Сума в доларах, яку конвертуємо для перевірки роботи скрипта
const sourceAmount = 50;

/* ===== Елементи сторінки ===== */

const ratesList = document.querySelector('#rates-list');
const ratesCount = document.querySelector('#rates-count');

/* ===== Функції ===== */

// Переводить суму за заданим курсом
const convert = (amount, rate) => amount * rate;

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

/* ===== Виконання ===== */

// Прибираємо статичний приклад, що лишився в розмітці з практикуму 2
const staticItem = document.querySelector('#rates-list .rate-item');

if (staticItem) {
  staticItem.remove();
}

renderRates(rates);
updateRatesCount(rates);

const converted = convert(sourceAmount, rates.UAH);
console.log(`${sourceAmount} USD = ${converted} UAH`);

// Класифікація результату конвертації за порогом
if (converted > LARGE_AMOUNT) {
  console.log(`Велика сума: понад ${LARGE_AMOUNT} UAH`);
} else {
  console.log(`Звичайна сума: до ${LARGE_AMOUNT} UAH`);
}