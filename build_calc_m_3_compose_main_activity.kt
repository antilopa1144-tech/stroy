// package your.package.name
// Single-file Jetpack Compose (Material 3) demo with calculators
// Put this into: app/src/main/java/<your/package>/MainActivity.kt
// Minimum: Android Studio Jellyfish/Koala + Compose BOM 2024.10.00 or newer

package your.package.name

import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardOptions
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogProperties
import kotlin.math.ceil
import kotlin.math.max
import java.text.DecimalFormat

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { BuildCalcApp() }
    }
}

@Composable
fun BuildCalcApp() {
    val ctx = LocalContext.current
    val dynamic = Build.VERSION.SDK_INT >= 31
    val light = if (dynamic) dynamicLightColorScheme(ctx) else lightColorScheme()
    val dark = if (dynamic) dynamicDarkColorScheme(ctx) else darkColorScheme()

    MaterialTheme(colorScheme = if (isSystemInDarkTheme()) dark else light) {
        RootScaffold()
    }
}

// ---------------- Navigation root ----------------
@Composable
fun RootScaffold() {
    var index by remember { mutableStateOf(0) }
    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = index == 0,
                    onClick = { index = 0 },
                    icon = { Icon(Icons.Default.Apps, null) },
                    label = { Text("Кальк") }
                )
                NavigationBarItem(
                    selected = index == 1,
                    onClick = { index = 1 },
                    icon = { Icon(Icons.Default.Star, null) },
                    label = { Text("Избранное") }
                )
                NavigationBarItem(
                    selected = index == 2,
                    onClick = { index = 2 },
                    icon = { Icon(Icons.Default.Folder, null) },
                    label = { Text("Проекты") }
                )
                NavigationBarItem(
                    selected = index == 3,
                    onClick = { index = 3 },
                    icon = { Icon(Icons.Default.ReceiptLong, null) },
                    label = { Text("Смета") }
                )
                NavigationBarItem(
                    selected = index == 4,
                    onClick = { index = 4 },
                    icon = { Icon(Icons.Default.Settings, null) },
                    label = { Text("Настройки") }
                )
            }
        },
        floatingActionButton = {
            if (index == 0) FloatingActionButton(onClick = { /* новый проект */ }) {
                Icon(Icons.Default.Add, contentDescription = null)
            }
        }
    ) { padding ->
        Box(Modifier.padding(padding)) {
            when (index) {
                0 -> HomeCalculatorsPage()
                1 -> CenteredText("Избранное (скоро)")
                2 -> CenteredText("Проекты (скоро)")
                3 -> CenteredText("Смета (скоро)")
                4 -> SettingsPage()
            }
        }
    }
}

@Composable fun CenteredText(t: String) { Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text(t) } }

// ---------------- Data model ----------------

enum class FieldType { NUM, INT, SELECT }

data class SelectOpt(val value: String, val label: String)

data class FieldDef(
    val key: String,
    val label: String,
    val type: FieldType = FieldType.NUM,
    val unit: String = "",
    val def: String = "",
    val options: List<SelectOpt> = emptyList()
)

data class ResultDef(val key: String, val label: String, val unit: String = "", val money: Boolean = false)

data class CalcDef(
    val id: String,
    val title: String,
    val category: String,
    val icon: @Composable () -> Unit,
    val fields: List<FieldDef>,
    val outputs: List<ResultDef>,
    val hint: String
)

