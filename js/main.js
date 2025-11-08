// Main application logic for the construction calculator PWA.
//
// This script renders the list of available calculators, handles user
// interaction for both generic calculators (where formulas are defined
// declaratively in calculatorsData) and the specialised paint calculator,
// validates input, updates results reactively, and persists last used
// values in localStorage. It also exposes simple sharing functionality.

(() => {
  
  // ---------------------------------------------------------------------------
  // UI helpers: toast, theme toggle, tips panel
  // ---------------------------------------------------------------------------
  function showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1800);
  }

  // Theme toggle with persistence
  function applySavedTheme() {
    try {
      const t = localStorage.getItem('calc_theme');
      const root = document.documentElement;
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = t || (prefersDark ? 'dark' : 'light');
      root.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
    } catch(_) {}
  }
  function toggleTheme() {
    const root = document.documentElement;
    const isDark = root.getAttribute('data-theme') === 'dark';
    root.setAttribute('data-theme', isDark ? 'light' : 'dark');
    try { localStorage.setItem('calc_theme', isDark ? 'light' : 'dark'); } catch(_) {}
  }

  // Tips panel
  function showTips(text) {
    const panel = document.getElementById('tipsPanel');
    const body = document.getElementById('tipsBody');
    if (!panel || !body) return;
    body.textContent = text;
    panel.classList.add('show');
    panel.classList.remove('hidden');
    panel.setAttribute('aria-hidden','false');
  }
  function hideTips() {
    const panel = document.getElementById('tipsPanel');
    if (!panel) return;
    panel.classList.remove('show');
    setTimeout(() => panel.classList.add('hidden'), 200);
    panel.setAttribute('aria-hidden','true');
  }

  // Favorites helpers
  function getFavorites() {
    try {
      const raw = localStorage.getItem('calc_favorites');
      return raw ? JSON.parse(raw) : [];
    } catch(_) { return []; }
  }
  function setFavorites(arr) {
    try { localStorage.setItem('calc_favorites', JSON.stringify(arr)); } catch(_) {}
  }
  function isFavorite(id) { return getFavorites().includes(id); }
  function toggleFavorite(id) {
    const favs = getFavorites();
    const idx = favs.indexOf(id);
    if (idx >= 0) favs.splice(idx,1); else favs.push(id);
    setFavorites(favs);
    return favs.includes(id);
  }

  // Simple SVG icons by category
  function iconForCategory(cat) {
    const svgAttrs = 'viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
    switch ((cat||'').toLowerCase()) {
      case 'полы': return `<svg ${svgAttrs}><rect x="3" y="6" width="18" height="12" rx="1"/><path d="M3 12h18M9 6v12"/></svg>`;
      case 'краски': return `<svg ${svgAttrs}><circle cx="8" cy="8" r="3"/><path d="M11 11l8 8"/><rect x="13" y="13" width="8" height="3" rx="1"/></svg>`;
      case 'листы': return `<svg ${svgAttrs}><rect x="5" y="3" width="12" height="16" rx="1"/><path d="M9 7h6M9 11h6M9 15h6"/></svg>`;
      case 'смеси': return `<svg ${svgAttrs}><path d="M4 10l8-6 8 6-8 6-8-6z"/><path d="M4 14l8 6 8-6"/></svg>`;
      case 'отделка': return `<svg ${svgAttrs}><path d="M4 20h16"/><rect x="7" y="5" width="10" height="10" rx="2"/></svg>`;
      case 'прочее': return `<svg ${svgAttrs}><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/></svg>`;
      case 'антисептики': return `<svg ${svgAttrs}><rect x="6" y="3" width="12" height="6" rx="1"/><path d="M10 9v10a2 2 0 0 0 2 2 2 2 0 0 0 2-2V9"/><path d="M9 13h6"/></svg>`;
      default: return `<svg ${svgAttrs}><circle cx="12" cy="12" r="9"/></svg>`;
    }
  }

  // ---------------------------------------------------------------------------
  // Calculator definitions
  // ---------------------------------------------------------------------------
  // Each calculator describes its id, display title, category and fields.
  // Generic calculators rely on declarative formulas defined in `computed` and
  // `outputs`. The specialised paint calculator is handled separately.
  const calculatorsData = [
    {
      id: 'paint_wall',
      title: 'Краска',
      category: 'Краски'
      // fields and logic for paint handled in dedicated screen
    },
    {
      id: 'laminate_floor',
      title: 'Ламинат',
      category: 'Полы',
      fields: [
        { key: 'room_area', label: 'Площадь комнаты (м²)', type: 'number', default: 12 },
        { key: 'pack_area', label: 'Площадь одной пачки (м²)', type: 'number', default: 2.0 },
        { key: 'waste', label: 'Запас на подрезку (%)', type: 'number', default: 10 }
      ],
      computed: {
        total_area: 'room_area * (1 + waste/100)',
        packs: 'Math.ceil(total_area / pack_area)'
      },
      outputs: [
        { key: 'total_area', label: 'Площадь с запасом', format: 'м²' },
        { key: 'packs', label: 'Количество пачек', format: 'шт' }
      ]
    },
    {
      id: 'tile_floor',
      title: 'Плитка',
      category: 'Полы',
      fields: [
        { key: 'length', label: 'Длина комнаты (м)', type: 'number', default: 4 },
        { key: 'width', label: 'Ширина комнаты (м)', type: 'number', default: 3 },
        { key: 'tile_length', label: 'Длина плитки (см)', type: 'number', default: 30 },
        { key: 'tile_width', label: 'Ширина плитки (см)', type: 'number', default: 30 },
        { key: 'tiles_per_box', label: 'Плиток в коробке', type: 'integer', default: 10 }
      ],
      computed: {
        room_area: 'length * width',
        tile_area: '(tile_length/100) * (tile_width/100)',
        tiles_needed: 'Math.ceil((room_area * (1 + waste/100)) / tile_area)',
        boxes: 'Math.ceil(tiles_needed / tiles_per_box)'
      },
      outputs: [
        { key: 'tiles_needed', label: 'Требуется плиток', format: 'шт' },
        { key: 'boxes', label: 'Количество коробок', format: 'шт' }
      ]
    },
    {
      id: 'plaster',
      title: 'Штукатурка',
      category: 'Смеси',
      fields: [
        { key: 'brand', label: 'Производитель', type: 'select', options: [
            { value: 'rotband', label: 'Knauf Rotband' },
            { value: 'ceresit', label: 'Ceresit' },
            { value: 'knauf', label: 'Knauf MP75' },
            { value: 'other', label: 'Другое' }
          ], default: 'rotband' },
        { key: 'area', label: 'Площадь (м²)', type: 'number', default: 20 },
        { key: 'thickness', label: 'Толщина слоя (мм)', type: 'number', default: 10 },
        { key: 'bag_weight', label: 'Вес мешка (кг)', type: 'number', default: 25 }
      ],
      computed: {},
      outputs: [
        { key: 'kg_needed', label: 'Смесь', format: 'кг' },
        { key: 'bags', label: 'Мешков', format: 'шт' }
      ],
      hint: 'Для штукатурок нормальный расход на 1 мм: Rotband ~0.85 кг/м²·мм, Ceresit ~1.3, Knauf MP75 ~0.9. Сухая смесь размешивается водой согласно инструкции.'
    },
    {
      id: 'putty',
      title: 'Шпаклёвка',
      category: 'Смеси',
      fields: [
        { key: 'brand', label: 'Производитель', type: 'select', options: [
            { value: 'rotband', label: 'Knauf Rotband' },
            { value: 'ceresit', label: 'Ceresit' },
            { value: 'knauf', label: 'Knauf MP75' },
            { value: 'other', label: 'Другое' }
          ], default: 'rotband' },
        { key: 'area', label: 'Площадь (м²)', type: 'number', default: 20 },
        { key: 'thickness', label: 'Толщина слоя (мм)', type: 'number', default: 5 },
        { key: 'bag_weight', label: 'Вес мешка (кг)', type: 'number', default: 20 }
      ],
      computed: {},
      outputs: [
        { key: 'kg_needed', label: 'Материала', format: 'кг' },
        { key: 'bags', label: 'Мешков', format: 'шт' }
      ],
      hint: 'Расход шпаклёвок на 1 мм зависит от состава: Rotband ~0.85 кг/м²·мм, Ceresit ~1.3, Knauf MP75 ~0.9. Финишные слои обычно выполняют толщиной 1–3 мм.'
    },
    {
      id: 'screed',
      title: 'Стяжка',
      category: 'Смеси',
      fields: [
        { key: 'brand', label: 'Производитель', type: 'select', options: [
            { value: 'rotband', label: 'Knauf Rotband' },
            { value: 'ceresit', label: 'Ceresit' },
            { value: 'knauf', label: 'Knauf MP75' },
            { value: 'other', label: 'Другое' }
          ], default: 'rotband' },
        { key: 'area', label: 'Площадь (м²)', type: 'number', default: 20 },
        { key: 'thickness', label: 'Толщина слоя (см)', type: 'number', default: 5 },
        { key: 'bag_weight', label: 'Вес мешка (кг)', type: 'number', default: 25 }
      ],
      computed: {},
      outputs: [
        { key: 'kg_needed', label: 'Смесь', format: 'кг' },
        { key: 'bags', label: 'Мешков', format: 'шт' }
      ],
      hint: 'Расход стяжек зависит от марки и толщины: Rotband ≈18 кг/м²·см, Ceresit ≈20, Knauf MP75 ≈17. Введите площадь и толщину, чтобы узнать общий вес и число мешков.'
    },
    {
      id: 'wallpaper',
      title: 'Обои',
      category: 'Отделка',
      fields: [
        { key: 'perimeter', label: 'Периметр комнаты (м)', type: 'number', default: 14 },
        { key: 'height', label: 'Высота стен (м)', type: 'number', default: 2.5 },
        { key: 'wallpaper_type', label: 'Тип обоев', type: 'select', options: [
          { value: 'paper', label: 'Бумажные (0.53×10)' },
          { value: 'nonwoven', label: 'Флизелиновые (1.06×10)' },
          { value: 'vinyl', label: 'Виниловые (0.53×10)' },
          { value: 'custom', label: 'Другие' }
        ], default: 'paper' },
        // allow custom size override for "Другие"
        { key: 'roll_length', label: 'Длина рулона (м)', type: 'number', default: 10 },
        { key: 'roll_width', label: 'Ширина рулона (м)', type: 'number', default: 0.53 }
      ],
      computed: {},
      outputs: [ { key: 'rolls', label: 'Рулонов', format: 'шт' } ],
      hint: 'Для бумажных обоев стандартный рулон 0.53×10 м, флизелиновые — 1.06×10 м, виниловые — 0.53×10 м. Выберите тип или укажите свои размеры.'
    },
    {
      id: 'skirting',
      title: 'Плинтус',
      category: 'Отделка',
      fields: [
        { key: 'perimeter', label: 'Периметр комнаты (м)', type: 'number', default: 14 },
        { key: 'unit_length', label: 'Длина одного плинтуса (м)', type: 'number', default: 2.5 },
        { key: 'material', label: 'Материал', type: 'select', options: [
          { value: 'pvc', label: 'ПВХ' },
          { value: 'mdf', label: 'МДФ' },
          { value: 'poly', label: 'Полиуретан' }
        ], default: 'pvc' }
      ],
      computed: {},
      outputs: [
        { key: 'units', label: 'Штук', format: 'шт' },
        { key: 'clips', label: 'Клипс/крепежей', format: 'шт' }
      ],
      hint: 'Плинтусы крепятся на клипсы или саморезы: обычно требуется 5–7 крепежей на одну планку 2,5 м. Выберите материал для подсказок по монтажу.'
    },
    {
      id: 'drywall',
      title: 'ГКЛ (гипсокартон)',
      category: 'Листы',
      fields: [
        { key: 'area', label: 'Площадь (м²)', type: 'number', default: 20 },
        { key: 'sheet_length', label: 'Длина листа (м)', type: 'number', default: 2.5 },
        { key: 'sheet_width', label: 'Ширина листа (м)', type: 'number', default: 1.2 }
      ],
      computed: {},
      outputs: [
        { key: 'sheets', label: 'Листов', format: 'шт' },
        { key: 'profiles', label: 'Профилей (м)', format: 'м' },
        { key: 'screws', label: 'Саморезов', format: 'шт' }
      ],
      hint: 'На каждый м² гипсокартона требуется примерно 0,7 м металлического профиля и 20 саморезов. Учитывайте отходы и укрепляйте каркас должным образом.'
    },
    {
      id: 'insulation',
      title: 'Утеплитель',
      category: 'Листы',
      fields: [
        { key: 'area', label: 'Площадь (м²)', type: 'number', default: 20 },
        { key: 'layers', label: 'Количество слоёв', type: 'number', default: 1 },
        { key: 'pack_area', label: 'Площадь в одной упаковке (м²)', type: 'number', default: 5 },
        { key: 'waste', label: 'Запас (%)', type: 'number', default: 10 }
      ],
      computed: {
        total_area: 'area * layers * (1 + waste/100)',
        packs: 'Math.ceil(total_area / pack_area)'
      },
      outputs: [
        { key: 'packs', label: 'Упаковок', format: 'шт' }
      ],
      hint: 'Обычно утеплитель укладывают в 1–2 слоя. Площадь в упаковке берите с этикетки (часто 4–8 м²). Запас 5–10% нужен на подрезку и отходы.'
    }
    ,
    // Primer calculator for various types of грунтовка. Consumption rates are based on
    // typical values from manufacturer guidelines (g/m²)【324729247842237†L1708-L1715】. Results
    // are shown in литры assuming density ~1 kg/л.
    {
      id: 'primer',
      title: 'Грунтовка',
      category: 'Смеси',
      fields: [
        { key: 'area', label: 'Площадь (м²)', type: 'number', default: 10 },
        { key: 'primer_type', label: 'Тип грунтовки', type: 'select', options: [
          { value: 'acrylic', label: 'Акриловая' },
          { value: 'deep', label: 'Глубокого проникновения' },
          { value: 'water', label: 'Водно-дисперсионная' },
          { value: 'beton', label: 'Бетонконтакт' },
          { value: 'decorative', label: 'Декоративная' },
          { value: 'alkyd', label: 'Алкидная' },
          { value: 'universal', label: 'Универсальная' },
          { value: 'anticorrosive', label: 'Антикоррозийная' }
        ], default: 'acrylic' },
        { key: 'coats', label: 'Количество слоёв', type: 'integer', default: 1 }
      ],
      computed: {},
      outputs: [ { key: 'litres', label: 'Литры грунтовки', format: 'л' } ]
    },
    // Tile adhesive consumption based on trowel notch height. Typical values
    // correspond to 1.5 kg/m² for 4 мм зуб, 2.1 kg/m² для 6 мм, 2.7 kg/m² для 8 мм,
    // 3.4 kg/m² для 10 мм and 4.0 kg/m² для 12 мм【952252000273895†L150-L160】.
    {
      id: 'tile_adhesive',
      title: 'Клей для плитки',
      category: 'Смеси',
      fields: [
        { key: 'area', label: 'Площадь (м²)', type: 'number', default: 10 },
        { key: 'notch', label: 'Зуб шпателя (мм)', type: 'select', options: [
          { value: 4, label: '4' },
          { value: 6, label: '6' },
          { value: 8, label: '8' },
          { value: 10, label: '10' },
          { value: 12, label: '12' }
        ], default: 6 },
        { key: 'brand', label: 'Производитель', type: 'select', options: [
          { value: 'ceresit', label: 'Ceresit' },
          { value: 'unis', label: 'Unis' },
          { value: 'litokol', label: 'Litokol' },
          { value: 'mapei', label: 'Mapei' },
          { value: 'other', label: 'Другое' }
        ], default: 'ceresit' },
        { key: 'bag_weight', label: 'Вес мешка (кг)', type: 'number', default: 25 }
      ],
      computed: {},
      outputs: [ { key: 'kg_needed', label: 'Килограммы клея', format: 'кг' }, { key: 'bags', label: 'Мешков', format: 'шт' } ],
      hint: 'Расход клея зависит от высоты зуба шпателя и марки: 4 мм ≈1.5 кг/м², 6 мм ≈2.1, 8 мм ≈2.7, 10 мм ≈3.4, 12 мм ≈4.0. Unis потребляет ≈10% меньше, Litokol ≈10% больше. '
    },
    // Grout (затирка) consumption. The formula uses tile dimensions (мм), ширина
    // и глубина шва (мм) и коэффициент плотности K. Consumption ≈ ((A+B)/(A*B)) *
    // W * D * K * Площадь【549135066087638†L96-L114】.
    {
      id: 'grout',
      title: 'Затирка',
      category: 'Смеси',
      fields: [
        { key: 'area', label: 'Площадь (м²)', type: 'number', default: 10 },
        { key: 'tile_length', label: 'Длина плитки (мм)', type: 'number', default: 200 },
        { key: 'tile_width', label: 'Ширина плитки (мм)', type: 'number', default: 200 },
        { key: 'joint_width', label: 'Ширина шва (мм)', type: 'number', default: 3 },
        { key: 'joint_depth', label: 'Глубина шва (мм)', type: 'number', default: 5 },
        { key: 'grout_type', label: 'Тип затирки', type: 'select', options: [
          { value: 'cement', label: 'Цементная (1.8)' },
          { value: 'epoxy', label: 'Эпоксидная (1.6)' }
        ], default: 'cement' }
      ],
      computed: {},
      outputs: [ { key: 'kg', label: 'Килограммы затирки', format: 'кг' } ],
      hint: 'Упрощённо: чем толще шов и меньше плитка — тем больше расход. Для цементной затирки коэффициент K≈1.8, для эпоксидной ≈1.6. Эпоксидная дороже, но не боится воды и грязи, лучше для душевых и кухонных фартуков.'
    },
    // Electric underfloor heating. Recommended power per m² depends on помещение
    // (living/kitchen ~150 W, bathroom ~160 W, balcony/primary heating ~200 W)
    //【518430419152682†L126-L144】.
    {
      id: 'warm_floor_electric',
      title: 'Тёплый пол (электрический)',
      category: 'Полы',
      fields: [
        { key: 'area', label: 'Отапливаемая площадь (м²)', type: 'number', default: 5 },
        { key: 'room_type', label: 'Тип помещения', type: 'select', options: [
          { value: 'living', label: 'Комната/кухня' },
          { value: 'bathroom', label: 'Ванная/санузел' },
          { value: 'balcony', label: 'Балкон/основной обогрев' }
        ], default: 'living' },
        { key: 'cable_power', label: 'Мощность кабеля (Вт/м)', type: 'number', default: 17 }
      ],
      computed: {},
      outputs: [ { key: 'total_power', label: 'Общая мощность', format: 'Вт' }, { key: 'cable_length', label: 'Длина кабеля', format: 'м' } ]
    },
    // Water underfloor heating. Pipe length per м² depends on шаг укладки
    // (10 см → 10 м, 15 см → 6.7 м, 20 см → 5 м, 25 см → 4 м, 30 см → 3.4 м)【102936322231071†L640-L663】.
    {
      id: 'warm_floor_water',
      title: 'Тёплый пол (водяной)',
      category: 'Полы',
      fields: [
        { key: 'area', label: 'Площадь (м²)', type: 'number', default: 5 },
        { key: 'spacing', label: 'Шаг укладки (см)', type: 'select', options: [
          { value: 10, label: '10' },
          { value: 15, label: '15' },
          { value: 20, label: '20' },
          { value: 25, label: '25' },
          { value: 30, label: '30' }
        ], default: 15 }
      ],
      computed: {},
      outputs: [ { key: 'length', label: 'Длина трубы', format: 'м' } ]
    },
    // Armstrong ceiling materials per m²: 2.78 плит, 1.4 перекрёстных
    // профилей 0.6 м, 1.4 перекрёстных профилей 1.2 м, 0.233 основных
    // профилей 3.7 м и 0.7 подвесов【180868701451381†L420-L427】.
    {
      id: 'armstrong_ceiling',
      title: 'Потолок Армстронг',
      category: 'Потолки',
      fields: [ { key: 'area', label: 'Площадь (м²)', type: 'number', default: 10 } ],
      computed: {},
      outputs: [
        { key: 'tiles', label: 'Плиты (600×600)', format: 'шт' },
        { key: 'cross_0_6', label: 'Перекрёстные профили 0.6 м', format: 'шт' },
        { key: 'cross_1_2', label: 'Перекрёстные профили 1.2 м', format: 'шт' },
        { key: 'main_profiles', label: 'Основные профили 3.7 м', format: 'шт' },
        { key: 'hangers', label: 'Подвесы', format: 'шт' }
      ]
    },
    // Rolled roofing (рулонная кровля). Effective площадь одного рулона
    // ≈ (длина-0.10)×(ширина-0.06) из-за нахлёстов【822380218974558†L721-L729】.
    {
      id: 'rolled_roof',
      title: 'Рулонная кровля',
      category: 'Кровля',
      fields: [
        { key: 'area', label: 'Площадь (м²)', type: 'number', default: 20 },
        { key: 'layers', label: 'Слоёв', type: 'integer', default: 1 },
        { key: 'roll_length', label: 'Длина рулона (м)', type: 'number', default: 10 },
        { key: 'roll_width', label: 'Ширина рулона (м)', type: 'number', default: 1 }
      ],
      computed: {},
      outputs: [ { key: 'rolls', label: 'Рулонов', format: 'шт' } ]
    },
    // Sealant consumption. Volume per метр ≈ ширина * глубина (мм), or half
    // for треугольный шов【175800070693689†L90-L99】. Total объём / объём
    // картриджа = число картриджей.
    {
      id: 'sealant',
      title: 'Герметик',
      category: 'Герметики',
      fields: [
        { key: 'length', label: 'Суммарная длина швов (м)', type: 'number', default: 10 },
        { key: 'width', label: 'Ширина шва (мм)', type: 'number', default: 6 },
        { key: 'depth', label: 'Глубина шва (мм)', type: 'number', default: 6 },
        { key: 'shape', label: 'Форма шва', type: 'select', options: [
          { value: 'rect', label: 'Прямоугольник' },
          { value: 'tri', label: 'Треугольник' }
        ], default: 'rect' },
        { key: 'cartridge_volume', label: 'Объём картриджа (мл)', type: 'number', default: 300 }
      ],
      computed: {},
      outputs: [ { key: 'cartridges', label: 'Картриджей', format: 'шт' } ]
    },
    // Liquid nails consumption. Объём колбаски ≈ π·d²/4 × длина (м) / 1000
    // (мм² × м → мм³ → мл). Делим на объём картриджа.
    {
      id: 'liquid_nails',
      title: 'Жидкие гвозди',
      category: 'Клеи',
      fields: [
        { key: 'length', label: 'Длина нанесения (м)', type: 'number', default: 10 },
        { key: 'diameter', label: 'Диаметр валика (мм)', type: 'number', default: 6 },
        { key: 'cartridge_volume', label: 'Объём картриджа (мл)', type: 'number', default: 300 }
      ],
      computed: {},
      outputs: [ { key: 'cartridges', label: 'Картриджей', format: 'шт' } ]
    }
    ,
    // --- Sheet materials calculators ---
    {
      id: 'slate',
      title: 'Шифер',
      category: 'Листы',
      fields: [
        { key: 'area', label: 'Площадь (м²)', type: 'number', default: 20 },
        { key: 'slate_type', label: 'Тип шифера', type: 'select', options: [
            { value: '7_wave', label: '7‑волновой' },
            { value: '8_wave', label: '8‑волновой' }
          ], default: '7_wave' },
        { key: 'layers', label: 'Слоёв', type: 'integer', default: 1 }
      ],
      outputs: [
        { key: 'sheets', label: 'Листов', format: 'шт' },
        { key: 'profiles', label: 'Профилей (м)', format: 'м' },
        { key: 'screws', label: 'Саморезов', format: 'шт' }
      ],
      hint: 'Количество листов рассчитывается по рабочей площади листа с учётом нахлёстов; для каркаса примерно 0,7 м профиля и 15–20 саморезов на каждый квадратный метр.'
    },
    {
      id: 'osb',
      title: 'ОСБ',
      category: 'Листы',
      fields: [
        { key: 'area', label: 'Площадь (м²)', type: 'number', default: 20 },
        { key: 'sheet_length', label: 'Длина листа (м)', type: 'number', default: 2.5 },
        { key: 'sheet_width', label: 'Ширина листа (м)', type: 'number', default: 1.25 }
      ],
      outputs: [
        { key: 'sheets', label: 'Листов', format: 'шт' },
        { key: 'profiles', label: 'Профилей (м)', format: 'м' },
        { key: 'screws', label: 'Саморезов', format: 'шт' }
      ],
      hint: 'Для каркаса под листы ОСБ требуется примерно 0,7 м профиля на квадратный метр и 15–20 саморезов. Размер листа можно изменить при необходимости.'
    },
    {
      id: 'plywood',
      title: 'Фанера',
      category: 'Листы',
      fields: [
        { key: 'area', label: 'Площадь (м²)', type: 'number', default: 20 },
        { key: 'sheet_length', label: 'Длина листа (м)', type: 'number', default: 1.525 },
        { key: 'sheet_width', label: 'Ширина листа (м)', type: 'number', default: 1.525 }
      ],
      outputs: [
        { key: 'sheets', label: 'Листов', format: 'шт' },
        { key: 'profiles', label: 'Профилей (м)', format: 'м' },
        { key: 'screws', label: 'Саморезов', format: 'шт' }
      ],
      hint: 'При монтаже фанеры берите запас на каркас: около 0,7 м профиля и 15–20 саморезов на один квадратный метр.'
    },
    {
      id: 'fibreboard',
      title: 'ДВП/МДФ',
      category: 'Листы',
      fields: [
        { key: 'area', label: 'Площадь (м²)', type: 'number', default: 20 },
        { key: 'sheet_length', label: 'Длина листа (м)', type: 'number', default: 2.44 },
        { key: 'sheet_width', label: 'Ширина листа (м)', type: 'number', default: 1.22 }
      ],
      outputs: [
        { key: 'sheets', label: 'Листов', format: 'шт' },
        { key: 'profiles', label: 'Профилей (м)', format: 'м' },
        { key: 'screws', label: 'Саморезов', format: 'шт' }
      ],
      hint: 'ДВП/МДФ монтируется на каркас: примерно 0,7 м профиля и до 20 саморезов на квадратный метр.'
    },
    {
      id: 'chipboard',
      title: 'ДСП',
      category: 'Листы',
      fields: [
        { key: 'area', label: 'Площадь (м²)', type: 'number', default: 20 },
        { key: 'sheet_length', label: 'Длина листа (м)', type: 'number', default: 2.75 },
        { key: 'sheet_width', label: 'Ширина листа (м)', type: 'number', default: 1.83 }
      ],
      outputs: [
        { key: 'sheets', label: 'Листов', format: 'шт' },
        { key: 'profiles', label: 'Профилей (м)', format: 'м' },
        { key: 'screws', label: 'Саморезов', format: 'шт' }
      ],
      hint: 'Для листов ДСП необходим каркас: ориентируйтесь на 0,7 м профиля и 15–20 саморезов на квадратный метр.'
    }

    ,
    // Virtual calculator entry to open saved projects list. This has no fields
    // or outputs; when selected, the app will display a list of saved projects.
    {
      id: 'projects',
      title: 'Мои проекты',
      category: 'Прочее',
      fields: [],
      outputs: []
    }

    ,
    // --- New calculators: self‑levelling floors, CPS, mastics, ready putty etc. ---
    {
      id: 'self_leveling',
      title: 'Наливной пол',
      category: 'Полы',
      fields: [
        { key: 'area', label: 'Площадь (м²)', type: 'number', default: 20 },
        { key: 'thickness', label: 'Толщина слоя (мм)', type: 'number', default: 10 },
        { key: 'product', label: 'Тип смеси', type: 'select', options: [
          { value: 'gypsum', label: 'Гипсовая (1.5 кг/м²·мм)' },
          { value: 'cement', label: 'Цементная (1.8 кг/м²·мм)' },
          { value: 'premium', label: 'Премиум (2.0 кг/м²·мм)' }
        ], default: 'gypsum' },
        { key: 'bag_weight', label: 'Вес мешка (кг)', type: 'number', default: 25 }
      ],
      outputs: [
        { key: 'kg', label: 'Смеси (кг)', format: 'кг' },
        { key: 'bags', label: 'Мешков', format: 'шт' }
      ],
      hint: 'Для наливных полов ориентируйтесь на расход: гипсовые ≈1.5 кг/м²·мм, цементные ≈1.8, премиум‑составы до 2.0. Толщину берите по «верхней точке» пола. Запас 10–15% нужен на перепады и пролив по углам.'
    },
    {
      id: 'cps_mix',
      title: 'ЦПС (цементно‑песчаная смесь)',
      category: 'Полы',
      fields: [
        { key: 'area', label: 'Площадь (м²)', type: 'number', default: 20 },
        { key: 'thickness', label: 'Толщина слоя (см)', type: 'number', default: 5 },
        { key: 'composition', label: 'Состав', type: 'select', options: [
          { value: 'standard', label: 'Обычная (18 кг/м²·см)' },
          { value: 'reinforced', label: 'Усиленная (20 кг/м²·см)' }
        ], default: 'standard' },
        { key: 'bag_weight', label: 'Вес мешка (кг)', type: 'number', default: 25 }
      ],
      outputs: [
        { key: 'kg', label: 'Смеси (кг)', format: 'кг' },
        { key: 'bags', label: 'Мешков', format: 'шт' }
      ],
      hint: 'Цементно‑песчаная смесь расходуется примерно 18–20 кг/м²·см. Учитывайте толщину стяжки и обязательно армируйте её при больших нагрузках.'
    },
    {
      id: 'mastic',
      title: 'Мастика',
      category: 'Мастики',
      fields: [
        { key: 'area', label: 'Площадь (м²)', type: 'number', default: 10 },
        { key: 'thickness', label: 'Толщина слоя (мм)', type: 'number', default: 2 },
        { key: 'mastic_type', label: 'Тип мастики', type: 'select', options: [
          { value: 'roof', label: 'Кровельная (1.5 кг/м²·мм)' },
          { value: 'tile', label: 'Для кафеля (0.4 кг/м²·мм)' }
        ], default: 'roof' },
        { key: 'bucket_weight', label: 'Вес ведра (кг)', type: 'number', default: 20 }
      ],
      outputs: [
        { key: 'kg', label: 'Мастики (кг)', format: 'кг' },
        { key: 'buckets', label: 'Ведер', format: 'шт' }
      ],
      hint: 'Кровельные мастики обычно расходуются 1.5–2.0 кг/м²·мм, плиточные 0.3–0.5 кг/м²·мм. Делайте тонкие слои по основанию, не лейте «лужами». Между слоями давайте мастике схватиться, чтобы не поплыла.'
    },
    {
      id: 'ready_putty',
      title: 'Готовая шпаклёвка',
      category: 'Шпаклёвки',
      fields: [
        { key: 'area', label: 'Площадь (м²)', type: 'number', default: 20 },
    {
      id: 'antiseptic',
      title: 'Антисептики (дерево)',
      category: 'Антисептики',
      hint: 'Расход зависит от впитываемости: хвойные породы обычно потребляют меньше, чем берёза/бук. Для концентрата 1:5 расчёт ведётся по готовому раствору.',
      fields: [
        { key: 'area', label: 'Площадь обработки (м²)', type: 'number', default: 30 },
        { key: 'coats', label: 'Количество слоёв', type: 'number', default: 2 },
        { key: 'type', label: 'Тип продукта', type: 'select', options: [
            {value:'water', label:'Водорастворимый'},
            {value:'alkyd', label:'Масляный / алкидный'},
            {value:'concentrate', label:'Концентрат 1:5'},
            {value:'firebio', label:'Огнебио (повышенный расход)'}] , default: 'water' },
        { key: 'absorb', label: 'Впитываемость древесины', type: 'select', options: [
            {value:'low', label:'Низкая (плотная древесина)'},
            {value:'medium', label:'Средняя (сосна/ель)'},
            {value:'high', label:'Высокая (берёза и т.п.)'}], default: 'medium' },
        { key: 'pack', label: 'Объём канистры (л)', type: 'number', default: 5 },
        { key: 'waste', label: 'Запас, %', type: 'number', default: 10 }
      ],
      outputs: [
        { key: 'litres_ready', label: 'Литров готового раствора', format: 'л' },
        { key: 'concentrate', label: 'Из них концентрата', format: 'л' },
        { key: 'water', label: 'Воды добавить', format: 'л' },
        { key: 'cans', label: 'Канистры по объёму', format: 'шт' }
      ]
    },
        { key: 'thickness', label: 'Толщина слоя (мм)', type: 'number', default: 2 },
        { key: 'brand', label: 'Марка', type: 'select', options: [
          { value: 'terraco', label: 'Terraco Handycoat (1.8 кг/м²·мм)' },
          { value: 'ezskim', label: 'EZ‑Skim (1.7 кг/м²·мм)' },
          { value: 'generic', label: 'Обычная (1.2 кг/м²·мм)' }
        ], default: 'terraco' },
        { key: 'bucket_weight', label: 'Вес ведра (кг)', type: 'number', default: 25 }
      ],
      outputs: [
        { key: 'kg', label: 'Шпаклёвки (кг)', format: 'кг' },
        { key: 'buckets', label: 'Ведер', format: 'шт' }
      ],
      hint: 'Готовые шпаклёвки расходуются 1.2–1.8 кг/м²·мм в зависимости от марки. Плотные составы лучше для толстых слоёв, лёгкие – для финишной отделки.'
    }
  ];

  // ---------------------------------------------------------------------------
  // Local formula evaluator and custom calculators
  // ---------------------------------------------------------------------------
  /**
   * Evaluate declarative formulas for calculators that define a `computed` object.
   * Accepts a calculator definition and an inputs object, and returns an object
   * of computed values. The evaluator exposes the Math object so formulas can
   * use Math.ceil(), Math.floor(), etc. If evaluation fails, NaN is returned
   * for that value.
   * @param {Object} calc Calculator definition with `computed` formulas
   * @param {Object} inputs Raw input values keyed by field key
   */
  function evaluateLocalCalculator(calc, inputs) {
    const computed = {};
    if (!calc || !calc.computed) return computed;
    for (const key of Object.keys(calc.computed)) {
      const expr = calc.computed[key];
      try {
        const vars = { Math: Math, ...inputs, ...computed };
        computed[key] = Function(...Object.keys(vars), 'return ' + expr + ';')(...Object.values(vars));
      } catch (e) {
        computed[key] = NaN;
      }
    }
    return computed;
  }

  /**
   * Custom calculation functions for specific calculators. These functions
   * perform domain-specific computations outside of the declarative formula
   * evaluator. Each takes an inputs object and returns an object with
   * result keys matching the calculator's outputs.
   */
  function calcLaminate(inputs) {
    const length = parseFloat(inputs.length) || 0;
    const width = parseFloat(inputs.width) || 0;
    const packArea = parseFloat(inputs.pack_area) || 0;
    const waste = parseFloat(inputs.waste) || 0;
    const roomArea = length * width;
    const totalArea = roomArea * (1 + waste / 100);
    const packs = packArea > 0 ? Math.ceil(totalArea / packArea) : NaN;
    return {
      room_area: parseFloat(roomArea.toFixed(2)),
      packs: packs
    };
  }

  function calcTile(inputs) {
    const length = parseFloat(inputs.length) || 0;
    const width = parseFloat(inputs.width) || 0;
    const tileLength = parseFloat(inputs.tile_length) || 0;
    const tileWidth = parseFloat(inputs.tile_width) || 0;
    const tilesPerBox = parseInt(inputs.tiles_per_box, 10) || 0;
    const waste = parseFloat(inputs.waste) || 0;
    const roomArea = length * width;
    const tileArea = (tileLength / 100) * (tileWidth / 100);
    const totalArea = roomArea * (1 + waste / 100);
    const tilesNeeded = tileArea > 0 ? Math.ceil(totalArea / tileArea) : NaN;
    const boxes = tilesPerBox > 0 ? Math.ceil(tilesNeeded / tilesPerBox) : NaN;
    return {
      tiles_needed: tilesNeeded,
      boxes: boxes
    };
  }

  function calcPlaster(inputs) {
    const area = parseFloat(inputs.area) || 0;
    const thickness = parseFloat(inputs.thickness) || 0;
    let consumption = parseFloat(inputs.consumption) || 0;
    // Adjust consumption based on selected brand if provided
    if (inputs.brand) {
      const brand = inputs.brand;
      // Typical consumption rates (kg/m²/mm) for popular brands. Rotband ~0.85; Ceresit ~1.3; Knauf MP75 ~1.2
      const brandRates = {
        'rotband': 0.85,
        'ceresit': 1.3,
        'knauf': 1.2
      };
      if (brandRates[brand] !== undefined) {
        consumption = brandRates[brand];
      }
    }
    const bagWeight = parseFloat(inputs.bag_weight) || 0;
    const waste = parseFloat(inputs.waste) || 0;
    const kgNeeded = area * thickness * consumption * (1 + waste / 100);
    const bags = bagWeight > 0 ? Math.ceil(kgNeeded / bagWeight) : NaN;
    return {
      kg_needed: parseFloat(kgNeeded.toFixed(2)),
      bags: bags
    };
  }

  function calcPutty(inputs) {
    // For putty, adjust consumption by brand similar to plaster
    return calcPlaster(inputs);
  }

  function calcScreed(inputs) {
    const area = parseFloat(inputs.area) || 0;
    const thickness = parseFloat(inputs.thickness) || 0; // толщина в сантиметрах
    const bagWeight = parseFloat(inputs.bag_weight) || 0;
    const waste = parseFloat(inputs.waste) || 0;
    /*
     * Consumption rates per centimetre of screed (kg/m²·см) depend on the
     * manufacturer. Standard cement‑sand mixes consume ~18 kg/m²·см; heavier
     * compositions like Ceresit CN‑75/76 require ~20 kg/m²·см; Knauf MP75 ~17.
     */
    const brand = inputs.brand || 'rotband';
    const brandRates = {
      'rotband': 18,
      'ceresit': 20,
      'knauf': 17,
      'other': 18
    };
    const consumption = brandRates[brand] || 18;
    const kgRaw = area * thickness * consumption;
    const kg = kgRaw * (1 + waste / 100);
    const bags = bagWeight > 0 ? Math.ceil(kg / bagWeight) : NaN;
    return {
      kg_needed: parseFloat(kg.toFixed(2)),
      bags: bags
    };
  }

  function calcWallpaper(inputs) {
    const perimeter = parseFloat(inputs.perimeter) || 0;
    const height = parseFloat(inputs.height) || 0;
    let rollLength = parseFloat(inputs.roll_length) || 0;
    let rollWidth = parseFloat(inputs.roll_width) || 0;
    const waste = parseFloat(inputs.waste) || 0;
    const type = inputs.wallpaper_type || 'paper';
    // Override roll dimensions based on wallpaper type if not custom
    if (type !== 'custom') {
      const sizes = {
        paper: { length: 10, width: 0.53 },
        nonwoven: { length: 10, width: 1.06 },
        vinyl: { length: 10, width: 0.53 }
      };
      const sz = sizes[type];
      if (sz) {
        rollLength = sz.length;
        rollWidth = sz.width;
      }
    }
    const wallArea = perimeter * height;
    const totalArea = wallArea * (1 + waste / 100);
    const rollArea = rollLength * rollWidth;
    const rolls = rollArea > 0 ? Math.ceil(totalArea / rollArea) : NaN;
    return {
      rolls: rolls
    };
  }

  function calcSkirting(inputs) {
    const perimeter = parseFloat(inputs.perimeter) || 0;
    const unitLength = parseFloat(inputs.unit_length) || 0;
    const waste = parseFloat(inputs.waste) || 0;
    const totalLength = perimeter * (1 + waste / 100);
    const units = unitLength > 0 ? Math.ceil(totalLength / unitLength) : NaN;
    // Approximate number of clips/fasteners: 5 per plinth bar (2.5 m)
    const clips = Number.isFinite(units) ? units * 5 : NaN;
    return {
      units: units,
      clips: clips
    };
  }

  function calcDrywall(inputs) {
    const area = parseFloat(inputs.area) || 0;
    const sheetLength = parseFloat(inputs.sheet_length) || 0;
    const sheetWidth = parseFloat(inputs.sheet_width) || 0;
    const waste = parseFloat(inputs.waste) || 0;
    const totalArea = area * (1 + waste / 100);
    const sheetArea = sheetLength * sheetWidth;
    const sheets = sheetArea > 0 ? Math.ceil(totalArea / sheetArea) : NaN;
    const profiles = parseFloat((totalArea * 0.7).toFixed(2));
    const screws = Math.ceil(totalArea * 15);
    return {
      sheets: sheets,
      profiles: profiles,
      screws: screws
    };
  }

  function calcInsulation(inputs) {
    const area = parseFloat(inputs.area) || 0;
    const boardLength = parseFloat(inputs.board_length) || 0;
    const boardWidth = parseFloat(inputs.board_width) || 0;
    const waste = parseFloat(inputs.waste) || 0;
    const totalArea = area * (1 + waste / 100);
    const boardArea = boardLength * boardWidth;
    const boards = boardArea > 0 ? Math.ceil(totalArea / boardArea) : NaN;
    return {
      boards: boards
    };
  }

  // Sheet materials calculators
  function calcSlate(inputs) {
    const area = parseFloat(inputs.area) || 0;
    const waste = parseFloat(inputs.waste) || 0;
    const layers = parseInt(inputs.layers, 10) || 1;
    const type = inputs.slate_type || '7_wave';
    const workingAreas = {
      '7_wave': 1.33,
      '8_wave': 1.57
    };
    const sheetArea = workingAreas[type] || workingAreas['7_wave'];
    const totalArea = area * (1 + waste / 100) * layers;
    const sheets = sheetArea > 0 ? Math.ceil(totalArea / sheetArea) : NaN;
    // Approximate profile length: 0.7 m per m²; screws: 15 per m²
    const profiles = parseFloat((totalArea * 0.7).toFixed(2));
    const screws = Math.ceil(totalArea * 15);
    return { sheets: sheets, profiles: profiles, screws: screws };
  }

  function calcSheet(inputs) {
    const area = parseFloat(inputs.area) || 0;
    const length = parseFloat(inputs.sheet_length) || 0;
    const width = parseFloat(inputs.sheet_width) || 0;
    const waste = parseFloat(inputs.waste) || 0;
    const layers = parseInt(inputs.layers, 10) || 1;
    const totalArea = area * (1 + waste / 100) * layers;
    const sheetArea = length * width;
    const sheets = sheetArea > 0 ? Math.ceil(totalArea / sheetArea) : NaN;
    const profiles = parseFloat((totalArea * 0.7).toFixed(2));
    const screws = Math.ceil(totalArea * 15);
    return { sheets: sheets, profiles: profiles, screws: screws };
  }

  /**
   * Primer calculator. Consumption rates (g/m²) are assigned per type based on
   * typical manufacturer data: acrylic ~140, deep ~170, water ~120, beton
   * ~350, decorative ~200, alkyd ~120, universal ~120, anticorrosive ~100.
   * Litres = area × coats × rate / 1000 × (1 + waste/100).
   */
  function calcPrimer(inputs) {
    const area = parseFloat(inputs.area) || 0;
    const coats = parseInt(inputs.coats, 10) || 1;
    const waste = parseFloat(inputs.waste) || 0;
    const type = inputs.primer_type || 'acrylic';
    const rates = {
      acrylic: 140,
      deep: 170,
      water: 120,
      beton: 350,
      decorative: 200,
      alkyd: 120,
      universal: 120,
      anticorrosive: 100
    };
    const rate = rates[type] || 140;
    const litres = area * coats * rate / 1000 * (1 + waste / 100);
    return {
      litres: parseFloat(litres.toFixed(2))
    };
  }

  /**
   * Tile adhesive calculator. Consumption per m² depends on trowel tooth height.
   * Map from tooth (mm) to kg/m²: 4→1.5; 6→2.1; 8→2.7; 10→3.4; 12→4.0.
   */
  function calcTileAdhesive(inputs) {
    const area = parseFloat(inputs.area) || 0;
    const notch = parseFloat(inputs.notch) || 0;
    const bagWeight = parseFloat(inputs.bag_weight) || 0;
    const waste = parseFloat(inputs.waste) || 0;
    // Base consumption per m² for each notch height (kg/m²). Derived from
    // manufacturer tables【952252000273895†L150-L160】.
    const baseRates = {
      4: 1.5,
      6: 2.1,
      8: 2.7,
      10: 3.4,
      12: 4.0
    };
    // Brand adjustment factors. Adhesives like Unis consume ~10 % less than
    // Ceresit (1.16 kg vs 1.3), Litokol ~10 % more (1.5 kg), Mapei slightly
    // less. These coefficients modify the base rate.
    const brand = inputs.brand || 'ceresit';
    const brandFactors = {
      ceresit: 1.0,
      unis: 0.9,
      litokol: 1.1,
      mapei: 0.92,
      other: 1.0
    };
    const base = baseRates[notch] || 2.1;
    const factor = brandFactors[brand] || 1.0;
    const consumption = base * factor;
    const kgNeeded = area * consumption * (1 + waste / 100);
    const bags = bagWeight > 0 ? Math.ceil(kgNeeded / bagWeight) : NaN;
    return {
      kg_needed: parseFloat(kgNeeded.toFixed(2)),
      bags: bags
    };
  }

  /**
   * Grout consumption calculator using formula ((A+B)/(A*B)) * W * D * K * area.
   * A/B in mm, W (joint width mm), D (joint depth mm), K density coefficient.
   */
  function calcGrout(inputs) {
    const area = parseFloat(inputs.area) || 0;
    const A = parseFloat(inputs.tile_length) || 0;
    const B = parseFloat(inputs.tile_width) || 0;
    const W = parseFloat(inputs.joint_width) || 0;
    const D = parseFloat(inputs.joint_depth) || 0;
    // Determine density coefficient based on grout type or provided density
    let K;
    if (inputs.grout_type) {
      const type = inputs.grout_type;
      const densities = { cement: 1.8, epoxy: 1.6 };
      K = densities[type] || 1.8;
    } else {
      K = parseFloat(inputs.density) || 0;
    }
    const waste = parseFloat(inputs.waste) || 0;
    if (A <= 0 || B <= 0 || W <= 0 || D <= 0 || K <= 0 || area <= 0) {
      return { kg: NaN };
    }
    const base = ((A + B) / (A * B)) * W * D * K * area;
    const kg = base * (1 + waste / 100);
    return { kg: parseFloat(kg.toFixed(2)) };
  }

  /**
   * Electric underfloor heating calculator. Recommended power per m²: living
   * rooms/kitchens → 150 W; bathrooms → 160 W; balconies → 200 W.
   * Total power = area × recommended; cable length = total power / cable_power.
   */
  function calcWarmFloorElectric(inputs) {
    const area = parseFloat(inputs.area) || 0;
    const roomType = inputs.room_type || 'living';
    const cablePower = parseFloat(inputs.cable_power) || 0;
    const waste = parseFloat(inputs.waste) || 0;
    const powerMap = { living: 150, bathroom: 160, balcony: 200 };
    const specificPower = powerMap[roomType] || 150;
    const totalPower = area * specificPower;
    const cableLength = cablePower > 0 ? (totalPower / cablePower) : NaN;
    const lengthWithWaste = cableLength * (1 + waste / 100);
    return {
      total_power: parseFloat(totalPower.toFixed(2)),
      cable_length: parseFloat(lengthWithWaste.toFixed(2))
    };
  }

  /**
   * Water underfloor heating calculator. Pipe consumption per m² depends on
   * spacing: 10→10 m, 15→6.7 m, 20→5 m, 25→4 m, 30→3.4 m.
   */
  function calcWarmFloorWater(inputs) {
    const area = parseFloat(inputs.area) || 0;
    const spacing = parseFloat(inputs.spacing) || 0;
    const waste = parseFloat(inputs.waste) || 0;
    const map = { 10: 10.0, 15: 6.7, 20: 5.0, 25: 4.0, 30: 3.4 };
    const perSq = map[spacing] || 6.7;
    const length = area * perSq * (1 + waste / 100);
    return {
      length: parseFloat(length.toFixed(2))
    };
  }

  /**
   * Armstrong ceiling calculator. Multiplies area by normative values for
   * each component and rounds up to the nearest integer.
   */
  function calcArmstrong(inputs) {
    const area = parseFloat(inputs.area) || 0;
    const waste = parseFloat(inputs.waste) || 0;
    const effArea = area * (1 + waste / 100);
    const tiles = Math.ceil(effArea * 2.78);
    const cross06 = Math.ceil(effArea * 1.4);
    const cross12 = Math.ceil(effArea * 1.4);
    const mainProf = Math.ceil(effArea * 0.233);
    const hangers = Math.ceil(effArea * 0.7);
    return {
      tiles: tiles,
      cross_0_6: cross06,
      cross_1_2: cross12,
      main_profiles: mainProf,
      hangers: hangers
    };
  }

  /**
   * Rolled roofing calculator. Effective coverage per roll: (length-0.10)×(width-0.06).
   * Rolls = area × layers × (1 + waste/100) / effective_coverage.
   */
  function calcRolledRoof(inputs) {
    const area = parseFloat(inputs.area) || 0;
    const layers = parseInt(inputs.layers, 10) || 1;
    const rollLength = parseFloat(inputs.roll_length) || 0;
    const rollWidth = parseFloat(inputs.roll_width) || 0;
    const waste = parseFloat(inputs.waste) || 0;
    if (rollLength <= 0 || rollWidth <= 0 || area <= 0) return { rolls: NaN };
    const effective = (rollLength - 0.10) * (rollWidth - 0.06);
    const totalArea = area * layers * (1 + waste / 100);
    const rolls = effective > 0 ? Math.ceil(totalArea / effective) : NaN;
    return { rolls: rolls };
  }

  /**
   * Sealant calculator. Volume per meter = width * depth (rect) or half for tri.
   * Total cartridges = length * volume_per_m * (1+waste) / cartridge_volume.
   */
  function calcSealant(inputs) {
    const length = parseFloat(inputs.length) || 0;
    const width = parseFloat(inputs.width) || 0;
    const depth = parseFloat(inputs.depth) || 0;
    const shape = inputs.shape || 'rect';
    const cartridgeVol = parseFloat(inputs.cartridge_volume) || 0;
    const waste = parseFloat(inputs.waste) || 0;
    if (width <= 0 || depth <= 0 || length <= 0 || cartridgeVol <= 0) return { cartridges: NaN };
    const factor = shape === 'tri' ? 0.5 : 1.0;
    const volumePerM = width * depth * factor; // ml per meter
    const totalVol = length * volumePerM * (1 + waste / 100);
    const cartridges = totalVol / cartridgeVol;
    return { cartridges: parseFloat(cartridges.toFixed(2)) };
  }

  /**
   * Liquid nails calculator. Volume per meter = π*d²/4. Convert mm² to ml.
   */
  function calcLiquidNails(inputs) {
    const length = parseFloat(inputs.length) || 0;
    const diameter = parseFloat(inputs.diameter) || 0;
    const cartridgeVol = parseFloat(inputs.cartridge_volume) || 0;
    const waste = parseFloat(inputs.waste) || 0;
    if (length <= 0 || diameter <= 0 || cartridgeVol <= 0) return { cartridges: NaN };
    const areaMm2 = Math.PI * Math.pow(diameter, 2) / 4;
    // volume per meter in ml: area (mm²) * length (m)
    const volume = areaMm2 * length * (1 + waste / 100);
    const cartridges = volume / cartridgeVol;
    return { cartridges: parseFloat(cartridges.toFixed(2)) };
  }

  /**
   * Self‑leveling floor calculator. Calculates total kg of mix and number of bags.
   * Rates per mm thickness (kg/m²·mm) depend on product: gypsum 1.5, cement 1.8,
   * premium 2.0. Multiplies area, thickness and rate, then applies waste.
   */
  function calcSelfLeveling(inputs) {
    const area = parseFloat(inputs.area) || 0;
    const thickness = parseFloat(inputs.thickness) || 0;
    const product = inputs.product || 'gypsum';
    const bagWeight = parseFloat(inputs.bag_weight) || 0;
    const waste = parseFloat(inputs.waste) || 0;
    const rates = { gypsum: 1.5, cement: 1.8, premium: 2.0 };
    const rate = rates[product] || 1.5;
    const kgRaw = area * thickness * rate;
    const kg = kgRaw * (1 + waste / 100);
    const bags = bagWeight > 0 ? Math.ceil(kg / bagWeight) : NaN;
    return { kg: parseFloat(kg.toFixed(2)), bags: bags };
  }

  /**
   * Cement‑sand mix (CPS) calculator for floor screeds. Thickness in cm, rates per cm
   * (kg/m²·cm) depend on composition: standard 18, reinforced 20.
   */
  function calcCpsMix(inputs) {
    const area = parseFloat(inputs.area) || 0;
    const thickness = parseFloat(inputs.thickness) || 0;
    const composition = inputs.composition || 'standard';
    const bagWeight = parseFloat(inputs.bag_weight) || 0;
    const waste = parseFloat(inputs.waste) || 0;
    const rates = { standard: 18, reinforced: 20 };
    const rate = rates[composition] || 18;
    const kgRaw = area * thickness * rate;
    const kg = kgRaw * (1 + waste / 100);
    const bags = bagWeight > 0 ? Math.ceil(kg / bagWeight) : NaN;
    return { kg: parseFloat(kg.toFixed(2)), bags: bags };
  }

  /**
   * Mastic calculator. Calculates kg and buckets required for roofing or tile mastics.
   * Rates per mm (kg/m²·mm): roof 1.5, tile 0.4.
   */
  function calcMastic(inputs) {
    const area = parseFloat(inputs.area) || 0;
    const thickness = parseFloat(inputs.thickness) || 0;
    const type = inputs.mastic_type || 'roof';
    const bucketWeight = parseFloat(inputs.bucket_weight) || 0;
    const waste = parseFloat(inputs.waste) || 0;
    const rates = { roof: 1.5, tile: 0.4 };
    const rate = rates[type] || 1.5;
    const kgRaw = area * thickness * rate;
    const kg = kgRaw * (1 + waste / 100);
    const buckets = bucketWeight > 0 ? Math.ceil(kg / bucketWeight) : NaN;
    return { kg: parseFloat(kg.toFixed(2)), buckets: buckets };
  }

  /**
   * Ready‑made putty calculator. Rates per mm (kg/m²·mm) vary by brand: Terraco 1.8,
   * EZ‑Skim 1.7, generic 1.2. Calculates kg and number of buckets.
   */
  function calcReadyPutty(inputs) {
    const area = parseFloat(inputs.area) || 0;
    const thickness = parseFloat(inputs.thickness) || 0;
    const brand = inputs.brand || 'terraco';
    const bucketWeight = parseFloat(inputs.bucket_weight) || 0;
    const waste = parseFloat(inputs.waste) || 0;
    const rates = { terraco: 1.8, ezskim: 1.7, generic: 1.2 };
    const rate = rates[brand] || 1.5;
    const kgRaw = area * thickness * rate;
    const kg = kgRaw * (1 + waste / 100);
    const buckets = bucketWeight > 0 ? Math.ceil(kg / bucketWeight) : NaN;
    return { kg: parseFloat(kg.toFixed(2)), buckets: buckets };
  }

  // Mapping of calculator IDs to custom calculation functions
  const customCalculators = {
    'laminate_floor': calcLaminate,
    'tile_floor': calcTile,
    'plaster': calcPlaster,
    'putty': calcPutty,
    'screed': calcScreed,
    'wallpaper': calcWallpaper,
    'skirting': calcSkirting,
    'drywall': calcDrywall,
    'insulation': calcInsulation,
    // sheet materials
    'slate': calcSlate,
    'osb': calcSheet,
    'plywood': calcSheet,
    'fibreboard': calcSheet,
    'chipboard': calcSheet
    ,
    // New custom calculators
    'primer': calcPrimer,
    'tile_adhesive': calcTileAdhesive,
    'grout': calcGrout,
    'warm_floor_electric': calcWarmFloorElectric,
    'warm_floor_water': calcWarmFloorWater,
    'armstrong_ceiling': calcArmstrong,
    'rolled_roof': calcRolledRoof,
    'sealant': calcSealant,
    'liquid_nails': calcLiquidNails
    ,
    // Newly added calculators
    'self_leveling': calcSelfLeveling,
    'cps_mix': calcCpsMix,
    'mastic': calcMastic,
    'ready_putty': calcReadyPutty,
    'antiseptic': calcAntiseptic
  };

  // ---------------------------------------------------------------------------
  // Utility functions for persisting and retrieving state
  // ---------------------------------------------------------------------------
  /**
   * Retrieve saved input values for a calculator from localStorage.
   * @param {string} id Calculator identifier
   * @returns {Object} Saved state or an empty object
   */
  function getSavedState(id) {
    try {
      const raw = localStorage.getItem('calc_state_' + id);
      if (raw) return JSON.parse(raw);
    } catch (_) {
      // ignore parse errors
    }
    return {};
  }
  /**
   * Persist calculator state in localStorage.
   * @param {string} id Calculator identifier
   * @param {Object} state State to persist
   */
  function saveState(id, state) {
    try {
      localStorage.setItem('calc_state_' + id, JSON.stringify(state));
    } catch (_) {
      // ignore storage errors (e.g. quota exceeded)
    }
  }

  /**
   * Retrieve saved projects from localStorage. Projects are stored under
   * the key 'calc_projects' as an object mapping project names to their
   * calculator id, saved state and results. Returns an object or empty
   * object on failure.
   */
  function getProjects() {
    try {
      const raw = localStorage.getItem('calc_projects');
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  /**
   * Save a project to localStorage. Each project is keyed by its name and
   * contains the calculator id, state and results. Existing projects with
   * the same name are overwritten.
   * @param {string} name Project name
   * @param {string} calcId Calculator id
   * @param {Object} state User inputs state
   * @param {Object} results Calculated results
   */
  function saveProject(name, calcId, state, results) {
    const projects = getProjects();
    projects[name] = { id: calcId, state: state, results: results };
    try {
      localStorage.setItem('calc_projects', JSON.stringify(projects));
    } catch (_) {
      // ignore storage errors
    }
  }

  /**
   * Delete a project by name from localStorage.
   * @param {string} name Name of the project to delete
   */
  function deleteProject(name) {
    const projects = getProjects();
    if (projects.hasOwnProperty(name)) {
      delete projects[name];
      try {
        localStorage.setItem('calc_projects', JSON.stringify(projects));
      } catch (_) {
        // ignore storage errors
      }
    }
  }

  /**
   * Find the display title of a calculator by its id. Used when rendering
   * projects list. Falls back to the id if not found.
   * @param {string} id Calculator identifier
   * @returns {string} Display title
   */
  function getCalculatorTitle(id) {
    const calc = calculatorsData.find(c => c.id === id);
    return calc ? calc.title : id;
  }

  /**
   * Helper to get the output unit for a given result key, by searching the
   * calculators definitions. Used when summarising project results.
   * @param {string} key Output key
   * @returns {string|undefined} Unit label or undefined
   */
  function calcOutputUnit(key) {
    for (const c of calculatorsData) {
      if (c.outputs) {
        const o = c.outputs.find(out => out.key === key);
        if (o) {
          return o.format;
        }
      }
    }
    return undefined;
  }

  /**
   * Render the list of saved projects. Each project displays its name,
   * calculator title and key results, and includes 'Open' and 'Delete'
   * buttons. Clicking 'Open' will restore the saved state and open the
   * corresponding calculator; clicking 'Delete' removes the project.
   */
  function renderProjectsList() {
    const listEl = document.getElementById('calcList');
    const formEl = document.getElementById('calcForm');
    listEl.style.display = 'none';
    formEl.style.display = 'block';
    formEl.innerHTML = '';
    const titleEl = document.createElement('h2');
    titleEl.textContent = 'Мои проекты';
    formEl.appendChild(titleEl);
    const projects = getProjects();
    const names = Object.keys(projects);
    if (names.length === 0) {
      const emptyEl = document.createElement('p');
      emptyEl.textContent = 'Нет сохранённых проектов.';
      formEl.appendChild(emptyEl);
    } else {
      const ul = document.createElement('ul');
      names.forEach(name => {
        const proj = projects[name];
        const li = document.createElement('li');
        const span = document.createElement('span');
        span.textContent = `${name} – ${getCalculatorTitle(proj.id)}`;
        li.appendChild(span);
        if (proj.results) {
          const resSpan = document.createElement('span');
          const resKeys = Object.keys(proj.results);
          const summary = resKeys.map(k => `${proj.results[k]} ${calcOutputUnit(k) || ''}`).join(', ');
          resSpan.textContent = ' (' + summary + ')';
          resSpan.style.color = '#555';
          li.appendChild(resSpan);
        }
        const openBtn = document.createElement('button');
        openBtn.className = 'button';
        openBtn.textContent = 'Открыть';
        openBtn.style.marginLeft = '8px';
        openBtn.addEventListener('click', () => {
          const calc = calculatorsData.find(c => c.id === proj.id);
          if (calc) {
            saveState(calc.id, proj.state || {});
            if (calc.id === 'paint_wall') {
              openPaintCalculator();
            } else {
              openGenericCalculator(calc);
            }
          }
        });
        li.appendChild(openBtn);
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'button';
        deleteBtn.textContent = 'Удалить';
        deleteBtn.style.marginLeft = '4px';
        deleteBtn.addEventListener('click', () => {
          if (confirm('Удалить проект «' + name + '»?')) {
            deleteProject(name);
            renderProjectsList();
          }
        });
        li.appendChild(deleteBtn);
        ul.appendChild(li);
      });
      formEl.appendChild(ul);
    }
    const backLink = document.createElement('div');
    backLink.className = 'back-link';
    backLink.textContent = '← Вернуться к списку';
    backLink.addEventListener('click', () => {
      renderMainList();
    });
    formEl.appendChild(backLink);
  }

  // ---------------------------------------------------------------------------
  // Rendering logic
  // ---------------------------------------------------------------------------
  /**
   * Render the list of calculators grouped by category. Clicking on a card opens
   * the corresponding calculator screen. Unimplemented calculators show a stub.
   */
  
function renderMainList() {
  const listEl = document.getElementById('calcList');
  const formEl = document.getElementById('calcForm');
  const queryEl = document.getElementById('searchInput');
  const q = queryEl ? queryEl.value.toLowerCase().trim() : '';
  if (!listEl || !formEl) return;
  listEl.innerHTML = '';
  formEl.style.display = 'none';
  listEl.style.display = 'block';

  const favorites = new Set(getFavorites());

  // Filter by query over title/category
  const filtered = calculatorsData.filter(c => {
    if (!q) return true;
    return (c.title && c.title.toLowerCase().includes(q)) ||
           (c.category && c.category.toLowerCase().includes(q));
  });

  // Section builder
  function buildSection(title, items) {
    const section = document.createElement('div');
    section.className = 'category';
    const h = document.createElement('h2');
    h.textContent = title;
    section.appendChild(h);
    const grid = document.createElement('div');
    grid.className = 'calc-grid';
    items.forEach(calc => grid.appendChild(createCard(calc)));
    section.appendChild(grid);
    listEl.appendChild(section);
  }

  // Card builder with star and category icon
  function createCard(calc) {
    const card = document.createElement('div');
    card.className = 'calc-card';
    const icon = `<div class="cat-icon">${iconForCategory(calc.category)}</div>`;
    card.innerHTML = `<div class="card-top">${icon}<div><h3>${calc.title}</h3><div class="muted">${calc.category}</div></div></div>`;
    // Star (skip for virtual 'projects')
    if (calc.id !== 'projects') {
      const active = favorites.has(calc.id);
      const star = document.createElement('div');
      star.className = 'star' + (active ? ' active' : '');
      star.textContent = active ? '★' : '☆';
      star.title = active ? 'Убрать из избранного' : 'В избранное';
      star.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const fav = toggleFavorite(calc.id);
        showToast(fav ? 'Добавлено в избранное' : 'Удалено из избранного');
        renderMainList();
      });
      card.appendChild(star);
    }
    card.addEventListener('click', () => {
      if (calc.id === 'paint_wall') {
        openPaintCalculator();
      } else if (calc.id === 'projects') {
        renderProjectsList();
      } else {
        openGenericCalculator(calc);
      }
    });
    return card;
  }

  // Favorites section first
  const favItems = filtered.filter(c => favorites.has(c.id));
  if (favItems.length) buildSection('⭐ Избранные', favItems);

  // Group others by category
  const rest = filtered.filter(c => !favorites.has(c.id));
  const grouped = rest.reduce((acc, c) => {
    (acc[c.category] ||= []).push(c);
    return acc;
  }, {});
  Object.keys(grouped).sort().forEach(cat => buildSection(cat, grouped[cat]));
}
  /**
   * Helper to create an error message element.
   * @param {string} msg Text to display
   */
  function createError(msg) {
    const span = document.createElement('span');
    span.className = 'error-message';
    span.textContent = msg;
    return span;
  }

  // ---------------------------------------------------------------------------
  // Paint calculator specific screen
  // ---------------------------------------------------------------------------
  /**
   * Render the specialised paint calculator. Includes options for environment,
   * surface, paint type, number of coats and dynamic inputs for dimensions.
   * Input is validated and results update reactively. Last values are persisted.
   */
  function openPaintCalculator() {
    const listEl = document.getElementById('calcList');
    const formEl = document.getElementById('calcForm');
    listEl.style.display = 'none';
    formEl.style.display = 'block';
    formEl.innerHTML = '';
    // Title
    const titleEl = document.createElement('h2');
    titleEl.textContent = 'Краска';
    formEl.appendChild(titleEl);
    // Load saved state or default values
    const saved = getSavedState('paint_wall');
    const state = {
      environment: saved.environment || 'internal',
      surface: saved.surface || 'wall',
      type: saved.type || 'standard',
      coats: saved.coats || 1,
      waste: saved.waste != null ? saved.waste : 10,
      length: saved.length || 0,
      width: saved.width || 0,
      height: saved.height || 0,
      area: saved.area || 0,
      openings: saved.openings || 0
    };
    // Build controls
    // Environment select
    const envLabel = document.createElement('label');
    envLabel.textContent = 'Вид работ:';
    formEl.appendChild(envLabel);
    const envSelect = document.createElement('select');
    envSelect.innerHTML = '<option value="internal">Внутренние</option>' +
                         '<option value="external">Наружные</option>';
    envSelect.value = state.environment;
    envSelect.addEventListener('change', e => {
      state.environment = e.target.value;
      updatePaintResults();
      saveState('paint_wall', state);
    });
    formEl.appendChild(envSelect);
    // Surface select
    const surfLabel = document.createElement('label');
    surfLabel.textContent = 'Что красим:';
    formEl.appendChild(surfLabel);
    const surfSelect = document.createElement('select');
    surfSelect.innerHTML = '<option value="wall">Стены</option>' +
                          '<option value="floor">Пол</option>';
    surfSelect.value = state.surface;
    surfSelect.addEventListener('change', e => {
      state.surface = e.target.value;
      renderPaintFields();
      updatePaintResults();
      saveState('paint_wall', state);
    });
    formEl.appendChild(surfSelect);
    // Paint type select
    const typeLabel = document.createElement('label');
    typeLabel.textContent = 'Тип краски:';
    formEl.appendChild(typeLabel);
    const typeSelect = document.createElement('select');
    // Extended paint types: standard, improved, premium, acrylic, alkyd, textured, oil, water
    typeSelect.innerHTML =
      '<option value="standard">Стандартная</option>' +
      '<option value="improved">Улучшенная</option>' +
      '<option value="premium">Премиальная</option>' +
      '<option value="acrylic">Акриловая</option>' +
      '<option value="alkyd">Алкидная</option>' +
      '<option value="textured">Текстурная</option>' +
      '<option value="oil">Масляная</option>' +
      '<option value="water">Водоэмульсионная</option>';
    typeSelect.value = state.type;
    typeSelect.addEventListener('change', e => {
      state.type = e.target.value;
      updatePaintResults();
      saveState('paint_wall', state);
    });
    formEl.appendChild(typeSelect);
    // Coats input
    const coatsLabel = document.createElement('label');
    coatsLabel.textContent = 'Количество слоёв:';
    formEl.appendChild(coatsLabel);
    const coatsInput = document.createElement('input');
    coatsInput.type = 'number';
    coatsInput.step = '1';
    coatsInput.min = '1';
    coatsInput.value = state.coats;
    const coatsError = createError('');
    coatsInput.addEventListener('input', e => {
      let val = e.target.value.replace(',', '.');
      let n = parseInt(val, 10);
      if (isNaN(n) || n < 1) {
        coatsError.textContent = 'Введите целое ≥1';
        n = 1;
      } else {
        coatsError.textContent = '';
      }
      state.coats = n;
      updatePaintResults();
      saveState('paint_wall', state);
    });
    formEl.appendChild(coatsInput);
    formEl.appendChild(coatsError);
    // Waste selector
    const wasteLabel = document.createElement('label');
    wasteLabel.textContent = 'Запас материалов (%):';
    formEl.appendChild(wasteLabel);
    const wasteSelect = document.createElement('select');
    wasteSelect.innerHTML = '<option value="5">5</option>' +
                            '<option value="10">10</option>' +
                            '<option value="15">15</option>';
    wasteSelect.value = state.waste;
    wasteSelect.addEventListener('change', e => {
      state.waste = parseFloat(e.target.value);
      updatePaintResults();
      saveState('paint_wall', state);
    });
    formEl.appendChild(wasteSelect);
    // Container for dynamic fields
    const fieldsContainer = document.createElement('div');
    fieldsContainer.id = 'paintFields';
    formEl.appendChild(fieldsContainer);
    // Results container
    const resultsContainer = document.createElement('div');
    resultsContainer.id = 'paintResults';
    resultsContainer.className = 'results';
    formEl.appendChild(resultsContainer);
    // Share button
    const shareBtn = document.createElement('button');
    shareBtn.className = 'button';
    shareBtn.textContent = 'Поделиться';
    shareBtn.addEventListener('click', () => {
      sharePaintResults(state);
    });
    formEl.appendChild(shareBtn);

    // Save button: allows user to save current paint calculation as a project
    const saveBtn = document.createElement('button');
    saveBtn.className = 'button';
    saveBtn.textContent = 'Сохранить';
    saveBtn.addEventListener('click', () => {
      // Compute result to save along with state
      const res = window.calcPaint(state);
      const name = prompt('Введите название проекта', 'Новый проект');
      if (name && name.trim()) {
        saveProject(name.trim(), 'paint_wall', { ...state }, res);
        showToast('Проект сохранён');
      }
    });
    formEl.appendChild(saveBtn);
    // Back link
    const backLink = document.createElement('div');
    backLink.className = 'back-link';
    backLink.textContent = '← Вернуться к списку';
    backLink.addEventListener('click', () => {
      renderMainList();
    });
    formEl.appendChild(backLink);
    // Render dynamic fields and results initially
    function renderPaintFields() {
      fieldsContainer.innerHTML = '';
      if (state.surface === 'wall') {
        // Length
        appendNumberField(fieldsContainer, 'length', 'Длина комнаты (м):', 0);
        appendNumberField(fieldsContainer, 'width', 'Ширина комнаты (м):', 0);
        appendNumberField(fieldsContainer, 'height', 'Высота комнаты (м):', 0);
        appendNumberField(fieldsContainer, 'openings', 'Площадь проёмов (м²):', 0);
      } else {
        appendNumberField(fieldsContainer, 'area', 'Площадь пола (м²):', 0);
      }
    }
    /**
     * Helper to append a numeric input with validation for the paint calculator.
     * @param {HTMLElement} parent Container to append to
     * @param {string} key State key to bind
     * @param {string} labelText Label for the input
     * @param {number} minValue Minimum allowed value (inclusive)
     */
    function appendNumberField(parent, key, labelText, minValue) {
      const label = document.createElement('label');
      label.textContent = labelText;
      parent.appendChild(label);
      const input = document.createElement('input');
      input.type = 'number';
      input.step = '0.01';
      input.value = state[key] != null ? state[key] : '';
      const err = createError('');
      input.addEventListener('input', e => {
        let valRaw = e.target.value.replace(',', '.');
        let val = parseFloat(valRaw);
        if (valRaw === '') {
          err.textContent = 'Обязательно';
          state[key] = 0;
        } else if (isNaN(val) || val < minValue) {
          err.textContent = 'Неверное значение';
          // keep previous value
        } else {
          err.textContent = '';
          // Restrict to two decimal places
          val = Math.round(val * 100) / 100;
          state[key] = val;
        }
        updatePaintResults();
        saveState('paint_wall', state);
      });
      parent.appendChild(input);
      parent.appendChild(err);
    }
    function updatePaintResults() {
      const result = window.calcPaint(state);
      const area = isNaN(result.area) ? '-' : result.area.toFixed(2);
      const litres = isNaN(result.litres) ? '-' : result.litres.toFixed(2);
      resultsContainer.innerHTML = '<h3>Результаты</h3>' +
        `<p>Площадь покрытия: ${area} м²</p>` +
        `<p>Литры краски: ${litres}</p>`;
    }
    function sharePaintResults(st) {
      // Compose text and CSV for sharing
      let text = 'Калькулятор: Краска\n';
      text += `Вид работ: ${st.environment === 'internal' ? 'Внутренние' : 'Наружные'}\n`;
      text += `Поверхность: ${st.surface === 'wall' ? 'Стены' : 'Пол'}\n`;
      text += `Тип краски: ${st.type}\n`;
      text += `Слоёв: ${st.coats}\n`;
      if (st.surface === 'wall') {
        text += `Длина: ${st.length}\n`;
        text += `Ширина: ${st.width}\n`;
        text += `Высота: ${st.height}\n`;
        text += `Проёмы: ${st.openings}\n`;
      } else {
        text += `Площадь: ${st.area}\n`;
      }
      text += `Запас: ${st.waste}%\n`;
      const res = window.calcPaint(st);
      text += `\nПлощадь покрытия: ${res.area.toFixed(2)} м²\n`;
      text += `Литры краски: ${res.litres.toFixed(2)}\n`;
      // Create CSV
      let csv = 'Параметр;Значение\n';
      csv += 'Вид работ;' + (st.environment === 'internal' ? 'Внутренние' : 'Наружные') + '\n';
      csv += 'Поверхность;' + (st.surface === 'wall' ? 'Стены' : 'Пол') + '\n';
      csv += 'Тип краски;' + st.type + '\n';
      csv += 'Слоёв;' + st.coats + '\n';
      if (st.surface === 'wall') {
        csv += 'Длина;' + st.length + '\n';
        csv += 'Ширина;' + st.width + '\n';
        csv += 'Высота;' + st.height + '\n';
        csv += 'Проёмы;' + st.openings + '\n';
      } else {
        csv += 'Площадь;' + st.area + '\n';
      }
      csv += 'Запас;' + st.waste + '%\n';
      csv += 'Площадь покрытия;' + res.area.toFixed(2) + '\n';
      csv += 'Литры краски;' + res.litres.toFixed(2) + '\n';
      // Provide simple share: copy text to clipboard and create CSV download
      navigator.clipboard.writeText(text).then(() => {
        showToast('Скопировано в буфер обмена');
      }).catch(() => {
        alert('Не удалось скопировать текст.');
      });
      // Create and trigger CSV download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'paint_calc.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    // Finally, render fields and initial results
    renderPaintFields();
    updatePaintResults();
  }

  // ---------------------------------------------------------------------------
  // Generic calculator screen
  // ---------------------------------------------------------------------------
  /**
   * Open a generic calculator based on a declarative definition. Fields are
   * rendered automatically and formulas are evaluated via evaluateCalculator
   * from the formula engine. Includes waste selector, reactive computation,
   * validation and sharing.
   * @param {Object} calc Calculator definition from calculatorsData
   */
  function openGenericCalculator(calc) {
    // If this is the virtual projects entry, simply render the projects list instead of a calculator screen
    if (calc && calc.id === 'projects') {
      renderProjectsList();
      return;
    }
    const listEl = document.getElementById('calcList');
    const formEl = document.getElementById('calcForm');
    listEl.style.display = 'none';
    formEl.style.display = 'block';
    formEl.innerHTML = '';
    const titleEl = document.createElement('h2');
    titleEl.textContent = calc.title;
    formEl.appendChild(titleEl);
    // Hint icon if calculator provides a hint message. When clicked, show alert
    if (calc.hint) {
      const hintIcon = document.createElement('span');
      hintIcon.textContent = '💡';
      hintIcon.style.cursor = 'pointer';
      hintIcon.style.marginLeft = '8px';
      hintIcon.title = 'Подсказка';
      hintIcon.addEventListener('click', () => { showTips(calc.hint); });
      titleEl.appendChild(hintIcon);
    }
    // Load saved state or defaults
    const saved = getSavedState(calc.id);
    const state = {};
    calc.fields.forEach(field => {
      state[field.key] = saved[field.key] != null ? saved[field.key] : (field.default != null ? field.default : '');
    });
    // Always store waste separately; default 10 or saved
    state.waste = saved.waste != null ? saved.waste : 10;
    // Waste selector
    const wasteLabel = document.createElement('label');
    wasteLabel.textContent = 'Запас (%):';
    formEl.appendChild(wasteLabel);
    const wasteSelect = document.createElement('select');
    wasteSelect.innerHTML = '<option value="5">5</option>' +
                            '<option value="10">10</option>' +
                            '<option value="15">15</option>';
    wasteSelect.value = state.waste;
    wasteSelect.addEventListener('change', e => {
      state.waste = parseFloat(e.target.value);
      updateResults();
      saveState(calc.id, state);
    });
    formEl.appendChild(wasteSelect);
    // Fields container
    const fieldsContainer = document.createElement('div');
    formEl.appendChild(fieldsContainer);
    // Results container
    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'results';
    formEl.appendChild(resultsContainer);
    // Share button
    const shareBtn = document.createElement('button');
    shareBtn.className = 'button';
    shareBtn.textContent = 'Поделиться';
    shareBtn.addEventListener('click', () => {
      shareGenericResults(calc, state);
    });
    formEl.appendChild(shareBtn);

    // Save button to persist calculation as a project
    const saveBtn = document.createElement('button');
    saveBtn.className = 'button';
    saveBtn.textContent = 'Сохранить';
    saveBtn.addEventListener('click', () => {
      // Compute results synchronously
      let resultsObj;
      if (customCalculators.hasOwnProperty(calc.id)) {
        resultsObj = customCalculators[calc.id](state);
      } else {
        resultsObj = evaluateLocalCalculator(calc, state);
      }
      const name = prompt('Введите название проекта', 'Новый проект');
      if (name && name.trim()) {
        saveProject(name.trim(), calc.id, { ...state }, resultsObj);
        showToast('Проект сохранён');
      }
    });
    formEl.appendChild(saveBtn);
    // Back link
    const backLink = document.createElement('div');
    backLink.className = 'back-link';
    backLink.textContent = '← Вернуться к списку';
    backLink.addEventListener('click', () => {
      renderMainList();
    });
    formEl.appendChild(backLink);
    // Render input fields
    const errors = {};
    calc.fields.forEach(field => {
      const label = document.createElement('label');
      label.textContent = field.label;
      fieldsContainer.appendChild(label);
      // Determine input type: select for options, otherwise numeric input
      let control;
      const err = createError('');
      errors[field.key] = err;
      if (field.type === 'select' || Array.isArray(field.options)) {
        // Create a dropdown
        const select = document.createElement('select');
        (field.options || []).forEach(opt => {
          const optionEl = document.createElement('option');
          optionEl.value = opt.value;
          optionEl.textContent = opt.label;
          select.appendChild(optionEl);
        });
        // Set initial value
        select.value = state[field.key] != null ? state[field.key] : (field.default != null ? field.default : (field.options && field.options[0] ? field.options[0].value : ''));
        select.addEventListener('change', e => {
          // Store numeric if it looks like a number
          const valRaw = e.target.value;
          const numVal = parseFloat(valRaw);
          state[field.key] = !isNaN(numVal) && String(numVal) === valRaw ? numVal : valRaw;
          err.textContent = '';
          updateResults();
          saveState(calc.id, state);
        });
        control = select;
      } else {
        // Numeric input
        const input = document.createElement('input');
        input.type = 'number';
        input.step = field.type === 'integer' ? '1' : '0.01';
        input.value = state[field.key];
        input.addEventListener('input', e => {
          const raw = e.target.value.replace(',', '.');
          if (raw === '') {
            err.textContent = 'Обязательно';
            state[field.key] = '';
          } else {
            let val;
            if (field.type === 'integer') {
              val = parseInt(raw, 10);
              if (isNaN(val) || val < 0) {
                err.textContent = 'Неверное значение';
                return;
              }
              err.textContent = '';
              state[field.key] = val;
            } else {
              val = parseFloat(raw);
              if (isNaN(val) || val < 0) {
                err.textContent = 'Неверное значение';
                return;
              }
              err.textContent = '';
              // Restrict decimals to two places
              val = Math.round(val * 100) / 100;
              state[field.key] = val;
            }
          }
          updateResults();
          saveState(calc.id, state);
        });
        control = input;
      }
      fieldsContainer.appendChild(control);
      fieldsContainer.appendChild(err);
    });
    /**
     * Compute results and display them. If any required field is empty or
     * invalid, results are cleared and errors remain displayed. Otherwise,
     * evaluate formulas via engine and update the UI.
     */
    function updateResults() {
      try {
      // Validate inputs: ensure required fields are filled. For numeric
      // values ensure non-negative numbers. For select/string values we
      // accept non-empty strings. Negative numeric strings are invalid.
      let hasError = false;
      for (const f of calc.fields) {
        const key = f.key;
        const val = state[key];
        if (val === '' || val == null) {
          hasError = true;
          break;
        }
        if (typeof val === 'number') {
          if (!isFinite(val) || val < 0) {
            hasError = true;
            break;
          }
        } else {
          // If string contains a numeric value, check negativity; otherwise accept
          const n = parseFloat(val);
          if (!isNaN(n) && n < 0) {
            hasError = true;
            break;
          }
        }
      }
      let computed;
      // Use a custom calculation function if defined for this calculator.
      if (customCalculators.hasOwnProperty(calc.id)) {
        computed = customCalculators[calc.id](state);
      } else {
        // Fallback to local declarative evaluator when no custom function exists.
        computed = evaluateLocalCalculator(calc, state);
      }
      let html = '<h3>Результаты</h3>';
      // Display each output value, formatting numbers appropriately. If the
      // computed value is NaN or undefined, show a dash instead.
      calc.outputs.forEach(out => {
        const val = computed[out.key];
        let formatted;
        if (val == null || isNaN(val)) {
          formatted = '-';
        } else {
          formatted = Number.isInteger(val) ? val : Number(val).toFixed(2);
        }
        html += `<p>${out.label}: ${formatted} ${out.format || ''}</p>`;
      });
      // If there were missing/invalid fields, inform the user separately
      if (hasError) {
        html += '<p class="info-message">Проверьте введённые данные</p>';
      }
      resultsContainer.innerHTML = html;
      } catch (err) {
        // Show error details for debugging
        const msg = (err && err.message) ? err.message : String(err);
        resultsContainer.innerHTML = '<h3>Ошибка</h3><pre>' + msg + '</pre>';
        console.error('Error in updateResults:', err);
      }
    }
    /**
     * Prepare and share results for a generic calculator. Copies a summary to
     * clipboard and triggers a CSV download.
     */
    function shareGenericResults(calcDef, st) {
      let text = `Калькулятор: ${calcDef.title}\n`;
      calcDef.fields.forEach(f => {
        text += `${f.label}: ${st[f.key]}\n`;
      });
      text += `Запас: ${st.waste}%\n`;
      // Evaluate formulas using custom function or the local evaluator. Invalid inputs produce NaN.
      let computed;
      if (customCalculators.hasOwnProperty(calcDef.id)) {
        computed = customCalculators[calcDef.id](st);
      } else {
        computed = evaluateLocalCalculator(calcDef, st);
      }
      calcDef.outputs.forEach(out => {
        const val = computed[out.key];
        const formatted = (val == null || isNaN(val)) ? '-' : (Number.isInteger(val) ? val : val.toFixed(2));
        text += `${out.label}: ${formatted} ${out.format || ''}\n`;
      });
      let csv = 'Параметр;Значение\n';
      calcDef.fields.forEach(f => {
        csv += `${f.label};${st[f.key]}\n`;
      });
      csv += `Запас;${st.waste}%\n`;
      calcDef.outputs.forEach(out => {
        const val = computed[out.key];
        const formatted = (val == null || isNaN(val)) ? '-' : (Number.isInteger(val) ? val : val.toFixed(2));
        csv += `${out.label};${formatted} ${out.format || ''}\n`;
      });
      // Copy text to clipboard
      navigator.clipboard.writeText(text).then(() => {
        showToast('Скопировано в буфер обмена');
      }).catch(() => {
        showToast('Не удалось скопировать');
      });
      // Trigger CSV download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${calcDef.id}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    // Initialize results
    updateResults();
  }

  // ---------------------------------------------------------------------------
  // Initialize the app on DOMContentLoaded
  // ---------------------------------------------------------------------------
  window.addEventListener('DOMContentLoaded', () => {
    applySavedTheme();
    renderMainList();
    const search = document.getElementById('searchInput');
    if (search) { search.addEventListener('input', () => renderMainList()); }
    const projBtn = document.getElementById('projectsBtn');
    if (projBtn) projBtn.addEventListener('click', () => renderProjectsList());
    const homeBtn = document.getElementById('homeBtn');
    if (homeBtn) homeBtn.addEventListener('click', () => renderMainList());
    const theme = document.getElementById('themeToggle');
    if (theme) theme.addEventListener('click', toggleTheme);
    const closeBtn = document.getElementById('tipsClose');
    const panel = document.getElementById('tipsPanel');
    if (closeBtn) closeBtn.addEventListener('click', hideTips);
    if (panel) panel.addEventListener('click', (e) => { if (e.target.classList.contains('tips-backdrop')) hideTips(); });
    const search = document.getElementById('searchInput');
    if (search) {
      search.addEventListener('input', () => renderMainList());
    }
  });
})();
  /**
   * Антисептики для древесины.
   * Поддерживает тип продукта (водорастворимый, алкидный/масляный, концентрат 1:5, огнебио).
   * Считает литры готового раствора, объём концентрата (если выбран тип концентрат), и канистры.
   */
  function calcAntiseptic(inputs) {
    const area = parseFloat(inputs.area) || 0;
    const coats = parseInt(inputs.coats || 1, 10);
    const waste = parseFloat(inputs.waste) || 0;
    const pack = parseFloat(inputs.pack || 5); // л
    const type = String(inputs.type || 'water').toLowerCase();
    const absorb = String(inputs.absorb || 'medium').toLowerCase();
    // Базовый расход (л/м² за слой) по типу
    let base = 0.12; // по умолчанию
    if (type === 'water') base = 0.1;
    else if (type === 'alkyd') base = 0.12;
    else if (type === 'firebio') base = 0.18;
    else if (type === 'concentrate') base = 0.1; // указываем расход готового раствора
    // Поправка по впитываемости
    let kAbs = 1.0;
    if (absorb === 'low') kAbs = 0.85;
    if (absorb === 'high') kAbs = 1.25;
    // Итоговый расход на все слои с запасом
    const litresReady = area * coats * base * kAbs * (1 + waste/100);
    // Расчёт концентрата (если тип концентрат 1:5)
    let concentrateLitres = 0;
    let waterLitres = 0;
    if (type === 'concentrate') {
      concentrateLitres = litresReady / 6; // 1 часть концентрата + 5 воды
      waterLitres = litresReady - concentrateLitres;
    }
    const cans = pack > 0 ? Math.ceil(litresReady / pack) : 0;
    return {
      litres_ready: parseFloat(litresReady.toFixed(2)),
      cans: cans,
      concentrate: parseFloat(concentrateLitres.toFixed(2)),
      water: parseFloat(waterLitres.toFixed(2))
    };
  }
