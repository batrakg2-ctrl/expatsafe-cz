// STORAGE KEYS
const STORAGE_FILTERS_KEY = 'expatsafe_v2_filters';
const STORAGE_COMPLETED_KEY = 'expatsafe_v2_completed';

// HELPER FUNCTIONS FOR MONTHLY TASK RESETS
function getCurrentYearMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getCurrentMonthName() {
    const months = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
    return months[new Date().getMonth()];
}

function isMonthlyTask(taskId) {
    const monthlyIds = ['vzp-main', 'cssz-main', 'flat-tax', 'tv-radio-license'];
    return monthlyIds.includes(taskId);
}

const state = {
    filters: {
        purpose: 'employee',
        stage: 'waiting',
        city: 'prague',
        hasDog: false,
        ownsProperty: false,
        hasCar: false,
        flatTax: false,
        isSecondaryOsvc: false,
        oampMonitoringActive: false
    },
    completedTasks: {}, // Maps task.id -> boolean
    currentCheckoutActionId: null,
    dsSimulation: {
        active: false,
        sender: '',
        subject: '',
        daysLeft: 10,
        timerInterval: null
    }
};

// DOM ELEMENTS
const tabBtnsPurpose = document.querySelectorAll('#group-purpose .tab-btn');
const tabBtnsStage = document.querySelectorAll('.stage-tab-btn');
const tabBtnsCity = document.querySelectorAll('#group-city .tab-btn');
const checkHasDog = document.getElementById('check-has-dog');
const checkOwnsProperty = document.getElementById('check-owns-property');
const checkHasCar = document.getElementById('check-has-car');
const checkFlatTax = document.getElementById('check-flat-tax');
const checkSecondaryOsvc = document.getElementById('check-secondary-osvc');

const pillFlatTax = document.getElementById('pill-flat-tax');
const pillSecondaryOsvc = document.getElementById('pill-secondary-osvc');
const rowExtraToggles = document.getElementById('row-extra-toggles');
const btnResetFilters = document.getElementById('btn-reset-filters');

const progressText = document.getElementById('progress-text');
const progressBadge = document.getElementById('progress-badge');
const progressBarFill = document.getElementById('progress-bar-fill');
const checklistTasks = document.getElementById('checklist-tasks');

const oampWidget = document.getElementById('oamp-widget');
const oampStatusText = document.getElementById('oamp-status-text');
const oampWidgetDesc = document.getElementById('oamp-widget-desc');
const btnWidgetConnect = document.getElementById('btn-widget-connect');

// MODAL CHECKOUT DOM
const modalCheckout = document.getElementById('modal-checkout');
const checkoutTitle = document.getElementById('checkout-title');
const checkoutDesc = document.getElementById('checkout-desc');
const checkoutForm = document.getElementById('checkout-form');
const btnCloseCheckout = document.getElementById('btn-close-checkout');

