
// Formula Engine
// Contains pure functions to calculate results for each calculator.

// Coverage rates (m² per litre) for different paint types. You can extend this list as needed.
const PAINT_COVERAGE = {
  standard: 10,      // стандартная краска (~10 м²/л)
  improved: 8,       // улучшенная (~8 м²/л)
  premium: 6,        // премиальная (~6 м²/л)
  acrylic: 11,       // акриловая интерьерная (~11 м²/л)
  alkyd: 12,         // алкидная (~12 м²/л)
  textured: 4,       // текстурная/фактурная (3–5 м²/л)
  oil: 10,           // масляная (~10 м²/л)
  water: 10          // водоэмульсионная (~10 м²/л)
};

/**
 * Calculate paint requirements.
 * @param {Object} inputs - The state inputs for the paint calculator.
 * @param {string} inputs.type - Type of paint ('standard', 'improved', 'premium').
 * @param {number} inputs.coats - Number of coats.
 * @param {string} inputs.environment - 'internal' or 'external'.
 * @param {string} inputs.surface - 'wall' or 'floor'.
 * @param {number} inputs.length - Room length (m).
 * @param {number} inputs.width - Room width (m).
 * @param {number} inputs.height - Room height (m).
 * @param {number} inputs.area - Floor area (m²) if surface is 'floor'.
 * @param {number} inputs.openings - Total area of openings (doors/windows) for walls (m²).
 * @param {number} inputs.waste - Waste percentage (e.g. 10 for 10%).
 * @returns {Object} { area: number, litres: number }
 */
function calcPaint(inputs) {
  // Destructure inputs with defaults
  const {
    type = 'standard',
    coats = 1,
    environment = 'internal',
    surface = 'wall',
    length = 0,
    width = 0,
    height = 0,
    area = 0,
    openings = 0,
    waste = 10
  } = inputs;
  // Determine coverage rate based on type
  let coverage = PAINT_COVERAGE[type] || PAINT_COVERAGE.standard;
  // Adjust coverage for environment: external surfaces typically require more paint
  const envMultiplier = environment === 'external' ? 1.15 : 1.0;
  coverage = coverage / envMultiplier; // reduce effective coverage
  // Calculate area to paint
  let paintArea;
  if (surface === 'wall') {
    // Perimeter area (2*length*height + 2*width*height)
    paintArea = (2 * length * height) + (2 * width * height) - (openings || 0);
  } else if (surface === 'floor') {
    paintArea = area;
  } else {
    paintArea = 0;
  }
  if (!isFinite(paintArea) || paintArea < 0) {
    paintArea = 0;
  }
  // Apply waste percentage
  const totalArea = paintArea * (1 + (waste || 0) / 100);
  // Calculate litres of paint required
  const litres = (totalArea * coats) / coverage;
  return {
    area: Number(totalArea.toFixed(2)),
    litres: Number(litres.toFixed(2))
  };
}

// Expose functions on window for non-module scripts
window.calcPaint = calcPaint;

/**
 * Generic evaluator for calculators defined by computed expressions.
 *
 * Each calculator in calculatorsData may define a `computed` object where
 * keys correspond to computed variables and values are JavaScript
 * expressions referencing input fields or previously computed values.
 * This helper evaluates those expressions sequentially and returns an
 * object with computed results. This is useful for simple calculators
 * where the logic can be expressed without writing custom code.
 *
 * @param {Object} calc - Calculator definition containing `computed` formulas.
 * @param {Object} inputs - Raw input values keyed by field key.
 * @returns {Object} computed values or NaN on failure.
 */
function evaluateCalculator(calc, inputs) {
  if (!calc || !calc.computed) return {};
  const computed = {};
  // Evaluate each formula in sequence, providing current inputs and
  // previously computed values as variables. We rely on Function to
  // evaluate expressions safely in a limited scope.
  for (const key of Object.keys(calc.computed)) {
    const expr = calc.computed[key];
    try {
      // Provide Math explicitly so expressions like Math.ceil() work inside
      // Function. Without this, the implicit Math in module scope may be
      // undefined when evaluating in isolated context.
      const vars = { Math: Math, ...inputs, ...computed };
      // Build a function that takes variable names as parameters
      // and returns the evaluated expression. This avoids using
      // eval directly and limits scope to provided variables.
      /* eslint no-new-func: 0 */
      computed[key] = Function(...Object.keys(vars), `return ${expr};`)(...Object.values(vars));
    } catch (e) {
      // If evaluation fails, assign NaN to the output
      computed[key] = NaN;
    }
  }
  return computed;
}

