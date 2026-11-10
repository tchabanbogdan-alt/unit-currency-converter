/*
  Конвертер валют і одиниць виміру — клієнтський скрипт
  Практикум 11: локальні сховища даних (localStorage / IndexedDB)

  Фреймворк — Vue 3 (практикум 10): шаблони пишуться звичайним HTML
  і підключаються одним CDN-тегом, без збірки та Node.js.

  Історія конвертацій зберігається між перезавантаженнями сторінки:
  основне сховище — IndexedDB (об'єктне сховище history, ключ id
  з автоінкрементом), localStorage лишається для одноразової міграції
  вже накопичених даних і як резерв, якщо база недоступна.
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

/* ===== Локальні сховища даних ===== */

// Ключі localStorage: самі дані та прапорець одноразової міграції
const LS_HISTORY_KEY = 'converter-history';
const LS_MIGRATED_KEY = 'converter-history-migrated';

// Параметри бази IndexedDB за варіантом: сховище history, ключ id з автоінкрементом
const DB_NAME = 'ConverterDB';
const DB_VERSION = 1;
const STORE_NAME = 'history';

// Скільки останніх записів показувати на сторінці
const HISTORY_LIMIT = 10;

// Записує історію в localStorage: зберігати можна лише рядки, тому JSON.stringify
function saveToLocalStorage(items) {
  try {
    localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('Не вдалося записати історію в localStorage:', error);
  }
}

// Читає історію з localStorage; пошкоджений JSON не має ламати застосунок
function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_HISTORY_KEY);

    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Пошкоджені дані в localStorage:', error);

    return [];
  }
}

// Відкриває базу даних; object store створюється лише в onupgradeneeded
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Перевірка потрібна, щоб не створювати те саме сховище вдруге
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Додає новий запис або оновлює наявний: put працює для обох випадків
async function addItem(item) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');

    tx.objectStore(STORE_NAME).put(item);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Повертає всі записи сховища однією транзакцією тільки для читання
async function getAllItems() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Видаляє запис за ключем
async function deleteItem(id) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');

    tx.objectStore(STORE_NAME).delete(id);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Одноразово переносить записи з localStorage у IndexedDB.
// Повертає кількість перенесених записів; прапорець не дає повторити перенесення.
async function migrateFromLocalStorage() {
  if (localStorage.getItem(LS_MIGRATED_KEY) === 'true') {
    return 0;
  }

  const stored = loadFromLocalStorage();
  const existing = await getAllItems();

  // Переносимо лише тоді, коли сховище порожнє, а в localStorage щось є
  if (stored.length === 0 || existing.length > 0) {
    localStorage.setItem(LS_MIGRATED_KEY, 'true');

    return 0;
  }

  for (const item of stored) {
    // id у базі генерується автоматично, тому старий ключ не переносимо
    const { id, ...fields } = item;

    await addItem(fields);
  }

  localStorage.setItem(LS_MIGRATED_KEY, 'true');

  return stored.length;
}

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
  emits: ['remove'],

  methods: {
    // Показує лише час запису — дата зберігається повністю в timestamp
    formatTime(timestamp) {
      return new Date(timestamp).toLocaleString('uk-UA', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      });
    }
  },

  template: `
    <div>
      <ul id="history-list">
        <li v-for="item in items" :key="item.id" class="history-item" :data-result="item.result">
          <span class="history-text">{{ item.amount }} {{ item.from }} = {{ item.result }} {{ item.to }}</span>
          <span class="history-time">{{ formatTime(item.timestamp) }}</span>
          <button type="button" class="history-remove" @click="$emit('remove', item.id)"
                  title="Видалити запис">&times;</button>
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
      storageError: '',
      migratedCount: 0,
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

  computed: {
    // Останні HISTORY_LIMIT записів, найновіші згори
    recentHistory() {
      return [...this.history]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, HISTORY_LIMIT);
    }
  },

  methods: {
    // Перечитує історію зі сховища й оновлює стан
    async refreshHistory() {
      this.history = await getAllItems();
    },

    // Записує нову конвертацію у сховище і одразу оновлює список
    async addToHistory(entry) {
      const record = { ...entry, timestamp: Date.now() };

      if (this.storageError) {
        // База недоступна — працюємо лише з localStorage
        record.id = Date.now();
        this.history = [...this.history, record];
        saveToLocalStorage(this.history);

        return;
      }

      try {
        await addItem(record);
        await this.refreshHistory();
      } catch (error) {
        this.storageError = 'Не вдалося зберегти запис у базу даних.';
        console.error(error);
      }
    },

    // Видаляє запис історії зі сховища
    async removeFromHistory(id) {
      if (this.storageError) {
        this.history = this.history.filter((item) => item.id !== id);
        saveToLocalStorage(this.history);

        return;
      }

      try {
        await deleteItem(id);
        await this.refreshHistory();
      } catch (error) {
        this.storageError = 'Не вдалося видалити запис із бази даних.';
        console.error(error);
      }
    },

    // Готує сховище під час запуску: міграція з localStorage і читання історії
    async initStorage() {
      try {
        this.migratedCount = await migrateFromLocalStorage();
        await this.refreshHistory();
      } catch (error) {
        // IndexedDB може бути недоступна, наприклад у приватному режимі
        this.storageError = 'Базу даних недоступно — історія зберігається лише до закриття вкладки.';
        this.history = loadFromLocalStorage();
        console.error(error);
      }
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

  // Після монтування готуємо сховище й запитуємо курси
  mounted() {
    this.initStorage();
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