// OBLIGATIONS DATABASE
const tasksDatabase = [
    {
        id: 'vzp-main',
        title: 'Мед. страхование (OSVČ Hlavní)',
        cost: '3 306 CZK (~132 €) / мес',
        category: 'insurance',
        badge: 'Страхование',
        deadline: 'до 8 числа следующего месяца',
        urgency: 'warning',
        desc: 'Минимальный ежемесячный аванс на государственное медицинское страхование (на 2026 год).',
        shouldShow: (f) => f.purpose === 'osvc' && f.stage === 'waiting' && !f.flatTax && !f.isSecondaryOsvc,
        instructionHtml: `
            <h4>Как оплачивать авансы VZP:</h4>
            <p>Вы обязаны перечислять авансовые платежи ежемесячно. Деньги должны поступить на счет вашей страховой (VZP, OZP и др.) до 8-го числа следующего месяца.</p>
            <ol>
                <li>Узнайте номер расчетного счета для оплаты авансов в вашей страховой компании.</li>
                <li>Вашим переменным символом (*variabilní symbol*) обычно является ваше родне число (*rodné číslo*).</li>
                <li>Настройте автоматический платеж в своем интернет-банке на указанную сумму.</li>
            </ol>
        `
    },
    {
        id: 'vzp-secondary',
        title: 'Мед. страхование (OSVČ Vedlejší)',
        cost: '0 CZK / мес',
        category: 'insurance',
        badge: 'Страхование',
        deadline: 'доплата раз в год',
        urgency: 'info',
        desc: 'При ведении ИП как доп. деятельности вы освобождены от обязательных минимальных авансов.',
        shouldShow: (f) => f.isSecondaryOsvc && f.stage === 'waiting' && !f.flatTax,
        instructionHtml: `
            <h4>Правила для Vedlejší činnost (VZP):</h4>
            <p>Поскольку за вас медицинские взносы уже платит работодатель или государство (если вы учитесь), платить минимальные авансы ежемесячно не нужно.</p>
            <ul>
                <li>В конце года подается отчет (*Přehled*) о доходах в страховую компанию.</li>
                <li>Вы платите взнос только исходя из вашей фактической чистой прибыли (13.5% от половины чистой прибыли за год).</li>
            </ul>
        `
    },
    {
        id: 'cssz-main',
        title: 'Социальное страхование (OSVČ Hlavní)',
        cost: '4 759 CZK (~190 €) / мес',
        category: 'insurance',
        badge: 'Пенсионный фонд',
        deadline: 'до конца текущего месяца',
        urgency: 'warning',
        desc: 'Минимальный ежемесячный взнос на социальное страхование (в ČSSZ на 2026 г.).',
        shouldShow: (f) => f.purpose === 'osvc' && f.stage === 'waiting' && !f.flatTax && !f.isSecondaryOsvc,
        instructionHtml: `
            <h4>Оплата пенсионного страхования:</h4>
            <p>Сумма перечисляется на счет местного управления социального обеспечения (OSSZ) по месту вашей регистрации.</p>
            <p><strong>Важно:</strong> Деньги должны быть зачислены на счет ČSSZ до последнего дня календарного месяца, за который производится оплата.</p>
        `
    },
    {
        id: 'cssz-secondary',
        title: 'Социальное страхование (OSVČ Vedlejší)',
        cost: '0 CZK / мес',
        category: 'insurance',
        badge: 'Пенсионный фонд',
        deadline: 'доплата по итогам года',
        urgency: 'info',
        desc: 'Освобождение от пенсионных взносов при чистой прибыли от ИП ниже 117 521 CZK за год.',
        shouldShow: (f) => f.isSecondaryOsvc && f.stage === 'waiting' && !f.flatTax,
        instructionHtml: `
            <h4>Правила ČSSZ для Vedlejší činnost:</h4>
            <p>Если чистая прибыль от вашего ИП за год составит меньше <strong>117 521 CZK</strong>, социальный налог за этот год равен 0 CZK.</p>
            <ul>
                <li>Если лимит превышен, взносы рассчитываются по вашей чистой прибыли, и со следующего года возникают ежемесячные авансы (минимум 1 574 CZK/мес).</li>
            </ul>
        `
    },
    {
        id: 'flat-tax',
        title: 'Единый паушальный налог (Paušální daň)',
        cost: '8 120 CZK (~325 €) / мес',
        category: 'tax',
        badge: 'Единый платеж',
        deadline: 'до 20 числа текущего месяца',
        urgency: 'danger',
        desc: 'Сводная оплата налогов и всех страховых взносов одним платежом на счет налоговой инспекции.',
        shouldShow: (f) => f.purpose === 'osvc' && f.stage === 'waiting' && f.flatTax,
        instructionHtml: `
            <h4>Оплата Паушального налога:</h4>
            <p>Вы платите фиксированную сумму, которая покрывает налоги, мед. и соц. взносы. Вам не нужно сдавать годовые отчеты и декларации.</p>
            <ol>
                <li>Взносы переводятся на счет налогового управления по вашему региону.</li>
                <li>Срок зачисления денег — строго до 20-го числа текущего месяца.</li>
            </ol>
            <div style="background: rgba(239,68,68,0.1); border: 1px solid var(--color-danger); padding: 0.75rem; border-radius: 6px; margin-top: 0.5rem; color: var(--color-danger); font-size: 0.8rem;">
                <strong>Запрет на совмещение:</strong> Вы не можете использовать Paušální daň, если одновременно работаете на полную ставку в чешской компании.
            </div>
        `
    },
    {
        id: 'annual-tax-standard',
        title: 'Подоходный налог (DPFO за год)',
        cost: '15% от прибыли',
        category: 'tax',
        badge: 'Налоги',
        deadline: 'до 2 мая ежегодно',
        urgency: 'info',
        desc: 'Подача годового отчета по подоходному налогу в электронном виде (обязательно для OSVČ).',
        shouldShow: (f) => f.purpose === 'osvc' && f.stage === 'waiting' && !f.flatTax && !f.isSecondaryOsvc,
        cta: {
            label: 'Услуга под ключ',
            title: 'Сдать декларацию без ошибок',
            desc: 'Наш квалифицированный русскоязычный бухгалтер в Чехии заполнит декларацию DPFO и отчеты для VZP/ČSSZ, отправив их онлайн.',
            price: '1 200 CZK (~48 €)',
            btnText: 'Заказать у бухгалтера',
            actionId: 'order-accounting'
        },
        instructionHtml: `
            <h4>Подача декларации подоходного налога:</h4>
            <p>Все индивидуальные предприниматели обязаны подавать декларацию в электронном виде (в формате XML) через личный кабинет Datová Schránka.</p>
            <p><strong>Штрафы:</strong> Опоздание с подачей даже на несколько дней ведет к начислению штрафов со стороны налоговой инспекции (от 500 CZK).</p>
        `
    },
    {
        id: 'annual-tax-secondary',
        title: 'Налог DPFO (Декларация: Найм + ИП)',
        cost: '15% от совокупной базы',
        category: 'tax',
        badge: 'Налоги',
        deadline: 'до 2 мая ежегодно',
        urgency: 'warning',
        desc: 'Необходимость объединить доходы от работодателя и доходы от ИП в одной годовой декларации.',
        shouldShow: (f) => f.isSecondaryOsvc && f.stage === 'waiting' && !f.flatTax,
        cta: {
            label: 'Услуга под ключ',
            title: 'Бухгалтер: объединение найма и ИП',
            desc: 'Наш бухгалтер запросит данные у вашего работодателя, рассчитает налоги по ИП и подаст совместную декларацию за вас.',
            price: '1 500 CZK (~60 €)',
            btnText: 'Заказать декларацию',
            actionId: 'order-accounting'
        },
        instructionHtml: `
            <h4>Совместная налоговая декларация:</h4>
            <p>Ваша компания-работодатель не сможет сдать за вас годовые налоги. Вы обязаны сделать это самостоятельно.</p>
            <ol>
                <li>Запросите в финансовом отделе вашей работы документ <strong>Potvrzení o zdanitelných příjmech</strong> за прошедший год.</li>
                <li>Сложите брутто-доход от работы с чистой прибылью от ИП.</li>
                <li>Подайте объединенный отчет в налоговую инспекцию.</li>
            </ol>
        `
    },
    {
        id: 'municipal-waste-brno',
        title: 'Сбор за вывоз мусора (Брно)',
        cost: '670 CZK (~27 €) / год на человека',
        category: 'municipal',
        badge: 'Муниципальный',
        deadline: 'до 31 мая ежегодно',
        urgency: 'warning',
        desc: 'Обязательный индивидуальный сбор для всех иностранцев с пребыванием более 90 дней в Брно.',
        shouldShow: (f) => f.stage === 'waiting' && f.city === 'brno',
        instructionHtml: `
            <h4>Как оплатить мусор в Брно:</h4>
            <p>В Брно сбор привязан к конкретному человеку, арендодатель квартиры за вас его не платит.</p>
            <ol>
                <li>Зарегистрируйтесь на официальном городском портале <a href="https://www.brnoid.cz" target="_blank" class="instruction-link">BrnoID</a>.</li>
                <li>Перейдите в раздел "Poplatek za komunální odpad" (Сбор за мусор).</li>
                <li>Оплатите сбор картой прямо на портале. Сохраните чек об оплате.</li>
            </ol>
        `
    },
    {
        id: 'municipal-waste-prague',
        title: 'Сбор за вывоз мусора (Прага)',
        cost: '0 CZK (включено в аренду)',
        category: 'municipal',
        badge: 'Муниципальный',
        deadline: 'проверьте договор',
        urgency: 'info',
        desc: 'В Праге сбор обычно включен собственником жилья в коммунальные счета арендатору.',
        shouldShow: (f) => f.stage === 'waiting' && f.city === 'prague',
        instructionHtml: `
            <h4>Оплата мусора в Праге:</h4>
            <p>В Праге сбор распределяется между жильцами дома и обычно автоматически включен в ежемесячные коммунальные платежи (*poplatky*).</p>
            <ul>
                <li>Проверьте ваш договор аренды (*Nájemní smlouva*) и убедитесь, что пункт *odpady* (вывоз мусора) упомянут в коммунальных расходах.</li>
            </ul>
        `
    },
    {
        id: 'municipal-waste-other',
        title: 'Сбор за коммунальные отходы',
        cost: 'около 750 CZK (~30 €) / год',
        category: 'municipal',
        badge: 'Муниципальный',
        deadline: 'до 31 мая ежегодно',
        shouldShow: (f) => f.stage === 'waiting' && (f.city === 'ostrava' || f.city === 'other'),
        urgency: 'warning',
        instructionHtml: `
            <h4>Регистрация сбора за мусор:</h4>
            <p>В большинстве чешских городов сбор оплачивается индивидуально в мэрии.</p>
            <ol>
                <li>Посетите местную мэрию (Městský úřad) или зайдите на сайт вашего муниципалитета.</li>
                <li>Зарегистрируйтесь в отделе местных пошлин (Místní poplatky).</li>
                <li>Оплатите сбор наличными в кассе или переводом на банковский счет мэрии.</li>
            </ol>
        `
    },
    {
        id: 'dog-fee',
        title: 'Местный сбор за содержание собаки',
        cost: 'до 1 500 CZK (~60 €) / год',
        category: 'municipal',
        badge: 'Муниципальный',
        deadline: 'в течение 15 дней',
        urgency: 'warning',
        desc: 'Обязательный налог для владельцев собак. Требуется чипирование и регистрация.',
        shouldShow: (f) => f.stage === 'waiting' && f.hasDog,
        instructionHtml: `
            <h4>Обязанности владельцев собак:</h4>
            <ol>
                <li>Зарегистрируйте собаку в мэрии вашего района (Úřad městské části) в течение 15 дней после приобретения или переезда.</li>
                <li>Оплатите ежегодную пошлину (в Праге — до 1500 CZK в год, в Брно — около 1000 CZK).</li>
                <li><strong>Важно:</strong> Убедитесь, что собака чипирована ветеринаром и внесена в Центральный реестр собак Чехии (Ústřední registr psů), что является обязательным требованием.</li>
            </ol>
        `
    },
    {
        id: 'property-tax',
        title: 'Налог на недвижимость',
        cost: 'зависит от площади',
        category: 'tax',
        badge: 'Налоги',
        deadline: 'до 31 мая ежегодно',
        urgency: 'warning',
        desc: 'Ежегодный налог для собственников квартир, домов или земельных участков.',
        shouldShow: (f) => f.stage === 'waiting' && f.ownsProperty,
        instructionHtml: `
            <h4>Налог на недвижимость (Daň z nemovitých věcí):</h4>
            <ul>
                <li>После покупки жилья вы должны подать налоговую декларацию один раз (до 31 января следующего года).</li>
                <li>Затем ежегодно до 31 мая вы обязаны платить сам налог. Государство присылает квитанцию на оплату в вашу Datová schránka или письмом.</li>
            </ul>
        `
    },
    {
        id: 'road-tax',
        title: 'Дорожный налог (Silniční daň)',
        cost: 'нулевая ставка для легковых',
        category: 'tax',
        badge: 'Налоги',
        deadline: 'до 31 января ежегодно',
        urgency: 'info',
        desc: 'Обязателен для OSVČ, использующих автомобиль в коммерческих целях.',
        shouldShow: (f) => f.stage === 'waiting' && f.hasCar && (f.purpose === 'osvc' || f.isSecondaryOsvc),
        instructionHtml: `
            <h4>Дорожный налог в Чехии:</h4>
            <p>Если вы водите машину для нужд своего ЧП (OSVČ), вы обязаны зарегистрировать авто в налоговой и платить дорожный налог.</p>
            <ul>
                <li>Декларация подается и налог уплачивается ежегодно до 31 января.</li>
                <li>Легковые автомобили физических лиц, используемые для работы, часто имеют нулевую ставку налога, но подавать декларацию все равно нужно.</li>
            </ul>
        `
    },
    {
        id: 'tv-radio-license',
        title: 'Теле- и радио-лицензия',
        cost: '205 CZK (~8 €) / мес',
        category: 'municipal',
        badge: 'Муниципальный',
        deadline: 'ежемесячно',
        urgency: 'info',
        desc: 'Сбор за владение любым устройством с выходом в интернет (смартфоны, ПК, ноутбуки).',
        shouldShow: (f) => f.stage === 'waiting',
        instructionHtml: `
            <h4>Плата за чешское ТВ и Радио:</h4>
            <p>Сбор обязателен для каждого домохозяйства, в котором есть устройства, способные принимать трансляцию (теперь сюда официально относятся смартфоны и ноутбуки).</p>
            <ul>
                <li>Одно домохозяйство платит один взнос: 150 CZK (ТВ) + 55 CZK (Радио) = 205 CZK в месяц.</li>
                <li>Если вы арендуете квартиру, сбор часто оформляется на имя арендатора. Зарегистрироваться можно на сайтах Чешского телевидения (ČT) и Чешского радио (ČRo).</li>
            </ul>
        `
    },
    // PREPARATION STAGE TASKS
    {
        id: 'prep-insurance',
        title: 'Комплексная мед. страховка (PVZP)',
        cost: 'от 17 500 CZK (~700 €) / год',
        category: 'insurance',
        badge: 'Виза / ВНЖ',
        deadline: 'до подачи документов',
        urgency: 'warning',
        desc: 'Обязательный страховой полис комплексного медицинского покрытия для подачи пакета документов в OAMP.',
        shouldShow: (f) => f.purpose === 'student' || f.purpose === 'other',
        cta: {
            label: 'Скидка экспатам',
            title: 'Медицинская страховка PVZP онлайн',
            desc: 'Оформите оригинальный полис комплексного медицинского страхования PVZP со скидкой 10% напрямую у аккредитованного брокера.',
            price: 'от 17 500 CZK (~700 €)',
            btnText: 'Оформить со скидкой 10%',
            actionId: 'order-insurance'
        },
        instructionHtml: `
            <h4>Медицинское страхование для подачи на визу:</h4>
            <p>Вы обязаны предоставить подтверждение комплексного страхования с покрытием не менее 60 000 евро, действующего на весь срок запрашиваемой визы.</p>
            <ul>
                <li>В настоящее время разрешено страхование от компании PVZP.</li>
                <li>Полис должен быть полностью оплачен вперед, иначе в выдаче визы будет отказано.</li>
            </ul>
        `
    },
    {
        id: 'prep-accommodation',
        title: 'Подтверждение о проживании (Ubytování)',
        cost: 'по договору аренды',
        category: 'municipal',
        badge: 'Документы',
        deadline: 'подпись не старше 180 дней',
        urgency: 'warning',
        desc: 'Официальный документ, доказывающий наличие жилья в Чехии на весь срок запрашиваемой визы.',
        shouldShow: (f) => true,
        instructionHtml: `
            <h4>Оформление подтверждения о проживании:</h4>
            <p>МВД Чехии принимает два основных типа документов:</p>
            <ul>
                <li><strong>Doklad o zajištění ubytování</strong> (официальный бланк OAMP). Подпись собственника недвижимости (или доверенного лица) должна быть нотариально заверена (на любой почте с CzechPoint).</li>
                <li><strong>Nájemní smlouva</strong> (договор аренды). Нотариально заверять подписи не требуется, однако рекомендуется приложить распечатку выписки из Кадастра недвижимости (*Výpis z katastru nemovitostí*).</li>
            </ul>
        `
    },
    {
        id: 'prep-funds',
        title: 'Выписка из банка о наличии средств',
        cost: 'от 90 000 CZK (~3 600 €)',
        category: 'tax',
        badge: 'Документы',
        deadline: 'выписка не старше 180 дней',
        urgency: 'warning',
        desc: 'Подтверждение вашей финансовой состоятельности для проживания в стране.',
        shouldShow: (f) => f.purpose === 'student' || f.purpose === 'other' || f.purpose === 'osvc',
        instructionHtml: `
            <h4>Подтверждение финансовых средств:</h4>
            <p>Необходимая сумма на счете рассчитывается на основе прожиточного минимума Чехии.</p>
            <ul>
                <li>Для студенческой визы на 1 год требуется показать около 90 000 CZK (на 2 года — около 140 000 CZK).</li>
                <li>Справка выдается банком на чешском языке. Если справка на другом языке, требуется судебный перевод на чешский (*soudní překlad*).</li>
                <li>К справке зарубежного банка необходимо приложить действующую международную карту на ваше имя.</li>
            </ul>
        `
    },
    {
        id: 'prep-osvc-reg',
        title: 'Регистрация ИП в Живностенском уряде',
        cost: '1 000 CZK (~40 €) (Госпошлина)',
        category: 'tax',
        badge: 'Регистрация',
        deadline: 'до подачи на визу OSVČ',
        urgency: 'warning',
        desc: 'Оформление лицензии и выписки из реестра предпринимателей (Živnostenský list) для будущей подачи на визу.',
        shouldShow: (f) => (f.stage === 'preparing' && f.purpose === 'osvc') || (f.stage === 'waiting' && f.isSecondaryOsvc),
        cta: {
            label: 'Помощь в открытии',
            title: 'Регистрация ИП (OSVČ) под ключ',
            desc: 'Зарегистрируем вам лицензию Живности, получим выписку из реестра, предоставим юридический адрес и зарегистрируем в налоговой за 3 рабочих дня.',
            price: '2 500 CZK (~100 €)',
            btnText: 'Заказать открытие ИП под ключ',
            actionId: 'order-osvc-setup'
        },
        instructionHtml: `
            <h4>Регистрация лицензии OSVČ:</h4>
            <p>Чтобы податься на визу с целью предпринимательства, вы должны сначала открыть само предпринимательство в Чехии.</p>
            <ol>
                <li>Предоставьте справку об отсутствии судимости из вашей страны с судебным переводом.</li>
                <li>Оформите согласие собственника квартиры на размещение юридического адреса (*Souhlas s umístěním sídla*).</li>
                <li>Заполните анкету в любом Живностенском уряде и оплатите пошлину 1000 CZK. Через 3 дня у вас будет готовое IČO.</li>
            </ol>
        `
    }
];

