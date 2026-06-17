/* ============================================================================
 * I18n.js — локализация интерфейса. Все надписи игры берутся отсюда по ключу,
 * поэтому смена языка меняет ВЕСЬ текст в игре на лету.
 *
 * Языки: ru (базовый), en, tr, uk, kk. t(key, params) подставляет {плейсхолдеры}
 * и откатывается на русский, затем на сам ключ, если перевода нет.
 * ========================================================================== */
window.BJ = window.BJ || {};

BJ.I18n = (function () {
  'use strict';

  var Storage = BJ.Storage;

  var LANGS = [
    { code: 'ru', label: 'Русский' },
    { code: 'en', label: 'English' },
    { code: 'tr', label: 'Türkçe' },
    { code: 'uk', label: 'Українська' },
    { code: 'kk', label: 'Қазақша' }
  ];
  var SUPPORTED = { ru: 1, en: 1, tr: 1, uk: 1, kk: 1 };

  var DICTS = {
    ru: {
      'brand': 'Двадцать одно',
      'credit': 'Карточная игра «21» · работает офлайн · для Яндекс Игр',
      'common.close': 'Закрыть',
      'common.loading': 'Загрузка…',
      'start.play': 'Играть',
      'start.rules': 'Правила',
      'top.leaders': 'Таблица лидеров',
      'top.stats': 'Статистика',
      'top.sound': 'Звук',
      'action.clear': 'Сброс',
      'action.deal': 'Раздать',
      'action.hit': 'Взять',
      'action.double': 'Удвоить',
      'action.stand': 'Хватит',
      'action.next': 'Следующая раздача',
      'table.dealer': 'Дилер',
      'table.you': 'Вы',
      'bet.label': 'Ставка',
      'bet.place': 'Поставить {v}',
      'broke.title': 'Фишки закончились',
      'broke.bonus': 'Получить 1000 фишек',
      'outcome.blackjack': 'Блэкджек!',
      'outcome.win': 'Вы выиграли',
      'outcome.dealer_bust': 'Перебор у дилера!',
      'outcome.push': 'Ничья',
      'outcome.lose': 'Дилер выиграл',
      'outcome.bust': 'Перебор',
      'result.win': '+{n} фишек',
      'result.lose': '−{n} фишек',
      'result.push': 'Ставка возвращена',
      'unit.chips': 'фишек',
      'loading.cards': 'Загрузка карт… {pct}%',
      'loading.ready': 'Готово!',
      'stats.title': 'Статистика',
      'stats.hands': 'Сыграно раздач',
      'stats.wins': 'Побед',
      'stats.losses': 'Поражений',
      'stats.pushes': 'Ничьих',
      'stats.blackjacks': 'Блэкджеков',
      'stats.winrate': 'Процент побед',
      'stats.beststreak': 'Лучшая серия побед',
      'stats.biggestwin': 'Крупнейший выигрыш',
      'stats.bestbalance': 'Рекорд баланса',
      'stats.current': 'Текущий баланс',
      'stats.reset': 'Сбросить прогресс',
      'stats.resetConfirm': 'Сбросить весь прогресс и статистику?',
      'leaders.title': 'Лидеры по фишкам',
      'leaders.empty': 'Пока никого нет — сыграйте раздачу, чтобы попасть в таблицу лидеров!',
      'leaders.anon': 'Аноним',
      'leaders.unavailable': 'Таблица лидеров доступна в Яндекс Играх.',
      'leaders.auth': 'Войти, чтобы участвовать',
      'settings.title': 'Настройки',
      'settings.language': 'Язык',
      'settings.sound': 'Звук',
      'settings.haptics': 'Вибрация',
      'settings.on': 'Вкл',
      'settings.off': 'Выкл',
      'rules.title': 'Правила игры',
      'rules.body': [
        'Цель — набрать сумму очков ближе к 21, чем у дилера, но не больше 21.',
        'Карты 2–10 — по номиналу, валет/дама/король — 10 очков, туз — 1 или 11.',
        '«Блэкджек» — туз и карта в 10 очков с первых двух карт. Платит 3:2.',
        '«Взять» — добрать карту, «Хватит» — остановиться, «Удвоить» — удвоить ставку и взять одну карту.',
        'Дилер обязан брать до 17 и останавливается на 17 и выше.',
        'Перебор (больше 21) — проигрыш. При равенстве очков — ничья, ставка возвращается.'
      ],
      'shop.title': 'Магазин фишек',
      'shop.daily.title': 'Ежедневный бонус',
      'shop.daily.desc': '+500 фишек каждый день',
      'shop.daily.claim': 'Забрать',
      'shop.daily.next': 'Через {t}',
      'shop.ad1.title': '+1000 фишек',
      'shop.ad1.desc': 'За 1 рекламу',
      'shop.ad1.btn': 'Смотреть',
      'shop.ad3.title': '+5000 фишек',
      'shop.ad3.desc': 'За 3 рекламы',
      'shop.ad3.btn': 'Смотреть',
      'shop.ad3.locked': 'Доступно через {t}',
      'shop.ad3.progress': 'Реклама {k}/{n}',
      'shop.unavailable': 'Реклама доступна в Яндекс Играх',
      'shop.adError': 'Реклама недоступна, попробуйте позже'
    },

    en: {
      'brand': 'Twenty-One',
      'credit': 'Card game “21” · works offline · for Yandex Games',
      'common.close': 'Close',
      'common.loading': 'Loading…',
      'start.play': 'Play',
      'start.rules': 'Rules',
      'top.leaders': 'Leaderboard',
      'top.stats': 'Statistics',
      'top.sound': 'Sound',
      'action.clear': 'Clear',
      'action.deal': 'Deal',
      'action.hit': 'Hit',
      'action.double': 'Double',
      'action.stand': 'Stand',
      'action.next': 'Next hand',
      'table.dealer': 'Dealer',
      'table.you': 'You',
      'bet.label': 'Bet',
      'bet.place': 'Bet {v}',
      'broke.title': 'Out of chips',
      'broke.bonus': 'Get 1000 chips',
      'outcome.blackjack': 'Blackjack!',
      'outcome.win': 'You won',
      'outcome.dealer_bust': 'Dealer bust!',
      'outcome.push': 'Push',
      'outcome.lose': 'Dealer won',
      'outcome.bust': 'Bust',
      'result.win': '+{n} chips',
      'result.lose': '−{n} chips',
      'result.push': 'Bet returned',
      'unit.chips': 'chips',
      'loading.cards': 'Loading cards… {pct}%',
      'loading.ready': 'Ready!',
      'stats.title': 'Statistics',
      'stats.hands': 'Hands played',
      'stats.wins': 'Wins',
      'stats.losses': 'Losses',
      'stats.pushes': 'Pushes',
      'stats.blackjacks': 'Blackjacks',
      'stats.winrate': 'Win rate',
      'stats.beststreak': 'Best win streak',
      'stats.biggestwin': 'Biggest win',
      'stats.bestbalance': 'Peak balance',
      'stats.current': 'Current balance',
      'stats.reset': 'Reset progress',
      'stats.resetConfirm': 'Reset all progress and statistics?',
      'leaders.title': 'Top by chips',
      'leaders.empty': 'No one yet — play a hand to join the leaderboard!',
      'leaders.anon': 'Anonymous',
      'leaders.unavailable': 'The leaderboard is available in Yandex Games.',
      'leaders.auth': 'Sign in to participate',
      'settings.title': 'Settings',
      'settings.language': 'Language',
      'settings.sound': 'Sound',
      'settings.haptics': 'Vibration',
      'settings.on': 'On',
      'settings.off': 'Off',
      'rules.title': 'Game rules',
      'rules.body': [
        'Goal: get a total closer to 21 than the dealer, without going over 21.',
        'Cards 2–10 are face value, Jack/Queen/King are 10, an Ace is 1 or 11.',
        '“Blackjack” is an Ace plus a 10-value card on your first two cards. Pays 3:2.',
        '“Hit” takes a card, “Stand” stops, “Double” doubles your bet and draws one card.',
        'The dealer must draw until 17 and stands on 17 or more.',
        'Going over 21 (bust) loses. Equal totals push — your bet is returned.'
      ],
      'shop.title': 'Chip shop',
      'shop.daily.title': 'Daily bonus',
      'shop.daily.desc': '+500 chips every day',
      'shop.daily.claim': 'Claim',
      'shop.daily.next': 'In {t}',
      'shop.ad1.title': '+1000 chips',
      'shop.ad1.desc': 'For 1 ad',
      'shop.ad1.btn': 'Watch',
      'shop.ad3.title': '+5000 chips',
      'shop.ad3.desc': 'For 3 ads',
      'shop.ad3.btn': 'Watch',
      'shop.ad3.locked': 'Available in {t}',
      'shop.ad3.progress': 'Ad {k}/{n}',
      'shop.unavailable': 'Ads are available in Yandex Games',
      'shop.adError': 'Ad unavailable, try later'
    },

    tr: {
      'brand': 'Yirmi Bir',
      'credit': '“21” kart oyunu · çevrimdışı çalışır · Yandex Games için',
      'common.close': 'Kapat',
      'common.loading': 'Yükleniyor…',
      'start.play': 'Oyna',
      'start.rules': 'Kurallar',
      'top.leaders': 'Liderlik tablosu',
      'top.stats': 'İstatistikler',
      'top.sound': 'Ses',
      'action.clear': 'Sıfırla',
      'action.deal': 'Dağıt',
      'action.hit': 'Çek',
      'action.double': 'İkiye katla',
      'action.stand': 'Dur',
      'action.next': 'Sonraki el',
      'table.dealer': 'Krupiye',
      'table.you': 'Siz',
      'bet.label': 'Bahis',
      'bet.place': 'Bahis {v}',
      'broke.title': 'Çipler bitti',
      'broke.bonus': '1000 çip al',
      'outcome.blackjack': 'Blackjack!',
      'outcome.win': 'Kazandınız',
      'outcome.dealer_bust': 'Krupiye battı!',
      'outcome.push': 'Berabere',
      'outcome.lose': 'Krupiye kazandı',
      'outcome.bust': 'Battı',
      'result.win': '+{n} çip',
      'result.lose': '−{n} çip',
      'result.push': 'Bahis iade edildi',
      'unit.chips': 'çip',
      'loading.cards': 'Kartlar yükleniyor… {pct}%',
      'loading.ready': 'Hazır!',
      'stats.title': 'İstatistikler',
      'stats.hands': 'Oynanan el',
      'stats.wins': 'Galibiyet',
      'stats.losses': 'Mağlubiyet',
      'stats.pushes': 'Berabere',
      'stats.blackjacks': 'Blackjack',
      'stats.winrate': 'Kazanma oranı',
      'stats.beststreak': 'En iyi seri',
      'stats.biggestwin': 'En büyük kazanç',
      'stats.bestbalance': 'Rekor bakiye',
      'stats.current': 'Mevcut bakiye',
      'stats.reset': 'İlerlemeyi sıfırla',
      'stats.resetConfirm': 'Tüm ilerleme ve istatistikler sıfırlansın mı?',
      'leaders.title': 'Çip liderleri',
      'leaders.empty': 'Henüz kimse yok — tabloya girmek için bir el oyna!',
      'leaders.anon': 'Anonim',
      'leaders.unavailable': 'Liderlik tablosu Yandex Games’te kullanılabilir.',
      'leaders.auth': 'Katılmak için giriş yap',
      'settings.title': 'Ayarlar',
      'settings.language': 'Dil',
      'settings.sound': 'Ses',
      'settings.haptics': 'Titreşim',
      'settings.on': 'Açık',
      'settings.off': 'Kapalı',
      'rules.title': 'Oyun kuralları',
      'rules.body': [
        'Amaç: 21’i geçmeden toplamı krupiyeden daha çok 21’e yaklaştırmak.',
        '2–10 kartlar değerinde, Vale/Kız/Papaz 10, As 1 veya 11 sayılır.',
        '“Blackjack”: ilk iki kartta As ve 10 değerinde bir kart. 3:2 öder.',
        '“Çek” bir kart alır, “Dur” durdurur, “İkiye katla” bahsi katlar ve tek kart çeker.',
        'Krupiye 17’ye kadar kart çekmek zorundadır ve 17 ve üzerinde durur.',
        '21’i geçmek (batmak) kaybettirir. Eşit toplamda berabere, bahis iade edilir.'
      ],
      'shop.title': 'Çip mağazası',
      'shop.daily.title': 'Günlük bonus',
      'shop.daily.desc': 'Her gün +500 çip',
      'shop.daily.claim': 'Al',
      'shop.daily.next': '{t} sonra',
      'shop.ad1.title': '+1000 çip',
      'shop.ad1.desc': '1 reklam için',
      'shop.ad1.btn': 'İzle',
      'shop.ad3.title': '+5000 çip',
      'shop.ad3.desc': '3 reklam için',
      'shop.ad3.btn': 'İzle',
      'shop.ad3.locked': '{t} sonra',
      'shop.ad3.progress': 'Reklam {k}/{n}',
      'shop.unavailable': 'Reklamlar Yandex Games’te kullanılabilir',
      'shop.adError': 'Reklam yok, sonra dene'
    },

    uk: {
      'brand': 'Двадцять одно',
      'credit': 'Карткова гра «21» · працює офлайн · для Яндекс Ігор',
      'common.close': 'Закрити',
      'common.loading': 'Завантаження…',
      'start.play': 'Грати',
      'start.rules': 'Правила',
      'top.leaders': 'Таблиця лідерів',
      'top.stats': 'Статистика',
      'top.sound': 'Звук',
      'action.clear': 'Скинути',
      'action.deal': 'Роздати',
      'action.hit': 'Взяти',
      'action.double': 'Подвоїти',
      'action.stand': 'Досить',
      'action.next': 'Наступна роздача',
      'table.dealer': 'Дилер',
      'table.you': 'Ви',
      'bet.label': 'Ставка',
      'bet.place': 'Поставити {v}',
      'broke.title': 'Фішки закінчились',
      'broke.bonus': 'Отримати 1000 фішок',
      'outcome.blackjack': 'Блекджек!',
      'outcome.win': 'Ви виграли',
      'outcome.dealer_bust': 'Перебір у дилера!',
      'outcome.push': 'Нічия',
      'outcome.lose': 'Дилер виграв',
      'outcome.bust': 'Перебір',
      'result.win': '+{n} фішок',
      'result.lose': '−{n} фішок',
      'result.push': 'Ставка повернена',
      'unit.chips': 'фішок',
      'loading.cards': 'Завантаження карт… {pct}%',
      'loading.ready': 'Готово!',
      'stats.title': 'Статистика',
      'stats.hands': 'Зіграно роздач',
      'stats.wins': 'Перемог',
      'stats.losses': 'Поразок',
      'stats.pushes': 'Нічиїх',
      'stats.blackjacks': 'Блекджеків',
      'stats.winrate': 'Відсоток перемог',
      'stats.beststreak': 'Найкраща серія перемог',
      'stats.biggestwin': 'Найбільший виграш',
      'stats.bestbalance': 'Рекорд балансу',
      'stats.current': 'Поточний баланс',
      'stats.reset': 'Скинути прогрес',
      'stats.resetConfirm': 'Скинути весь прогрес і статистику?',
      'leaders.title': 'Лідери за фішками',
      'leaders.empty': 'Поки нікого немає — зіграйте роздачу, щоб потрапити до таблиці лідерів!',
      'leaders.anon': 'Анонім',
      'leaders.unavailable': 'Таблиця лідерів доступна в Яндекс Іграх.',
      'leaders.auth': 'Увійти, щоб брати участь',
      'settings.title': 'Налаштування',
      'settings.language': 'Мова',
      'settings.sound': 'Звук',
      'settings.haptics': 'Вібрація',
      'settings.on': 'Увімк',
      'settings.off': 'Вимк',
      'rules.title': 'Правила гри',
      'rules.body': [
        'Мета — набрати суму очок ближче до 21, ніж у дилера, але не більше за 21.',
        'Карти 2–10 — за номіналом, валет/дама/король — 10 очок, туз — 1 або 11.',
        '«Блекджек» — туз і карта на 10 очок із перших двох карт. Платить 3:2.',
        '«Взяти» — добрати карту, «Досить» — зупинитися, «Подвоїти» — подвоїти ставку та взяти одну карту.',
        'Дилер мусить брати до 17 і зупиняється на 17 та вище.',
        'Перебір (більше 21) — програш. За рівності очок — нічия, ставка повертається.'
      ],
      'shop.title': 'Магазин фішок',
      'shop.daily.title': 'Щоденний бонус',
      'shop.daily.desc': '+500 фішок щодня',
      'shop.daily.claim': 'Забрати',
      'shop.daily.next': 'Через {t}',
      'shop.ad1.title': '+1000 фішок',
      'shop.ad1.desc': 'За 1 рекламу',
      'shop.ad1.btn': 'Дивитися',
      'shop.ad3.title': '+5000 фішок',
      'shop.ad3.desc': 'За 3 реклами',
      'shop.ad3.btn': 'Дивитися',
      'shop.ad3.locked': 'Доступно через {t}',
      'shop.ad3.progress': 'Реклама {k}/{n}',
      'shop.unavailable': 'Реклама доступна в Яндекс Іграх',
      'shop.adError': 'Реклама недоступна, спробуйте пізніше'
    },

    kk: {
      'brand': 'Жиырма бір',
      'credit': '«21» карта ойыны · офлайн жұмыс істейді · Yandex Games үшін',
      'common.close': 'Жабу',
      'common.loading': 'Жүктелуде…',
      'start.play': 'Ойнау',
      'start.rules': 'Ережелер',
      'top.leaders': 'Көшбасшылар кестесі',
      'top.stats': 'Статистика',
      'top.sound': 'Дыбыс',
      'action.clear': 'Тазалау',
      'action.deal': 'Тарату',
      'action.hit': 'Алу',
      'action.double': 'Екі есе',
      'action.stand': 'Жетеді',
      'action.next': 'Келесі тарату',
      'table.dealer': 'Дилер',
      'table.you': 'Сіз',
      'bet.label': 'Ставка',
      'bet.place': '{v} тігу',
      'broke.title': 'Чиптер бітті',
      'broke.bonus': '1000 чип алу',
      'outcome.blackjack': 'Блэкджек!',
      'outcome.win': 'Сіз ұттыңыз',
      'outcome.dealer_bust': 'Дилер асып кетті!',
      'outcome.push': 'Тең ойын',
      'outcome.lose': 'Дилер ұтты',
      'outcome.bust': 'Асып кетті',
      'result.win': '+{n} чип',
      'result.lose': '−{n} чип',
      'result.push': 'Ставка қайтарылды',
      'unit.chips': 'чип',
      'loading.cards': 'Карталар жүктелуде… {pct}%',
      'loading.ready': 'Дайын!',
      'stats.title': 'Статистика',
      'stats.hands': 'Ойналған таратулар',
      'stats.wins': 'Жеңіс',
      'stats.losses': 'Жеңіліс',
      'stats.pushes': 'Тең ойын',
      'stats.blackjacks': 'Блэкджектер',
      'stats.winrate': 'Жеңіс пайызы',
      'stats.beststreak': 'Үздік жеңіс сериясы',
      'stats.biggestwin': 'Ең үлкен ұтыс',
      'stats.bestbalance': 'Рекорд баланс',
      'stats.current': 'Ағымдағы баланс',
      'stats.reset': 'Прогресті тазалау',
      'stats.resetConfirm': 'Барлық прогресс пен статистиканы тазалау керек пе?',
      'leaders.title': 'Чип бойынша көшбасшылар',
      'leaders.empty': 'Әзірге ешкім жоқ — кестеге кіру үшін бір ойын ойнаңыз!',
      'leaders.anon': 'Аноним',
      'leaders.unavailable': 'Көшбасшылар кестесі Yandex Games-те қолжетімді.',
      'leaders.auth': 'Қатысу үшін кіру',
      'settings.title': 'Параметрлер',
      'settings.language': 'Тіл',
      'settings.sound': 'Дыбыс',
      'settings.haptics': 'Діріл',
      'settings.on': 'Қосулы',
      'settings.off': 'Өшірулі',
      'rules.title': 'Ойын ережелері',
      'rules.body': [
        'Мақсат — дилерге қарағанда 21-ге жақынырақ ұпай жинау, бірақ 21-ден аспау.',
        '2–10 карталар номиналы бойынша, валет/дама/король — 10 ұпай, туз — 1 не 11.',
        '«Блэкджек» — алғашқы екі картадағы туз бен 10 ұпайлық карта. 3:2 төлейді.',
        '«Алу» — карта алу, «Жетеді» — тоқтау, «Екі есе» — ставканы екі есе арттырып, бір карта алу.',
        'Дилер 17-ге дейін алуға міндетті және 17 мен одан жоғарыда тоқтайды.',
        'Асып кету (21-ден көп) — ұтылыс. Ұпай тең болса — тең ойын, ставка қайтарылады.'
      ],
      'shop.title': 'Чип дүкені',
      'shop.daily.title': 'Күнделікті бонус',
      'shop.daily.desc': 'Күн сайын +500 чип',
      'shop.daily.claim': 'Алу',
      'shop.daily.next': '{t} кейін',
      'shop.ad1.title': '+1000 чип',
      'shop.ad1.desc': '1 жарнама үшін',
      'shop.ad1.btn': 'Көру',
      'shop.ad3.title': '+5000 чип',
      'shop.ad3.desc': '3 жарнама үшін',
      'shop.ad3.btn': 'Көру',
      'shop.ad3.locked': '{t} кейін қолжетімді',
      'shop.ad3.progress': 'Жарнама {k}/{n}',
      'shop.unavailable': 'Жарнама Yandex Games-те қолжетімді',
      'shop.adError': 'Жарнама қолжетімсіз, кейінірек көріңіз'
    }
  };

  var current = 'ru';

  function clamp(code) {
    return code && SUPPORTED[code] ? code : null;
  }

  function fill(str, params) {
    if (!params) return str;
    return str.replace(/\{(\w+)\}/g, function (m, k) {
      return params[k] != null ? params[k] : m;
    });
  }

  function raw(key) {
    var d = DICTS[current];
    if (d && d[key] != null) return d[key];
    if (DICTS.ru[key] != null) return DICTS.ru[key];
    return key;
  }

  return {
    LANGS: LANGS,

    /** Текущий код языка. */
    getLang: function () { return current; },

    /** Перевод строки по ключу с подстановкой {плейсхолдеров}. */
    t: function (key, params) {
      var v = raw(key);
      if (typeof v !== 'string') return key;
      return fill(v, params);
    },

    /** Перевод-список (например, строки правил). Возвращает массив строк. */
    tList: function (key) {
      var v = raw(key);
      return Array.isArray(v) ? v.slice() : [];
    },

    /**
     * Установить язык: запомнить, обновить <html lang>, отправить в облако и
     * перерисовать интерфейс через BJ.UI.applyLang().
     */
    setLang: function (code) {
      code = clamp(code) || 'ru';
      current = code;
      if (Storage) Storage.update(function (d) { d.settings.lang = code; });
      try { document.documentElement.lang = code; } catch (e) {}
      if (BJ.Yandex && BJ.Yandex.cloudSet && Storage) BJ.Yandex.cloudSet(Storage.load());
      if (BJ.UI && BJ.UI.applyLang) BJ.UI.applyLang();
    },

    /**
     * Выбрать начальный язык: сохранённый → язык окружения Яндекса →
     * язык браузера → ru. Только запоминает (без перерисовки).
     */
    detectInitial: function () {
      var saved = Storage ? clamp((Storage.load().settings || {}).lang) : null;
      if (saved) { current = saved; return current; }
      var ya = BJ.Yandex && BJ.Yandex.getLang ? clamp(BJ.Yandex.getLang()) : null;
      if (ya) { current = ya; return current; }
      var nav = null;
      try { nav = clamp((navigator.language || '').slice(0, 2)); } catch (e) {}
      current = nav || 'ru';
      return current;
    }
  };
})();