// ---------------- Calculators DB ----------------
val CALCS = listOf(
    // Краска
    CalcDef(
        id = "paint", title = "Краска", category = "ЛКМ", icon = { Icon(Icons.Default.FormatPaint, null) },
        fields = listOf(
            FieldDef("s", "Что красим", FieldType.SELECT, def = "w", options = listOf(
                SelectOpt("w", "Стены"), SelectOpt("c", "Потолок"), SelectOpt("a", "Всё")
            )),
            FieldDef("l", "Длина", unit = "м", def = "4"),
            FieldDef("w", "Ширина", unit = "м", def = "3"),
            FieldDef("h", "Высота", unit = "м", def = "2.7"),
            FieldDef("op", "Проемы", unit = "м²", def = "3"),
            FieldDef("coats", "Слоев", FieldType.INT, def = "2"),
            FieldDef("cov", "Расход (м²/л на слой)", def = "10"),
            FieldDef("price", "Цена л (опц.)", unit = "₽", def = "0")
        ),
        outputs = listOf(
            ResultDef("area", "Площадь", "м²"),
            ResultDef("need", "Нужно", "л"),
            ResultDef("cost", "Итого", "₽", money = true)
        ),
        hint = "Расход за один слой. Обычно — 2 слоя. Вычитайте окна и двери."
    ),

    // Грунтовка
    CalcDef(
        id = "primer", title = "Грунтовка", category = "ЛКМ", icon = { Icon(Icons.Default.LayersClear, null) },
        fields = listOf(
            FieldDef("t", "Тип", FieldType.SELECT, def = "0.15", options = listOf(
                SelectOpt("0.15", "Универсальная (0.15)"),
                SelectOpt("0.10", "Глубокая (0.10)"),
                SelectOpt("0.30", "Бетоноконтакт (0.30)")
            )),
            FieldDef("l", "Длина", unit = "м", def = "4"), FieldDef("w", "Ширина", unit = "м", def = "3"), FieldDef("h", "Высота", unit = "м", def = "2.7"),
            FieldDef("price", "Цена л/кг (опц.)", unit = "₽", def = "0")
        ),
        outputs = listOf(ResultDef("area", "Площадь", "м²"), ResultDef("need", "Нужно", "л/кг"), ResultDef("cost", "Итого", "₽", money = true)),
        hint = "Считаем стены и пол. На сильно впитывающих поверхностях — норму повышайте."
    ),

    // Штукатурка
    CalcDef(
        id = "plaster", title = "Штукатурка", category = "Смеси", icon = { Icon(Icons.Default.Texture, null) },
        fields = listOf(
            FieldDef("t", "Смесь", FieldType.SELECT, def = "0.85", options = listOf(
                SelectOpt("0.85", "Гипсовая (0.85 кг/м²·мм)"),
                SelectOpt("1.5", "Цементная (1.50 кг/м²·мм)")
            )),
            FieldDef("l", "Длина", unit = "м", def = "4"), FieldDef("w", "Ширина", unit = "м", def = "3"), FieldDef("h", "Высота", unit = "м", def = "2.7"),
            FieldDef("th", "Слой", unit = "мм", def = "10"), FieldDef("bag", "Мешок", unit = "кг", def = "30"), FieldDef("price", "Цена мешка (опц.)", unit = "₽", def = "0")
        ),
        outputs = listOf(ResultDef("kg", "Вес", "кг"), ResultDef("bags", "Мешков", "шт"), ResultDef("cost", "Итого", "₽", money = true)),
        hint = "Гипс — сухие помещения. Влажные — цемент. Толщина — средний слой."
    ),

    // Шпаклёвка (сухая)
    CalcDef(
        id = "putty_d", title = "Шпаклёвка (сухая)", category = "Смеси", icon = { Icon(Icons.Default.Wallpaper, null) },
        fields = listOf(
            FieldDef("t", "Тип", FieldType.SELECT, def = "0.9", options = listOf(
                SelectOpt("1.2", "Стартовая (1.2 кг/м²·мм)"), SelectOpt("0.9", "Финишная (0.9 кг/м²·мм)")
            )),
            FieldDef("l", "Длина", unit = "м", def = "4"), FieldDef("w", "Ширина", unit = "м", def = "3"), FieldDef("h", "Высота", unit = "м", def = "2.7"),
            FieldDef("th", "Слой", unit = "мм", def = "2"), FieldDef("bag", "Мешок", unit = "кг", def = "20"), FieldDef("price", "Цена мешка (опц.)", unit = "₽", def = "0")
        ),
        outputs = listOf(ResultDef("kg", "Вес", "кг"), ResultDef("bags", "Мешков", "шт"), ResultDef("cost", "Итого", "₽", money = true)),
        hint = "Старт — выравнивание, финиш — тонкий слой под покраску/обои."
    ),

    // Стяжка пола
    CalcDef(
        id = "screed", title = "Стяжка пола", category = "Смеси", icon = { Icon(Icons.Default.SquareFoot, null) },
        fields = listOf(
            FieldDef("l", "Длина", unit = "м", def = "4"), FieldDef("w", "Ширина", unit = "м", def = "3"),
            FieldDef("th", "Слой", unit = "СМ", def = "5"), FieldDef("bag", "Мешок", unit = "кг", def = "25"), FieldDef("price", "Цена мешка (опц.)", unit = "₽", def = "0")
        ),
        outputs = listOf(ResultDef("kg", "Вес", "кг"), ResultDef("bags", "Мешков", "шт"), ResultDef("cost", "Итого", "₽", money = true)),
        hint = "1 см стяжки на 1 м² ≈ 20 кг сухой смеси. Толщина — в сантиметрах."
    ),

    // Наливной пол
    CalcDef(
        id = "self_lvl", title = "Наливной пол", category = "Смеси", icon = { Icon(Icons.Default.WaterfallChart, null) },
        fields = listOf(
            FieldDef("l", "Длина", unit = "м", def = "4"), FieldDef("w", "Ширина", unit = "м", def = "3"),
            FieldDef("th", "Слой", unit = "мм", def = "10"), FieldDef("cov", "Расход (кг/м²·мм)", def = "1.6"),
            FieldDef("bag", "Мешок", unit = "кг", def = "20"), FieldDef("price", "Цена мешка (опц.)", unit = "₽", def = "0")
        ),
        outputs = listOf(ResultDef("kg", "Вес", "кг"), ResultDef("bags", "Мешков", "шт"), ResultDef("cost", "Итого", "₽", money = true)),
        hint = "Для тонкого выравнивания (3–10 мм). Толщина — в мм."
    ),

    // Плиточный клей
    CalcDef(
        id = "tile_gl", title = "Плиточный клей", category = "Смеси", icon = { Icon(Icons.Default.GridView, null) },
        fields = listOf(
            FieldDef("l", "Длина", unit = "м", def = "3"), FieldDef("w", "Ширина", unit = "м", def = "2"),
            FieldDef("sz", "Плитка", FieldType.SELECT, def = "5.0", options = listOf(
                SelectOpt("3.5", "Мелкая (до 30 см) ≈3.5 кг/м²"), SelectOpt("5.0", "Средняя (до 60 см) ≈5 кг/м²"), SelectOpt("6.0", "Крупная/керамогранит ≈6 кг/м²")
            )),
            FieldDef("bag", "Мешок", unit = "кг", def = "25"), FieldDef("price", "Цена мешка (опц.)", unit = "₽", def = "0")
        ),
        outputs = listOf(ResultDef("bags", "Мешков", "шт"), ResultDef("cost", "Итого", "₽", money = true)),
        hint = "Гребёнка: 6–8–10 мм для разной плитки. Крупный формат — расход выше."
    ),

    // Ламинат
    CalcDef(
        id = "laminate", title = "Ламинат", category = "Покрытия", icon = { Icon(Icons.Default.ViewDay, null) },
        fields = listOf(
            FieldDef("l", "Длина", unit = "м", def = "5"), FieldDef("w", "Ширина", unit = "м", def = "4"),
            FieldDef("pk", "В пачке", unit = "м²", def = "2.13"), FieldDef("price", "Цена пачки (опц.)", unit = "₽", def = "0")
        ),
        outputs = listOf(ResultDef("area", "Площадь", "м²"), ResultDef("packs", "Пачек", "шт"), ResultDef("substr", "Подложка", "м²"), ResultDef("cost", "Итого", "₽", money = true)),
        hint = "Запас: 5% прямая укладка, 10–15% диагональ. Подложка — +5%."
    ),

    // Потолок Армстронг
    CalcDef(
        id = "armstr", title = "Потолок Армстронг", category = "Стены/Потолки", icon = { Icon(Icons.Default.GridOn, null) },
        fields = listOf(
            FieldDef("l", "Длина", unit = "м", def = "6"), FieldDef("w", "Ширина", unit = "м", def = "4"),
            FieldDef("price", "Цена м² (опц.)", unit = "₽", def = "0")
        ),
        outputs = listOf(
            ResultDef("tiles", "Плит", "шт"), ResultDef("main37", "Профиль 3.7 м", "шт"), ResultDef("cross12", "Профиль 1.2 м", "шт"), ResultDef("cross06", "Профиль 0.6 м", "шт"), ResultDef("hangers", "Подвесы", "шт"), ResultDef("cost", "Итого", "₽", money = true)
        ),
        hint = "Сетка 600×600. Нормы на 1 м²: ~2.78 плит; 0.23×3.7 м; 1.4×1.2 м; 0.9×0.6 м; 0.7 подвеса."
    )
)