function isMonthlyTask(id) {
    const monthlyIds = ['vzp-main', 'cssz-main', 'flat-tax', 'tv-radio-license'];
    return monthlyIds.includes(id);
}

function getCurrentYearMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}`;
}

function getCurrentMonthName() {
    const months = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
    return months[new Date().getMonth()];
}

function updatePillVisibilityAndLabels() {
    const isOsvc = state.filters.purpose === 'osvc';
    const isPreparing = state.filters.stage === 'preparing';
    
    if (isPreparing) {
        rowExtraToggles.style.display = 'none';
    } else {
        rowExtraToggles.style.display = 'flex';
        
        // Flat tax is only shown if primary OSVČ (not secondary)
        pillFlatTax.style.display = (isOsvc && !state.filters.isSecondaryOsvc) ? 'inline-block' : 'none';
        
        // Secondary OSVČ is visible for everyone (employees, students, primary OSVČ)
        pillSecondaryOsvc.style.display = 'inline-block';
        
        // Update label text based on stay purpose
        const label = pillSecondaryOsvc.querySelector('.pill-checkmark');
        if (label) {
            if (isOsvc) {
                label.textContent = 'ИП как доп. деятельность';
            } else {
                label.textContent = 'Открыто ИП (OSVČ Vedlejší)';
            }
        }
    }
}

// INITIALIZATION
function initApp() {
    loadState();
    syncUIWithState();
    
    // Bind segment tabs
    bindTabs(tabBtnsPurpose, 'purpose', (val) => {
        if (val !== 'osvc') {
            state.filters.flatTax = false;
            checkFlatTax.checked = false;
        }
        updatePillVisibilityAndLabels();
    });
    
    bindTabs(tabBtnsStage, 'stage', (val) => {
        if (val === 'preparing') {
            state.filters.isSecondaryOsvc = false;
            state.filters.flatTax = false;
            state.filters.hasDog = false;
            state.filters.ownsProperty = false;
            state.filters.hasCar = false;
            
            checkSecondaryOsvc.checked = false;
            checkFlatTax.checked = false;
            checkHasDog.checked = false;
            checkOwnsProperty.checked = false;
            checkHasCar.checked = false;
        }
        updatePillVisibilityAndLabels();
    });
    bindTabs(tabBtnsCity, 'city');

    // Bind checkboxes/switches with callbacks to avoid mutual exclusion conflicts
    const bindToggle = (el, key, onChange) => {
        el.addEventListener('change', (e) => {
            state.filters[key] = e.target.checked;
            if (onChange) onChange(e.target.checked);
            saveState();
            renderChecklist();
        });
    };

    bindToggle(checkHasDog, 'hasDog');
    bindToggle(checkOwnsProperty, 'ownsProperty');
    bindToggle(checkHasCar, 'hasCar');
    bindToggle(checkFlatTax, 'flatTax', (checked) => {
        if (checked) {
            state.filters.isSecondaryOsvc = false;
            checkSecondaryOsvc.checked = false;
        }
        updatePillVisibilityAndLabels();
    });
    bindToggle(checkSecondaryOsvc, 'isSecondaryOsvc', (checked) => {
        if (checked) {
            state.filters.flatTax = false;
            checkFlatTax.checked = false;
        }
        updatePillVisibilityAndLabels();
    });

    if (btnResetFilters) {
        btnResetFilters.addEventListener('click', resetFilters);
    }

    // Modal checkout bindings
    if (btnCloseCheckout) {
        btnCloseCheckout.addEventListener('click', () => modalCheckout.classList.remove('active'));
    }
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', handleCheckoutSubmit);
    }
    window.addEventListener('click', (e) => {
        if (e.target === modalCheckout) {
            modalCheckout.classList.remove('active');
        }
    });

    if (btnWidgetConnect) {
        btnWidgetConnect.addEventListener('click', () => {
            if (state.filters.oampMonitoringActive) {
                alert("Вы будете перенаправлены в Telegram-бот для управления подпиской.");
            } else {
                const botCta = {
                    label: 'Premium Бот',
                    title: 'Telegram-проверка писем без лимитов',
                    desc: 'Наш бот будет автоматически проверять вашу Datová Schránka или номер дела FRS и присылать уведомления прямо в Telegram.',
                    price: '79 CZK (~3 €) / мес',
                    btnText: 'Подключить Telegram-бота',
                    actionId: 'order-telegram-bot'
                };
                openCheckoutModal(botCta);
            }
        });
    }

    renderChecklist();
}

// BIND ONBOARDING TABS LOGIC
function bindTabs(tabList, key, callback) {
    tabList.forEach(btn => {
        btn.addEventListener('click', () => {
            tabList.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            state.filters[key] = btn.dataset.value;
            if (callback) callback(btn.dataset.value);
            
            saveState();
            renderChecklist();
        });
    });
}

// STORAGE SAVING & LOADING
function loadState() {
    try {
        const savedFilters = localStorage.getItem(STORAGE_FILTERS_KEY);
        if (savedFilters) {
            state.filters = JSON.parse(savedFilters);
        }
        
        const savedCompleted = localStorage.getItem(STORAGE_COMPLETED_KEY);
        if (savedCompleted) {
            state.completedTasks = JSON.parse(savedCompleted);
        }
    } catch (e) {
        console.error("Error loading localStorage state:", e);
    }
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_FILTERS_KEY, JSON.stringify(state.filters));
        localStorage.setItem(STORAGE_COMPLETED_KEY, JSON.stringify(state.completedTasks));
    } catch (e) {
        console.error("Error saving localStorage state:", e);
    }
}

function syncUIWithState() {
    // Set active class on correct tab buttons
    tabBtnsPurpose.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === state.filters.purpose);
    });
    tabBtnsStage.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === state.filters.stage);
    });
    tabBtnsCity.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === state.filters.city);
    });
    
    checkHasDog.checked = state.filters.hasDog;
    checkOwnsProperty.checked = state.filters.ownsProperty;
    checkHasCar.checked = state.filters.hasCar;
    checkFlatTax.checked = state.filters.flatTax;
    checkSecondaryOsvc.checked = state.filters.isSecondaryOsvc;

    // Update sub-options visibility
    updatePillVisibilityAndLabels();
}

function resetFilters() {
    state.filters = {
        purpose: 'employee',
        stage: 'waiting',
        city: 'prague',
        hasDog: false,
        ownsProperty: false,
        hasCar: false,
        flatTax: false,
        isSecondaryOsvc: false
    };
    saveState();
    syncUIWithState();
    renderChecklist();
}

// TASK CARD RENDERING HELPER
function renderTaskCard(task) {
    const isChecked = isMonthlyTask(task.id)
        ? state.completedTasks[task.id] === getCurrentYearMonth()
        : !!state.completedTasks[task.id];

    const card = document.createElement('div');
    card.className = `checklist-task-card ${isChecked ? 'task-checked' : ''}`;
    card.id = `task-card-${task.id}`;

    let urgencyClass = '';
    if (task.urgency === 'danger') urgencyClass = 'danger';
    if (task.urgency === 'info') urgencyClass = 'info';

    // Check if there is a monetization CTA
    let ctaBlockHtml = '';
    if (task.cta) {
        ctaBlockHtml = `
            <div class="cta-box" id="cta-${task.id}">
                <div class="cta-text-area">
                    <span class="cta-label">${task.cta.label}</span>
                    <span class="cta-title">${task.cta.title}</span>
                    <p class="cta-desc">${task.cta.desc}</p>
                </div>
                <div class="cta-price-box">
                    <span class="cta-price">${task.cta.price}</span>
                    <button class="btn-cta" id="btn-cta-${task.id}">${task.cta.btnText}</button>
                </div>
            </div>
        `;
    }

    const displayTitle = (isChecked && isMonthlyTask(task.id))
        ? `${task.title} <span class="monthly-badge" style="font-size: 0.75rem; color: var(--color-success); font-weight: bold; margin-left: 0.5rem; vertical-align: middle;">✓ Оплачено за ${getCurrentMonthName()}</span>`
        : task.title;

    card.innerHTML = `
        <div class="task-main-row">
            <label class="checkbox-tap-zone" for="chk-${task.id}">
                <div class="checkbox-container">
                    <input type="checkbox" id="chk-${task.id}" ${isChecked ? 'checked' : ''}>
                    <span class="checkbox-checkmark"></span>
                </div>
            </label>
            <div class="task-content">
                <div class="task-header">
                    <span class="task-title">${displayTitle}</span>
                    <span class="task-cost-badge">${task.cost}</span>
                </div>
                <div class="task-sub-row">
                    <span class="task-deadline-minimal ${urgencyClass}">Срок: ${task.deadline}</span>
                    <span class="task-expand-label" id="btn-toggle-${task.id}">Подробнее ▾</span>
                </div>
                
                <!-- Datova Schranka simulation widget if applicable -->
                ${task.isSimRequired ? `
                    <div class="inline-ds-widget" id="ds-widget-container">
                        <div class="ds-header">
                            <span class="ds-name">DATOVÁ SCHRÁNKA SIMULATOR</span>
                            <div class="ds-indicator">
                                <span class="ds-pulse-dot"></span>
                                <span>Ящик Активен</span>
                            </div>
                        </div>
                        <div class="ds-msg-box" id="inline-ds-box">
                            📪 Почтовый ящик пуст. Нет входящих писем.
                        </div>
                        <div class="ds-sim-btn-group">
                            <button class="btn btn-secondary btn-xs" id="btn-inline-sim-tax" style="flex: 1;">Письмо из Налоговой</button>
                            <button class="btn btn-secondary btn-xs" id="btn-inline-sim-police" style="flex: 1;">Письмо из Полиции</button>
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
        <div class="task-instruction-block" id="instruction-${task.id}">
            <div class="instruction-content">
                <div class="instruction-desc-highlight"><strong>Что нужно сделать:</strong> ${task.desc}</div>
                ${task.instructionHtml}
                ${ctaBlockHtml}
            </div>
        </div>
    `;

    checklistTasks.appendChild(card);

    // BIND CHECKBOX
    const checkbox = card.querySelector(`#chk-${task.id}`);
    checkbox.addEventListener('change', (e) => {
        toggleTaskCompleted(task.id, e.target.checked);
    });

    // BIND COLLAPSE/EXPAND
    const mainRow = card.querySelector('.task-content');
    const toggleBtn = card.querySelector(`#btn-toggle-${task.id}`);
    
    const toggleInstruction = (e) => {
        if (e.target.closest('#ds-widget-container') || e.target.closest('.instruction-link') || e.target.closest('.cta-box') || e.target.closest('button')) {
            return;
        }
        
        const block = card.querySelector(`#instruction-${task.id}`);
        const isExpanded = block.classList.toggle('expanded');
        toggleBtn.textContent = isExpanded ? 'Скрыть ▴' : 'Подробнее ▾';
    };

    mainRow.addEventListener('click', toggleInstruction);
    
    // BIND MONETIZATION CTA ACTION BUTTON
    if (task.cta) {
        const ctaBtn = card.querySelector(`#btn-cta-${task.id}`);
        ctaBtn.addEventListener('click', () => {
            openCheckoutModal(task.cta);
        });
    }
    
    // DS SIMULATION ACTION
    if (task.isSimRequired) {
        const btnTax = card.querySelector('#btn-inline-sim-tax');
        const btnPolice = card.querySelector('#btn-inline-sim-police');
        
        btnTax.addEventListener('click', (e) => {
            e.stopPropagation();
            triggerDsSimulation('Finanční úřad (Налоговая инспекция)', 'Требование об уплате пени по подоходному налогу за 2025 год');
        });
        btnPolice.addEventListener('click', (e) => {
            e.stopPropagation();
            triggerDsSimulation('OAMP MV ČR (Министерство внутренних дел)', 'Уведомление о необходимости донести договор страхования на ребенка');
        });
    }
}

