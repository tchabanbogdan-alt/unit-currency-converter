/*
  Конвертер валют і одиниць виміру — клієнтський скрипт
  Практикум 10: клієнтське програмування з бібліотеками та фреймворками

  Обрано Vue 3: його шаблони пишуться звичайним HTML і підключаються одним
  CDN-тегом, тоді як React у браузері без збірки вимагав би ще й Babel для
  трансляції JSX — для навчального проєкту без Node.js Vue простіший.
*/

/* ===== Налаштування запиту ===== */

// Курси беремо з відкритого API Frankfurter, джерело даних — Національний банк України
const API_URL = 'https://api.frankfurter.dev/v2/providers/nbu/rates';

// Валюти, які показує застосунок (у відповіді їх значно більше)
const CURRENCIES = ['USD', 'EUR', 'UAH'];

// Резервні курси: показуються, доки триває запит або якщо API недоступний
const FALLBACK_RATES = { EUR: 1, USD: 1.11, UAH: 50.5 };

// Поріг, вище якого курс позначається класом big-rate
const BIG_RATE = 10;

// Підписи валют для списків вибору
const UNIT_LABELS = {
  UAH: 'Гривня (UAH)',
  USD: 'Долар США (USD)',
  EUR: 'Євро (EUR)'
};

// Округлює число до двох знаків після коми
const round2 = (value) => Math.round(value * 100) / 100;

/* ===== Компонент форми конвертації ===== */

// Має власний реактивний стан (amount, fromUnit, toUnit); курси отримує через props
const ConverterForm = {
  props: ['rates', 'units'],
  emits: ['save'],

  data() {
    return {
      amount: '',
      fromUnit: 'UAH',
      toUnit: 'USD'
    };
  },

  computed: {
    // Похідне значення: Vue перераховує його сам, щойно зміниться будь-яке
    // з трьох полів, тому окрема кнопка «Порахувати» не потрібна
    result() {
      const value = Number(this.amount);

      if (this.amount === '' || !Number.isFinite(value) || value <= 0) {
        return null;
      }

      const rateFrom = this.rates[this.fromUnit];
      const rateTo = this.rates[this.toUnit];

      if (!rateFrom || !rateTo) {
        return null;
      }

      return round2((value / rateFrom) * rateTo);
    },

    // Текст помилки теж похідний від поля суми
    error() {
      if (this.amount !== '' && Number(this.amount) <= 0) {
        return 'Сума має бути додатною';
      }

      return '';
    }
  },

  methods: {
    // Міняє одиниці місцями — результат перерахується сам
    swapUnits() {
      const current = this.fromUnit;

      this.fromUnit = this.toUnit;
      this.toUnit = current;
    },

    // Повідомляє батьківський компонент про новий запис історії
    save() {
      if (this.result === null) {
        return;
      }

      this.$emit('save', {
        amount: Number(this.amount),
        from: this.fromUnit,
        to: this.toUnit,
        result: this.result
      });

      this.amount = '';
    }
  },

  template: `
    <form @submit.prevent="save">

      <div class="field">
        <label for="amount">Значення</label>
        <input type="number" id="amount" v-model="amount"
               step="any" min="0.01" placeholder="0">
      </div>

      <p v-if="error" class="field-error">{{ error }}</p>

      <div class="units">

        <div class="field">
          <label for="unit-from">Конвертувати з</label>
          <select id="unit-from" v-model="fromUnit">
            <option v-for="(label, code) in units" :key="code" :value="code">{{ label }}</option>
          </select>
        </div>

        <button type="button" class="swap" @click="swapUnits"
                title="Поміняти одиниці місцями">&#8646;</button>

        <div class="field">
          <label for="unit-to">Конвертувати у</label>
          <select id="unit-to" v-model="toUnit">
            <option v-for="(label, code) in units" :key="code" :value="code">{{ label }}</option>
          </select>
        </div>

      </div>

      <p class="result-line" id="result-value">
        <span v-if="result !== null">{{ amount }} {{ fromUnit }} = {{ result }} {{ toUnit }}</span>
        <span v-else>Результат конвертації з'явиться після введення значення.</span>
      </p>

      <div>
        <button type="submit" class="btn" :disabled="result === null">Зберегти в історію</button>
      </div>

    </form>
  `
};

/* ===== Компонент списку курсів ===== */