// ---------------- Home list ----------------
@Composable
fun HomeCalculatorsPage() {
    val grouped = remember { CALCS.groupBy { it.category } }
    LazyColumn(Modifier.fillMaxSize().padding(12.dp)) {
        grouped.forEach { (cat, list) ->
            item { Text(cat, style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(4.dp)) }
            items(list) { c -> CalcCard(c) }
            item { Spacer(Modifier.height(8.dp)) }
        }
    }
}

@Composable
fun CalcCard(c: CalcDef) {
    val sheetOpen = remember { mutableStateOf(false) }
    ElevatedCard(
        onClick = { sheetOpen.value = true },
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            c.icon()
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(c.title, style = MaterialTheme.typography.titleMedium)
                Text(c.category, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.secondary)
            }
            Icon(Icons.Default.ChevronRight, contentDescription = null)
        }
    }
    if (sheetOpen.value) {
        CalculatorDetailSheet(calc = c, onClose = { sheetOpen.value = false })
    }
}

// -------------- Detail as ModalBottomSheet (full-screen height) --------------
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalculatorDetailSheet(calc: CalcDef, onClose: () -> Unit) {
    var waste by remember { mutableStateOf(5) } // 0/5/10
    val inputs = remember { mutableStateMapOf<String, String>() }
    // init defaults
    LaunchedEffect(calc.id) {
        inputs.clear(); calc.fields.forEach { inputs[it.key] = it.def }
    }

    var hintOpen by remember { mutableStateOf(false) }

    ModalBottomSheet(
        onDismissRequest = onClose,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false),
        dragHandle = { BottomSheetDefaults.DragHandle() },
        tonalElevation = 1.dp
    ) {
        Column(Modifier.fillMaxHeight().padding(horizontal = 16.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                calc.icon(); Spacer(Modifier.width(8.dp))
                Text(calc.title, style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
                IconButton(onClick = onClose) { Icon(Icons.Default.Close, null) }
            }
            Spacer(Modifier.height(8.dp))

            LazyColumn(Modifier.fillMaxWidth().weight(1f), contentPadding = PaddingValues(bottom = 160.dp)) {
                items(calc.fields) { f ->
                    Text(f.label, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.secondary)
                    Spacer(Modifier.height(6.dp))
                    when (f.type) {
                        FieldType.SELECT -> SelectField(value = inputs[f.key] ?: f.def, options = f.options) { v -> inputs[f.key] = v }
                        FieldType.INT -> IntField(value = inputs[f.key] ?: f.def, unit = f.unit) { v -> inputs[f.key] = v }
                        FieldType.NUM -> NumField(value = inputs[f.key] ?: f.def, unit = f.unit) { v -> inputs[f.key] = v }
                    }
                    Spacer(Modifier.height(12.dp))
                }

                item {
                    Text("Запас на отходы", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.secondary)
                    Spacer(Modifier.height(6.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(0,5,10).forEach { opt ->
                            FilterChip(
                                selected = waste == opt,
                                onClick = { waste = opt },
                                label = { Text("$opt%") }
                            )
                        }
                    }
                }
            }

            // Итоговый блок (закреплён снизу)
            val res = remember(calc.id, inputs.toMap(), waste) { CalculatorEngine.calculate(calc, inputs, waste) }
            ResultPanel(calc = calc, res = res, onHint = { hintOpen = true })

            Spacer(Modifier.height(8.dp))
        }
    }

    if (hintOpen) HintSheet(text = calc.hint) { hintOpen = false }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HintSheet(text: String, onClose: () -> Unit) {
    ModalBottomSheet(
        onDismissRequest = onClose,
        sheetState = rememberModalBottomSheetState(),
        dragHandle = { BottomSheetDefaults.DragHandle() },
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Column(Modifier.fillMaxWidth().padding(16.dp)) {
            Text("Подсказка", style = MaterialTheme.typography.titleLarge)
            Spacer(Modifier.height(8.dp))
            Text(text, style = MaterialTheme.typography.bodyLarge)
            Spacer(Modifier.height(16.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = onClose) { Text("Закрыть") }
            }
        }
    }
}

@Composable
fun ResultPanel(calc: CalcDef, res: Map<String, Double>, onHint: () -> Unit) {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth().heightIn(min = 140.dp).padding(vertical = 8.dp),
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp)
    ) {
        Column(Modifier.fillMaxWidth().padding(16.dp)) {
            Text("Итого", style = MaterialTheme.typography.titleLarge)
            Spacer(Modifier.height(6.dp))
            calc.outputs.forEach { o ->
                res[o.key]?.let { v -> ResultRow(label = o.label, unit = o.unit, value = v, money = o.money) }
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilledTonalButton(onClick = { /* add to estimate */ }) { Icon(Icons.Default.Add, null); Spacer(Modifier.width(6.dp)); Text("В смету") }
                FilledTonalButton(onClick = onHint) { Icon(Icons.Default.Lightbulb, null); Spacer(Modifier.width(6.dp)); Text("Подсказка") }
                FilledTonalButton(onClick = { /* save */ }) { Icon(Icons.Default.Save, null); Spacer(Modifier.width(6.dp)); Text("Сохранить") }
            }
        }
    }
}