// OAMP MONITORING WIDGET RENDERING
function renderOampWidget() {
    const isPreparing = state.filters.stage === 'preparing';
    
    // Only show OAMP widget if in CZ (stage === 'waiting')
    if (isPreparing) {
        oampWidget.style.display = 'none';
        return;
    }
    
    oampWidget.style.display = 'block';
    
    if (state.filters.oampMonitoringActive) {
        oampWidget.className = 'oamp-monitoring-widget active-success';
        oampStatusText.textContent = 'Мониторинг МВД активен';
        oampWidgetDesc.innerHTML = '<strong>Мониторинг активен:</strong> Ваша система авто-проверки регулярно опрашивает базы FRS. Номер дела: FRS-12345/DP-2026. Входящих писем или вызовов не обнаружено. Последняя проверка: только что.';
        btnWidgetConnect.textContent = 'Управление подпиской';
        btnWidgetConnect.classList.remove('btn-primary');
        btnWidgetConnect.classList.add('btn-secondary');
    } else {
        oampWidget.className = 'oamp-monitoring-widget active-danger';
        oampStatusText.textContent = 'Мониторинг отключен';
        oampWidgetDesc.textContent = 'Мы не проверяем состояние вашего дела в МВД Чехии. Вы рискуете пропустить требование о доносе документов (вызов к доложению) и получить отказ в визе.';
        btnWidgetConnect.textContent = 'Подключить авто-проверку МВД';
        btnWidgetConnect.classList.remove('btn-secondary');
        btnWidgetConnect.classList.add('btn-primary');
    }
}