// Expose the generic evaluator on the window for access from non-module scripts
window.evaluateCalculator = evaluateCalculator;

/**
 * Calculate laminate flooring requirements.
 * @param {Object} inputs Input values including length, width, pack_area and waste
 * @returns {Object} { room_area, packs }
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

/**
 * Calculate tile requirements.
 */
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

/**
 * Calculate plaster mixture requirements.
 */
function calcPlaster(inputs) {
  const area = parseFloat(inputs.area) || 0;
  const thickness = parseFloat(inputs.thickness) || 0;
  const brand = inputs.brand || 'other';
  const bagWeight = parseFloat(inputs.bag_weight) || 0;
  const waste = parseFloat(inputs.waste) || 0;
  // Consumption rates per mm (kg/m²·мм) by brand. Default 1.0.
  const rates = {
    rotband: 0.85,
    ceresit: 1.3,
    knauf: 0.9,
    other: 1.0
  };
  const consumption = rates[brand] || 1.0;
  const kgNeeded = area * thickness * consumption * (1 + waste / 100);
  const bags = bagWeight > 0 ? Math.ceil(kgNeeded / bagWeight) : NaN;
  return {
    kg_needed: parseFloat(kgNeeded.toFixed(2)),
    bags: bags
  };
}

/**
 * Calculate putty requirements.
 */
function calcPutty(inputs) {
  // Calculate putty requirements similar to plaster but allow brand-specific rates
  const area = parseFloat(inputs.area) || 0;
  const thickness = parseFloat(inputs.thickness) || 0;
  const brand = inputs.brand || 'other';
  const bagWeight = parseFloat(inputs.bag_weight) || 0;
  const waste = parseFloat(inputs.waste) || 0;
  const rates = {
    rotband: 0.85,
    ceresit: 1.3,
    knauf: 0.9,
    other: 1.0
  };
  const consumption = rates[brand] || 1.0;
  const kgNeeded = area * thickness * consumption * (1 + waste / 100);
  const bags = bagWeight > 0 ? Math.ceil(kgNeeded / bagWeight) : NaN;
  return {
    kg_needed: parseFloat(kgNeeded.toFixed(2)),
    bags: bags
  };
}

/**
 * Calculate screed mixture requirements (thickness in cm).
 */
function calcScreed(inputs) {
  const area = parseFloat(inputs.area) || 0;
  const thickness = parseFloat(inputs.thickness) || 0;
  const bagWeight = parseFloat(inputs.bag_weight) || 0;
  const waste = parseFloat(inputs.waste) || 0;
  /*
   * Determine consumption per centimetre of thickness (kg/m²·см).
   * If a brand is supplied, use predefined norms; otherwise fall back to
   * an explicit consumption field (for backwards compatibility). Typical
   * values for common screed mixtures: Rotband ~18 kg/m²·см, Ceresit ~20,
   * Knauf MP75 ~17, other ~18. These norms reflect Russian GOST standards
   * for cement‑sand screeds【830095726183022†L99-L110】.
   */
  let consumption;
  if (inputs.brand) {
    const rates = { rotband: 18, ceresit: 20, knauf: 17, other: 18 };
    consumption = rates[inputs.brand] || 18;
  } else {
    consumption = parseFloat(inputs.consumption) || 0;
  }
  const kgNeeded = area * thickness * consumption * (1 + waste / 100);
  const bags = bagWeight > 0 ? Math.ceil(kgNeeded / bagWeight) : NaN;
  return {
    kg_needed: parseFloat(kgNeeded.toFixed(2)),
    bags: bags
  };
}

/**
 * Calculate wallpaper rolls.
 */