@Composable
fun ResultRow(label: String, unit: String, value: Double, money: Boolean = false) {
    val txt = if (money) fmtMoney(value) else fmt(value)
    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(txt, style = MaterialTheme.typography.titleLarge)
            if (unit.isNotBlank()) { Spacer(Modifier.width(4.dp)); Text(unit, style = MaterialTheme.typography.labelLarge) }
        }
    }
}

@Composable
fun NumField(value: String, unit: String = "", onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = { onChange(it.replace(',', '.')) },
        keyboardOptions = KeyboardOptions.Default.copy(keyboardType = androidx.compose.ui.text.input.KeyboardType.Number),
        trailingIcon = { if (unit.isNotBlank()) Text(unit) },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true
    )
}

@Composable
fun IntField(value: String, unit: String = "", onChange: (String) -> Unit) {
    var text by remember { mutableStateOf(value) }
    LaunchedEffect(value) { if (value != text) text = value }
    Row(verticalAlignment = Alignment.CenterVertically) {
        OutlinedTextField(
            value = text,
            onValueChange = { v -> text = v.filter { it.isDigit() }; onChange(text.ifBlank { "0" }) },
            keyboardOptions = KeyboardOptions.Default.copy(keyboardType = androidx.compose.ui.text.input.KeyboardType.Number),
            trailingIcon = { if (unit.isNotBlank()) Text(unit) },
            modifier = Modifier.weight(1f), singleLine = true
        )
        Spacer(Modifier.width(8.dp))
        AssistChip(onClick = { val n = (text.toIntOrNull() ?: 0) - 1; text = max(0, n).toString(); onChange(text) }, label = { Text("–") })
        Spacer(Modifier.width(6.dp))
        AssistChip(onClick = { val n = (text.toIntOrNull() ?: 0) + 1; text = n.toString(); onChange(text) }, label = { Text("+") })
    }
}