// RENDERING CHECKLIST WITH CATEGORIES AND CONDITIONALS
function renderChecklist() {
    renderOampWidget();
    
    checklistTasks.innerHTML = '';
    
    // Filter tasks based on status
    const activeTasks = tasksDatabase.filter(task => task.shouldShow(state.filters));
    
    if (activeTasks.length === 0) {
        checklistTasks.innerHTML = '<p style="color: var(--color-text-dim); text-align: center; padding: 2rem;">Нет подходящих обязательств для выбранных фильтров.</p>';
        updateProgress(0, 0);
        return;
    }

    let completedCount = 0;
    activeTasks.forEach(task => {
        const isChecked = isMonthlyTask(task.id)
            ? state.completedTasks[task.id] === getCurrentYearMonth()
            : !!state.completedTasks[task.id];
        if (isChecked) completedCount++;
    });

    updateProgress(completedCount, activeTasks.length);

    const isPreparing = state.filters.stage === 'preparing';

    if (isPreparing) {
        // Abroad Mode: Flat List of Prep tasks
        activeTasks.forEach(task => {
            renderTaskCard(task);
        });
    } else {
        // Living in CZ Mode: Grouped Tasks
        const regularTasks = activeTasks.filter(t => !t.id.startsWith('prep-'));
        const prepTasks = activeTasks.filter(t => t.id.startsWith('prep-'));
        
        if (regularTasks.length > 0) {
            const heading = document.createElement('h3');
            heading.className = 'checklist-group-heading';
            heading.innerHTML = 'Текущие платежи и налоги';
            checklistTasks.appendChild(heading);
            
            regularTasks.forEach(task => {
                renderTaskCard(task);
            });
        }
        
        if (prepTasks.length > 0) {
            const heading = document.createElement('h3');
            heading.className = 'checklist-group-heading';
            heading.innerHTML = 'Документы для продления';
            checklistTasks.appendChild(heading);
            
            prepTasks.forEach(task => {
                renderTaskCard(task);
            });
        }
    }
}