function calcWallpaper(inputs) {
  const perimeter = parseFloat(inputs.perimeter) || 0;
  const height = parseFloat(inputs.height) || 0;
  const rollLength = parseFloat(inputs.roll_length) || 0;
  const rollWidth = parseFloat(inputs.roll_width) || 0;
  const waste = parseFloat(inputs.waste) || 0;
  const wallArea = perimeter * height;
  const totalArea = wallArea * (1 + waste / 100);
  const rollArea = rollLength * rollWidth;
  const rolls = rollArea > 0 ? Math.ceil(totalArea / rollArea) : NaN;
  return {
    rolls: rolls
  };
}

/**
 * Calculate skirting boards.
 */
function calcSkirting(inputs) {
  const perimeter = parseFloat(inputs.perimeter) || 0;
  const unitLength = parseFloat(inputs.unit_length) || 0;
  const waste = parseFloat(inputs.waste) || 0;
  const totalLength = perimeter * (1 + waste / 100);
  const units = unitLength > 0 ? Math.ceil(totalLength / unitLength) : NaN;
  return {
    units: units
  };
}

/**
 * Calculate drywall sheets.
 */
function calcDrywall(inputs) {
  const area = parseFloat(inputs.area) || 0;
  const sheetLength = parseFloat(inputs.sheet_length) || 0;
  const sheetWidth = parseFloat(inputs.sheet_width) || 0;
  const waste = parseFloat(inputs.waste) || 0;
  const totalArea = area * (1 + waste / 100);
  const sheetArea = sheetLength * sheetWidth;
  const sheets = sheetArea > 0 ? Math.ceil(totalArea / sheetArea) : NaN;
  return {
    sheets: sheets
  };
}

/**
 * Calculate insulation boards.
 */
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

/**
 * Calculate slate sheet requirements.
 * Supports 7‑wave and 8‑wave corrugated slate with working areas based on
 * Russian standards. The user inputs total area and selects the slate type.
 * We multiply by the selected number of layers (default 1) and waste.
 * Working area values are taken from typical GOST sizes: 7‑wave ~1.33 m²,
 * 8‑wave ~1.57 m²【686115958985239†L96-L111】.
 * @param {Object} inputs Input values: area (m²), slate_type ('7_wave' or '8_wave'), layers, waste
 */
function calcSlate(inputs) {
  const area = parseFloat(inputs.area) || 0;
  const waste = parseFloat(inputs.waste) || 0;
  const layers = parseInt(inputs.layers, 10) || 1;
  const type = inputs.slate_type || '7_wave';
  // Working area per sheet depending on slate type
  const workingAreas = {
    '7_wave': 1.33, // м² per sheet【686115958985239†L96-L111】
    '8_wave': 1.57  // м² per sheet【686115958985239†L96-L111】
  };
  const sheetArea = workingAreas[type] || workingAreas['7_wave'];
  const totalArea = area * (1 + waste / 100) * layers;
  const sheets = sheetArea > 0 ? Math.ceil(totalArea / sheetArea) : NaN;
  return {
    sheets: sheets
  };
}

/**
 * Generic sheet calculator for materials like OSB, plywood, fibreboard or chipboard.
 * Calculates number of sheets based on area and sheet dimensions.
 * @param {Object} inputs Input values: area (m²), sheet_length (m), sheet_width (m), waste (%), layers (optional)
 */
function calcSheet(inputs) {
  const area = parseFloat(inputs.area) || 0;
  const length = parseFloat(inputs.sheet_length) || 0;
  const width = parseFloat(inputs.sheet_width) || 0;
  const waste = parseFloat(inputs.waste) || 0;
  const layers = parseInt(inputs.layers, 10) || 1;
  const totalArea = area * (1 + waste / 100) * layers;
  const sheetArea = length * width;
  const sheets = sheetArea > 0 ? Math.ceil(totalArea / sheetArea) : NaN;
  return {
    sheets: sheets
  };
}

// Expose sheet calculators on window for access from non-module scripts
window.calcSlate = calcSlate;
window.calcSheet = calcSheet;

// Expose custom calculators on window
window.calcLaminate = calcLaminate;
window.calcTile = calcTile;
window.calcPlaster = calcPlaster;
window.calcPutty = calcPutty;
window.calcScreed = calcScreed;
window.calcWallpaper = calcWallpaper;
window.calcSkirting = calcSkirting;
window.calcDrywall = calcDrywall;
window.calcInsulation = calcInsulation;