// Отримує курси через props і рендерить їх директивою v-for
const RatesList = {
  props: ['rates', 'date'],

  computed: {
    total() {
      return Object.keys(this.rates).length;
    }
  },

  methods: {
    round2
  },

  template: `
    <div>
      <ul id="rates-list">
        <li v-for="(rate, code) in rates" :key="code"
            class="rate-item" :class="{ 'big-rate': rate > ${BIG_RATE} }"
            :data-rate="rate">
          {{ code }}: {{ round2(rate) }}
        </li>
      </ul>

      <p id="rates-count">
        Валют у списку: {{ total }}<span v-if="date"> · дані за {{ date }}</span>
      </p>
    </div>
  `
};

/* ===== Компонент історії конвертацій ===== */

const HistoryList = {
  props: ['items'],

  template: `
    <div>
      <ul id="history-list">
        <li v-for="item in items" :key="item.id" class="history-item" :data-result="item.result">
          {{ item.amount }} {{ item.from }} = {{ item.result }} {{ item.to }}
        </li>
      </ul>

      <p v-if="items.length === 0" id="history-empty">
        Історія порожня — виконайте першу конвертацію.
      </p>
    </div>
  `
};

/* ===== Кореневий застосунок ===== */

Vue.createApp({
  components: { ConverterForm, RatesList, HistoryList },

  data() {
    return {
      rates: { ...FALLBACK_RATES },
      ratesDate: '',
      units: UNIT_LABELS,
      history: [],
      nextId: 1,
      loading: false,
      errorMessage: '',
      conversionType: 'currency',
      conversionTypes: [
        { value: 'currency', label: 'Валюта' },
        { value: 'length', label: 'Довжина' },
        { value: 'weight', label: 'Вага' }
      ]
    };
  },

  methods: {
    // Додає запис до масиву історії — Vue сам перемальовує список
    addToHistory(entry) {
      this.history.push({ id: this.nextId, ...entry });
      this.nextId += 1;
    },

    // Завантажує актуальні курси валют з API Frankfurter (https://frankfurter.dev)
    async loadRates() {
      this.loading = true;
      this.errorMessage = '';

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

        // Відповідь — масив записів { date, base, quote, rate }, збираємо з них об'єкт
        const loaded = {};

        loaded[data[0].base] = 1;

        for (const entry of data) {
          if (CURRENCIES.includes(entry.quote)) {
            loaded[entry.quote] = entry.rate;
          }
        }

        // Достатньо присвоїти новий стан — перемальовування Vue бере на себе
        this.rates = loaded;
        this.ratesDate = data[0].date;
      } catch (error) {
        // Мережевий збій fetch повертає як TypeError — для нього окреме повідомлення
        this.errorMessage = error instanceof TypeError
          ? 'Немає з\'єднання з мережею. Показано збережені курси.'
          : error.message;

        console.error(error);
      } finally {
        this.loading = false;
      }
    }
  },

  // Запит виконуємо після монтування застосунку
  mounted() {
    this.loadRates();
  }
}).mount('#app');

/* ===== Ручний рендер із практикумів 7–9 (замінено компонентами) =====

   Нижче наведено код, який більше не використовується. Раніше кожну зміну
   даних доводилося переносити в DOM самостійно: очищати контейнер, створювати
   вузли через document.createElement, розставляти класи й атрибути та
   вставляти їх у список. Тепер цю ділянку інтерфейсу описують компоненти
   RatesList і HistoryList, а Vue сам вирішує, які вузли оновити при зміні
   стану, тому ручні виклики querySelector та innerHTML тут не потрібні.

   function renderRates(ratesObject) {
     ratesList.innerHTML = '';

     for (const [code, rate] of Object.entries(ratesObject)) {
       const item = document.createElement('li');

       item.textContent = `${code}: ${round2(rate)}`;
       item.classList.add('rate-item');
       item.dataset.rate = rate;

       if (rate > BIG_RATE) {
         item.classList.add('big-rate');
       }

       ratesList.append(item);
     }
   }

   function renderHistory(items) {
     historyList.innerHTML = '';

     for (const item of items) {
       const entry = document.createElement('li');

       entry.textContent = `${item.amount} ${item.from} = ${item.result} ${item.to}`;
       entry.classList.add('history-item');

       historyList.append(entry);
     }

     historyEmpty.hidden = items.length > 0;
   }

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
*/