function toggleTaskCompleted(taskId, isChecked) {
    const task = tasksDatabase.find(t => t.id === taskId);
    if (isChecked) {
        state.completedTasks[taskId] = isMonthlyTask(taskId) ? getCurrentYearMonth() : true;
    } else {
        delete state.completedTasks[taskId];
    }
    saveState();
    
    const card = document.getElementById(`task-card-${taskId}`);
    if (card) {
        card.classList.toggle('task-checked', isChecked);
        
        // Update monthly badge dynamically inside title
        const titleEl = card.querySelector('.task-title');
        if (titleEl && isMonthlyTask(taskId)) {
            if (isChecked) {
                titleEl.innerHTML = `${task.title} <span class="monthly-badge" style="font-size: 0.75rem; color: var(--color-success); font-weight: bold; margin-left: 0.5rem; vertical-align: middle;">✓ Оплачено за ${getCurrentMonthName()}</span>`;
            } else {
                titleEl.innerHTML = task.title;
            }
        }
    }
    
    const activeTasks = tasksDatabase.filter(task => task.shouldShow(state.filters));
    let completedCount = 0;
    activeTasks.forEach(task => {
        const checked = isMonthlyTask(task.id)
            ? state.completedTasks[task.id] === getCurrentYearMonth()
            : !!state.completedTasks[task.id];
        if (checked) completedCount++;
    });
    updateProgress(completedCount, activeTasks.length, true);
}

