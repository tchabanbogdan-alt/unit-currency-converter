/*
  Конвертер валют і одиниць виміру — клієнтський скрипт
  Практикум 6: основи JavaScript — змінні, умови, цикли, функції
*/

console.log('script.js підключено');

// Курси валют відносно долара США: 1 USD = rates[код]
const rates = { USD: 1, EUR: 0.92, UAH: 41.5 };

// Поріг, вище якого результат конвертації вважається великою сумою
const LARGE_AMOUNT = 1000;

// Сума в доларах, яку конвертуємо для перевірки роботи скрипта
const sourceAmount = 50;

// Виводить у консоль усі курси з об'єкта і повертає їх кількість
function showRates(ratesObject) {
  let count = 0;

  console.log('Курси валют (за 1 USD):');

  for (const code of Object.keys(ratesObject)) {
    console.log(`${code}: ${ratesObject[code]}`);
    count += 1;
  }

  return count;
}

// Переводить суму за заданим курсом
const convert = (amount, rate) => amount * rate;

const ratesCount = showRates(rates);
console.log(`Усього курсів у довіднику: ${ratesCount}`);

const converted = convert(sourceAmount, rates.UAH);
console.log(`${sourceAmount} USD = ${converted} UAH`);

// Класифікація результату конвертації за порогом
if (converted > LARGE_AMOUNT) {
  console.log(`Велика сума: понад ${LARGE_AMOUNT} UAH`);
} else {
  console.log(`Звичайна сума: до ${LARGE_AMOUNT} UAH`);
}