@Composable
fun SelectField(value: String, options: List<SelectOpt>, onSelect: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    val current = options.firstOrNull { it.value == value }?.label ?: "—"
    OutlinedTextField(
        value = current,
        onValueChange = {},
        readOnly = true,
        trailingIcon = { Icon(if (expanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown, null) },
        modifier = Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface),
        singleLine = true,
        label = null,
        enabled = true
    )
    DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
        options.forEach { o -> DropdownMenuItem(text = { Text(o.label) }, onClick = { onSelect(o.value); expanded = false }) }
    }
    Box(modifier = Modifier.matchParentSize()) { Spacer(Modifier.fillMaxSize().background(color = androidx.compose.ui.graphics.Color.Transparent).noIndicationClickable { expanded = true }) }
}

// helper to make any Box clickable without ripple
@Composable
fun Modifier.noIndicationClickable(onClick: () -> Unit): Modifier = this.then(
    Modifier
        .background(androidx.compose.ui.graphics.Color.Transparent)
        .padding(0.dp)
        .let { base -> androidx.compose.foundation.clickable(indication = null, interactionSource = remember { MutableInteractionSource() }) { onClick() } }
)

// ---------------- Engine ----------------
object CalculatorEngine {
    fun calculate(calc: CalcDef, inputs: Map<String, String>, waste: Int): Map<String, Double> {
        val W = 1 + waste / 100.0
        fun num(k: String, def: Double = 0.0) = inputs[k]?.toDoubleOrNull() ?: def
        fun str(k: String, def: String = "") = inputs[k] ?: def
        val L = num("l"), Wd = num("w"), H = num("h")
        val area = L * Wd
        val walls = (L + Wd) * 2 * if (H == 0.0) 1.0 else H
        val res = mutableMapOf<String, Double>()

        when (calc.id) {
            "paint" -> {
                val s = str("s", "w")
                val op = num("op")
                val coats = num("coats", 1.0).toInt()
                val cov = num("cov", 10.0)
                val price = num("price")
                var a = when (s) { "w" -> walls; "c" -> area; else -> walls + area }
                a = max(0.0, a - op)
                val need = (a * coats / cov) * W
                res["area"] = a
                res["need"] = need
                if (price > 0) res["cost"] = need * price
            }
            "primer" -> {
                val t = num("t", 0.15)
                val price = num("price")
                val a = area + walls
                val need = a * t * W
                res["area"] = a; res["need"] = need; if (price > 0) res["cost"] = need * price
            }
            "plaster" -> {
                val t = num("t", 0.85)
                val th = num("th", 10.0)
                val bag = num("bag", 30.0)
                val price = num("price")
                val kg = walls * th * t * W
                val bags = ceil(kg / bag)
                res["kg"] = kg; res["bags"] = bags; if (price > 0) res["cost"] = bags * price
            }
            "putty_d" -> {
                val t = num("t", 0.9)
                val th = num("th", 2.0)
                val bag = num("bag", 20.0)
                val price = num("price")
                val kg = walls * th * t * W
                val bags = ceil(kg / bag)
                res["kg"] = kg; res["bags"] = bags; if (price > 0) res["cost"] = bags * price
            }
            "screed" -> {
                val thcm = num("th", 5.0)
                val bag = num("bag", 25.0)
                val price = num("price")
                val kg = area * thcm * 20.0 * W
                val bags = ceil(kg / bag)
                res["kg"] = kg; res["bags"] = bags; if (price > 0) res["cost"] = bags * price
            }
            "self_lvl" -> {
                val th = num("th", 10.0)
                val cov = num("cov", 1.6)
                val bag = num("bag", 20.0)
                val price = num("price")
                val kg = area * th * cov * W
                val bags = ceil(kg / bag)
                res["kg"] = kg; res["bags"] = bags; if (price > 0) res["cost"] = bags * price
            }
            "tile_gl" -> {
                val kgpm2 = num("sz", 5.0)
                val bag = num("bag", 25.0)
                val price = num("price")
                val needKg = area * kgpm2 * W
                val bags = ceil(needKg / bag)
                res["bags"] = bags; if (price > 0) res["cost"] = bags * price
            }
            "laminate" -> {
                val pk = num("pk", 2.13)
                val price = num("price")
                val packs = ceil(area * W / pk)
                res["area"] = area; res["packs"] = packs; res["substr"] = area * 1.05
                if (price > 0) res["cost"] = packs * price
            }
            "armstr" -> {
                val price = num("price")
                val a = area
                val tilesPerM2 = 2.7778
                val main37PerM2 = 0.23
                val cross12PerM2 = 1.40
                val cross06PerM2 = 0.90
                val hangersPerM2 = 0.70
                val tiles = ceil(a * tilesPerM2 * W)
                val main37 = ceil(a * main37PerM2 * W)
                val cross12 = ceil(a * cross12PerM2 * W)
                val cross06 = ceil(a * cross06PerM2 * W)
                val hangers = ceil(a * hangersPerM2 * W)
                res["tiles"] = tiles; res["main37"] = main37; res["cross12"] = cross12; res["cross06"] = cross06; res["hangers"] = hangers
                if (price > 0) res["cost"] = a * W * price
            }
        }
        return res
    }
}

// ---------------- utils ----------------
private val dec1 = DecimalFormat("#,##0.0")
private val dec0 = DecimalFormat("#,##0")
fun fmt(n: Double): String = if (kotlin.math.abs(n - n.toLong()) < 1e-9) dec0.format(n) else dec1.format(n)
fun fmtMoney(n: Double): String = dec0.format(n)