function updateProgress(completed, total, triggerToast = false) {
    const oldPercentage = parseInt(progressBarFill.style.width) || 0;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    progressText.textContent = `Выполнено ${completed} из ${total} обязательств`;
    progressBarFill.style.width = `${percentage}%`;

    if (progressBadge) {
        if (percentage === 100) {
            progressBadge.classList.add('completed');
        } else {
            progressBadge.classList.remove('completed');
        }
    }

    if (triggerToast && percentage !== oldPercentage) {
        showToast(completed, total, oldPercentage, percentage);
    }
}

// INLINE DATOVA SCHRANKA SIMULATION
function triggerDsSimulation(sender, subject) {
    const box = document.getElementById('inline-ds-box');
    if (!box) return;

    if (state.dsSimulation.active) {
        clearInterval(state.dsSimulation.timerInterval);
    }

    state.dsSimulation.active = true;
    state.dsSimulation.sender = sender;
    state.dsSimulation.subject = subject;
    state.dsSimulation.daysLeft = 10.0;

    const renderSimulatorUI = () => {
        const isUrgent = state.dsSimulation.daysLeft <= 3.0;
        box.style.textAlign = 'left';
        box.style.borderColor = isUrgent ? 'var(--color-danger)' : 'var(--border-glass)';
        box.innerHTML = `
            <div style="font-size: 0.75rem; color: var(--color-secondary); margin-bottom: 0.25rem;">
                Отправитель: <strong>${state.dsSimulation.sender}</strong>
            </div>
            <div style="font-weight: 700; font-size: 0.85rem; margin-bottom: 0.5rem;">
                ${state.dsSimulation.subject}
            </div>
            <div style="background: ${isUrgent ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.06)'}; border: 1px solid ${isUrgent ? 'var(--color-danger)' : 'rgba(245,158,11,0.2)'}; padding: 0.5rem; border-radius: 4px; font-size: 0.75rem;">
                <span style="color: ${isUrgent ? 'var(--color-danger)' : 'var(--color-warning)'}; font-weight: 700;">
                    Таймер фикции доставки: ${state.dsSimulation.daysLeft} дней
                </span>
            </div>
            <button class="btn btn-primary btn-xs" style="width: 100%; margin-top: 0.5rem;" id="btn-read-ds-sim">
                Открыть и прочитать письмо
            </button>
        `;
        
        const readBtn = box.querySelector('#btn-read-ds-sim');
        readBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            readDsSimulationMessage();
        });
    };

    renderSimulatorUI();

    state.dsSimulation.timerInterval = setInterval(() => {
        if (state.dsSimulation.daysLeft > 0.1) {
            state.dsSimulation.daysLeft = (state.dsSimulation.daysLeft - 0.1).toFixed(1);
            renderSimulatorUI();
        } else {
            clearInterval(state.dsSimulation.timerInterval);
            state.dsSimulation.daysLeft = 0;
            triggerDsFictionDoručení();
        }
    }, 700);
}

function readDsSimulationMessage() {
    clearInterval(state.dsSimulation.timerInterval);
    state.dsSimulation.active = false;
    alert(`Письмо от "${state.dsSimulation.sender}" прочитано!\n\nОфициальная дата вручения зафиксирована. Вы остановили таймер фикции доставки.`);
    resetDsSimulatorWidget();
}

function triggerDsFictionDoručení() {
    const box = document.getElementById('inline-ds-box');
    if (!box) return;

    box.style.textAlign = 'left';
    box.style.borderColor = 'var(--color-danger)';
    box.innerHTML = `
        <div style="color: var(--color-danger); font-weight: bold; font-size: 0.8rem; margin-bottom: 0.25rem;">
            КРИТИЧЕСКИЙ СРОК: ФИКЦИЯ ДОСТАВКИ (FIKCE DORUČENÍ)
        </div>
        <div style="font-size: 0.75rem; margin-bottom: 0.5rem; color: var(--color-text-muted);">
            Документ от <strong>${state.dsSimulation.sender}</strong> считается официально врученным! Вы пропустили 10-дневный срок проверки ящика. Начался отсчет сроков уплаты пеней/штрафов.
        </div>
        <button class="btn btn-secondary btn-xs" style="width: 100%;" id="btn-reset-ds-sim">
            Сбросить симулятор
        </button>
    `;

    const resetBtn = box.querySelector('#btn-reset-ds-sim');
    resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetDsSimulatorWidget();
    });
}

function resetDsSimulatorWidget() {
    state.dsSimulation.active = false;
    const box = document.getElementById('inline-ds-box');
    if (box) {
        box.style.textAlign = 'center';
        box.style.borderColor = 'var(--border-glass)';
        box.innerHTML = 'Почтовый ящик пуст. Нет входящих писем.';
    }
}

// MONETIZATION CHECKOUT DIALOG
function openCheckoutModal(cta) {
    state.currentCheckoutActionId = cta.actionId;
    checkoutTitle.textContent = cta.title;
    checkoutDesc.textContent = `${cta.desc} Стоимость услуги: ${cta.price}`;
    
    // Clear inputs
    document.getElementById('check-name').value = '';
    document.getElementById('check-contact').value = '';
    
    modalCheckout.classList.add('active');
}

function handleCheckoutSubmit() {
    const name = document.getElementById('check-name').value;
    const contact = document.getElementById('check-contact').value;
    const title = checkoutTitle.textContent;
    
    modalCheckout.classList.remove('active');
    
    // If it was OAMP telegram bot order, activate widget state
    if (state.currentCheckoutActionId === 'order-telegram-bot') {
        state.filters.oampMonitoringActive = true;
        saveState();
        renderOampWidget();
    }
    
    // Show mock order confirmation
    alert(`🎉 Заявка принята!\n\nСпасибо, ${name}!\nМы получили ваш заказ на: "${title}".\nНаш специалист свяжется с вами по контакту "${contact}" в течение 1 часа.`);
}

// FLOATING TOAST NOTIFICATIONS
function showToast(completed, total, oldPercentage, newPercentage) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const isIncrease = newPercentage >= oldPercentage;
    let toast = container.querySelector('.toast-notification');
    let fillElement;
    
    if (toast) {
        // Reuse existing toast!
        toast.className = `toast-notification ${isIncrease ? 'success' : 'info'}`;
        
        const stepsElement = toast.querySelector('.toast-progress-steps');
        if (stepsElement) {
            stepsElement.textContent = `Выполнено ${completed} из ${total}`;
            stepsElement.className = `toast-progress-steps ${isIncrease ? 'success' : 'info'}`;
        }
        
        fillElement = toast.querySelector('#toast-bar-fill');
        if (fillElement) {
            fillElement.style.width = `${newPercentage}%`;
        }

        const toastBadge = toast.querySelector('#toast-progress-badge');
        if (toastBadge) {
            if (newPercentage === 100) {
                toastBadge.classList.add('completed');
            } else {
                toastBadge.classList.remove('completed');
            }
        }
        
        if (toast.removeTimeout) {
            clearTimeout(toast.removeTimeout);
        }
    } else {
        // Create new toast
        toast = document.createElement('div');
        toast.className = `toast-notification ${isIncrease ? 'success' : 'info'}`;
        
        toast.innerHTML = `
            <div class="toast-progress-content">
                <div class="toast-progress-header">
                    <span class="toast-progress-title">Уровень безопасности</span>
                    <span class="toast-progress-steps ${isIncrease ? 'success' : 'info'}">
                        Выполнено ${completed} из ${total}
                    </span>
                </div>
                <div class="toast-progress-bar-wrapper">
                    <div class="toast-progress-bar-container">
                        <div class="toast-progress-bar-fill" id="toast-bar-fill" style="width: ${oldPercentage}%"></div>
                    </div>
                    <div class="toast-progress-target-badge ${newPercentage === 100 ? 'completed' : ''}" id="toast-progress-badge">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="toast-shield-icon">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        </svg>
                    </div>
                </div>
            </div>
        `;
        
        container.appendChild(toast);
        
        fillElement = toast.querySelector('#toast-bar-fill');
        fillElement.getBoundingClientRect(); // Force reflow
        
        setTimeout(() => {
            fillElement.style.width = `${newPercentage}%`;
        }, 50);
    }
    
    // Set/reset the removal timeout
    toast.removeTimeout = setTimeout(() => {
        toast.classList.add('toast-fadeout');
        setTimeout(() => {
            toast.remove();
        }, 250);
    }, 2800);
}

// START ON LOAD
document.addEventListener('DOMContentLoaded', initApp);
