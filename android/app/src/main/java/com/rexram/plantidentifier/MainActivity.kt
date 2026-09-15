package com.rexram.plantidentifier

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.BitmapFactory
import android.location.LocationManager
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.*
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import org.json.JSONObject
import org.json.JSONArray
import java.io.File
import java.net.URL
import java.net.HttpURLConnection
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {
    private val preferences by lazy { getSharedPreferences("native-settings", Context.MODE_PRIVATE) }
    private val copy by lazy { JSONObject(assets.open("native_ui.json").bufferedReader().use { it.readText() }) }
    private var lang = "he"
    private var dark = true
    private var large = false
    private var useLocation = false
    private val open = mutableSetOf<String>()
    private val inference = Executors.newSingleThreadExecutor()
    private val network = Executors.newFixedThreadPool(3)
    private var classifier: OpenPlantsClassifier? = null
    private var busy = false
    private var generation = 0
    private var infoGeneration = 0
    private var pendingCameraUri: Uri? = null
    private var previewUri: Uri? = null
    private var query = ""
    private var statusKey = "empty"
    private var predictions = emptyList<RegionalRanking.Item>()
    private var info: PlantInfoService.PlantInfo? = null
    private var infoLoading = false
    private var infoQuery: String? = null
    private var ministry: MinistryWaterPlantsService.WaterPlant? = null
    private var ornamentalText: String? = null
    private lateinit var body: LinearLayout
    private lateinit var scroll: ScrollView
    private lateinit var input: EditText
    private lateinit var statusView: TextView
    private val bitmaps = object : android.util.LruCache<String, android.graphics.Bitmap>(8 * 1024 * 1024) {
        override fun sizeOf(key: String, value: android.graphics.Bitmap) = value.byteCount
    }
    private val photoCache = mutableMapOf<String, List<Photo>>()
    private val photosLoading = mutableSetOf<String>()
    private val photosFailed = mutableSetOf<String>()
    private data class Photo(val url: String, val attribution: String)
    private val plants = listOf("Pelargonium", "Mentha", "Petunia", "Ocimum basilicum", "Salvia rosmarinus", "succulent", "Cactaceae", "Bougainvillea", "Epipremnum aureum", "Lavandula")

    private val permission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        useLocation = granted
        preferences.edit().putBoolean("location", granted).apply()
        if (!granted) statusKey = "permission"
        render()
    }
    private val picker = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri -> if (uri != null) identify(uri) }
    private val camera = registerForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        val uri = pendingCameraUri
        if (success && uri != null) identify(uri) else setStatus("cameraCancelled")
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        lang = preferences.getString("language", "he")!!.takeIf { it in listOf("he","en","ar") } ?: "he"
        dark = preferences.getBoolean("dark", true)
        large = preferences.getBoolean("large", false)
        useLocation = preferences.getBoolean("location", false)
        query = savedInstanceState?.getString("query") ?: ""
        pendingCameraUri = savedInstanceState?.getString("camera")?.let(Uri::parse)
        savedInstanceState?.getStringArrayList("open")?.let { open.addAll(it) }
        savedInstanceState?.getString("predictions")?.let { encoded ->
            val array = JSONArray(encoded)
            predictions = (0 until array.length()).map {
                val row = array.getJSONObject(it)
                RegionalRanking.Item(row.getString("name"), row.getDouble("score").toFloat(), if (row.isNull("count")) null else row.getInt("count"))
            }
        }
        statusKey = savedInstanceState?.getString("status") ?: "empty"
        if (statusKey in listOf("modelPreparing","analysing","loading")) statusKey = "empty"
        infoQuery = savedInstanceState?.getString("infoQuery")
        render()
        infoQuery?.let { loadInfo(it, true) }
    }
    override fun onSaveInstanceState(outState: Bundle) {
        outState.putString("query", input.text.toString())
        outState.putString("camera", pendingCameraUri?.toString())
        outState.putString("status", statusKey)
        outState.putString("infoQuery", info?.scientificName ?: infoQuery)
        outState.putStringArrayList("open", ArrayList(open))
        outState.putString("predictions", JSONArray().apply { predictions.forEach { put(JSONObject().put("name",it.name).put("score",it.modelScore).put("count",it.observations ?: JSONObject.NULL)) } }.toString())
        super.onSaveInstanceState(outState)
    }

    private fun t(key: String): String = copy.getJSONObject(lang).optString(key, copy.getJSONObject("he").optString(key, key))
    private fun dp(value: Int) = (resources.displayMetrics.density * value).toInt()
    private fun color(d: String, l: String) = Color.parseColor(if (dark) d else l)
    private val foreground get() = color("#F3F8F4","#102018")
    private val muted get() = color("#C9D9CF","#42574A")
    private val accent get() = color("#A6E8BD","#235D39")
    private val surface get() = color("#0F2419","#FFFFFF")

    private fun text(value: String, size: Float = 18f, bold: Boolean = false) = TextView(this).apply {
        text = value
        textSize = size * if (large) 1.22f else 1f
        setTextColor(foreground)
        gravity = Gravity.CENTER
        textDirection = View.TEXT_DIRECTION_LOCALE
        if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
        setPadding(0, dp(6), 0, dp(6))
    }
    private fun column() = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; layoutParams = LinearLayout.LayoutParams(-1,-2) }
    private fun button(value: String, action: () -> Unit) = MaterialButton(this).apply {
        text = value
        isAllCaps = false
        textSize = 18f * if (large) 1.22f else 1f
        minHeight = dp(52)
        cornerRadius = dp(22)
        backgroundTintList = ColorStateList.valueOf(accent)
        setTextColor(color("#062110","#FFFFFF"))
        layoutParams = LinearLayout.LayoutParams(-1,-2).apply { topMargin = dp(5) }
        setOnClickListener { action() }
    }
    private fun card(parent: LinearLayout, populate: (LinearLayout) -> Unit) {
        val card = MaterialCardView(this).apply {
            radius = dp(26).toFloat()
            cardElevation = 0f
            setCardBackgroundColor(surface)
            strokeColor = color("#365746","#9CB4A5")
            strokeWidth = dp(1)
            layoutParams = LinearLayout.LayoutParams(-1,-2).apply { topMargin = dp(16) }
        }
        val content = column().apply { setPadding(dp(18),dp(12),dp(18),dp(12)) }
        populate(content)
        card.addView(content)
        parent.addView(card)
    }
    private fun fold(parent: LinearLayout, key: String, title: String, populate: (LinearLayout) -> Unit) {
        val content = column()
        val heading = button(title) {}
        heading.backgroundTintList = ColorStateList.valueOf(surface)
        heading.setTextColor(accent)
        fun update() {
            content.visibility = if (key in open) View.VISIBLE else View.GONE
            ViewCompat.setStateDescription(heading, t(if (key in open) "expanded" else "collapsed"))
        }
        heading.setOnClickListener {
            if (!open.add(key)) open.remove(key)
            update()
        }
        parent.addView(heading)
        populate(content)
        parent.addView(content)
        update()
    }
    private fun render() {
        if (isDestroyed || isFinishing) return
        val previousScroll = if (::scroll.isInitialized) scroll.scrollY else 0
        if (::input.isInitialized) query = input.text.toString()
        val direction = if (lang == "en") View.LAYOUT_DIRECTION_LTR else View.LAYOUT_DIRECTION_RTL
        window.decorView.layoutDirection = direction
        findViewById<View>(android.R.id.content).layoutDirection = direction
        window.statusBarColor = color("#08150F","#EEF5F0")
        window.navigationBarColor = window.statusBarColor
        WindowInsetsControllerCompat(window,window.decorView).apply {
            isAppearanceLightStatusBars = !dark
            isAppearanceLightNavigationBars = !dark
        }
        scroll = ScrollView(this).apply { setBackgroundColor(color("#08150F","#EEF5F0")); isFillViewport = true; layoutDirection = direction }
        body = column().apply { setPadding(dp(20),dp(18),dp(20),dp(24)) }
        scroll.addView(body)
        setContentView(scroll)
        ViewCompat.setOnApplyWindowInsetsListener(scroll) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(bars.left,bars.top,bars.right,bars.bottom)
            insets
        }
        body.addView(text(t("title"),30f,true))
        body.addView(text(t("appSubtitle"),17f).apply { setTextColor(accent) })
        fold(body,"settings",t("settings")) { panel ->
            listOf("he" to "עברית","en" to "English","ar" to "العربية").forEach { (code,label) ->
                panel.addView(button(label) {
                    lang = code
                    preferences.edit().putString("language",lang).apply()
                    render()
                    info?.scientificName?.let { loadInfo(it,true) }
                })
            }
            panel.addView(button(t("theme")) {
                dark = !dark; preferences.edit().putBoolean("dark",dark).apply(); render()
            }.apply { isCheckable = true; isChecked = dark })
            panel.addView(button(t("font")) {
                large = !large; preferences.edit().putBoolean("large",large).apply(); render()
            }.apply { isCheckable = true; isChecked = large })
            panel.addView(button(t("location")) {
                if (useLocation) {
                    useLocation = false
                    preferences.edit().putBoolean("location",false).apply()
                    render()
                } else permission.launch(Manifest.permission.ACCESS_COARSE_LOCATION)
            }.apply { isCheckable = true; isChecked = useLocation })
            panel.addView(text(t("version") + " " + BuildConfig.VERSION_NAME,14f))
        }
        card(body) { box ->
            box.addView(text(t("searchTitle"),24f,true))
            box.addView(text(t("searchText"),17f))
            input = EditText(this).apply {
                hint = t("searchLabel"); setHintTextColor(muted)
                setText(query); setTextColor(foreground)
                textSize = if (large) 23f else 19f
                minHeight = dp(56); setSingleLine(true)
                imeOptions = EditorInfo.IME_ACTION_SEARCH
                isEnabled = !busy
                setOnEditorActionListener { _,action,_ -> if (action == EditorInfo.IME_ACTION_SEARCH) { search(); true } else false }
            }
            box.addView(input)
            box.addView(button(t("searchButton")) { search() }.apply { isEnabled = !busy })
        }
        card(body) { box ->
            box.addView(text(t("photoTitle"),24f,true))
            box.addView(text(t("photoShort"),17f))
            box.addView(button(t("camera")) {
                runCatching {
                    val directory = File(cacheDir,"camera").apply { mkdirs() }
                    pendingCameraUri = FileProvider.getUriForFile(this,BuildConfig.APPLICATION_ID + ".fileprovider",File.createTempFile("plant_",".jpg",directory))
                    camera.launch(pendingCameraUri!!)
                }.onFailure { setStatus("cameraError") }
            }.apply { isEnabled = !busy })
            box.addView(button(t("gallery")) { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }.apply { isEnabled = !busy })
            fold(box,"firstUse",t("firstUse")) { it.addView(text(t("photoText"),16f)) }
        }
        previewUri?.let { uri ->
            card(body) { box ->
                box.addView(ImageView(this).apply {
                    contentDescription = t("photoPreview")
                    scaleType = ImageView.ScaleType.FIT_CENTER
                    layoutParams = LinearLayout.LayoutParams(-1,dp(220))
                    runCatching { setImageURI(uri) }
                })
            }
        }
        statusView = text(t(statusKey),17f).apply { accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE }
        body.addView(statusView)
        if (predictions.isNotEmpty()) {
            body.addView(text(t("results"),24f,true))
            body.addView(text("OpenPlants • " + t("scoreNote"),16f))
            predictions.forEachIndexed { i,item ->
                card(body) { box ->
                    box.addView(text("${i+1}. ${item.name}",20f,true))
                    box.addView(text(t("confidence") + ": " + String.format(java.util.Locale.ROOT,"%.1f%%",item.modelScore*100),19f))
                    item.observations?.let { count -> box.addView(text(t("nearbyObservations") + ": $count",16f)) }
                    box.addView(button(t("details")) { loadInfo(item.name,true) })
                    fold(box,"photos:" + item.name,t("viewPhotos")) { photoBox ->
                        val rows = photoCache[item.name]
                        if (rows != null) {
                            rows.forEach { photo -> addRemoteImage(photoBox,photo.url,photo.attribution) }
                            photoBox.addView(button(t("compare")) { openUrl("https://www.inaturalist.org/taxa/search?q=" + Uri.encode(item.name)) })
                        } else photoBox.addView(button(t(if (item.name in photosLoading) "loadingPhotos" else if (item.name in photosFailed) "photosError" else "viewPhotos")) { loadPhotos(item.name) }.apply { isEnabled = item.name !in photosLoading })
                    }
                }
            }
        }
        if (infoLoading && info == null) body.addView(text(t("loading")))
        info?.let { plant ->
            card(body) { box ->
                box.addView(text(plant.wikipediaTitle ?: plant.scientificName,23f,true))
                box.addView(text(t("scientificName") + ": " + plant.scientificName,17f))
                box.addView(text(plant.wikipediaExtract ?: t("noArticle"),17f))
                plant.articleLanguage?.let { box.addView(text("Wikipedia ($it)",14f)) }
                plant.imageUrl?.let { addRemoteImage(box,it,plant.wikipediaTitle ?: plant.scientificName) }
                val index = plants.indexOfFirst { plant.scientificName.equals(it,true) || plant.scientificName.startsWith(it + " ",true) }
                if (index >= 0) fold(box,"care",t("growingTitle")) { it.addView(text(t("guide$index"))) }
                plant.wikipediaUrl?.let { url -> box.addView(button(t("wiki")) { openUrl(url) }) }
                box.addView(button(t("compare")) { openUrl(plant.iNaturalistUrl) })
                box.addView(button(t("gbif")) { openUrl(plant.gbifUrl) })
                fold(box,"israeli",t("hebrewSources")) { more ->
                    val guide = runCatching { GrowingGuideRepository.find(applicationContext,plant.scientificName) }.getOrNull()
                    if (guide != null) more.addView(text(GrowingGuideRepository.formatHebrew(guide),17f).apply { textDirection = View.TEXT_DIRECTION_RTL })
                    ministry?.let { more.addView(text(MinistryWaterPlantsService.formatHebrew(it),17f).apply { textDirection = View.TEXT_DIRECTION_RTL }) }
                    ornamentalText?.let { more.addView(text(it,17f).apply { textDirection = View.TEXT_DIRECTION_RTL }) }
                    more.addView(button(t("ministry")) { openUrl(MinistryWaterPlantsService.SOURCE_URL) })
                    more.addView(button(t("ornamental")) { openUrl(OrnamentalPlantsListSource.SOURCE_URL) })
                }
            }
        }
        fold(body,"balcony",t("balconyTitle")) { panel ->
            panel.addView(text(t("balconyIntro"),17f))
            plants.forEachIndexed { index,scientific ->
                fold(panel,"plant:$index",t("plant$index")) { guide ->
                    guide.addView(text(t("guide$index"),17f))
                    if (scientific != "succulent") guide.addView(button(t("searchButton")) {
                        input.setText(scientific); search()
                        scroll.smoothScrollTo(0,0)
                    })
                }
            }
            panel.addView(text(t("balconyNote"),16f))
        }
        fold(body,"sources",t("sourceInfo")) { panel ->
            listOf(0,2,3,4).forEach { panel.addView(text(t("source$it"),16f)) }
            panel.addView(text(t("scoreNote"),16f))
        }
        scroll.post { scroll.scrollTo(0,previousScroll) }
    }
    private fun setStatus(key: String) { statusKey = key; if (::statusView.isInitialized) statusView.text = t(key) }
    private fun ui(action: () -> Unit) { runOnUiThread { if (!isDestroyed && !isFinishing) action() } }

    private fun identify(uri: Uri) {
        if (busy) return
        busy = true; val id = ++generation; ++infoGeneration
        previewUri = uri; info = null; infoQuery = null; infoLoading = false; predictions = emptyList()
        statusKey = "modelPreparing"; render()
        inference.execute {
            try {
                val engine = classifier ?: OpenPlantsClassifier(applicationContext).also { classifier = it }
                engine.prepare()
                ui { if (id == generation) setStatus("analysing") }
                val rows = engine.classify(uri,3).map { RegionalRanking.Item(it.name,it.probability) }
                ui {
                    if (id == generation) {
                        predictions = rows; busy = false; statusKey = "modelOnly"; render()
                        enrichLocation(id,rows)
                    }
                }
            } catch (_: Throwable) {
                ui { if (id == generation) { busy = false; statusKey = "aiError"; render() } }
            }
        }
    }
    private fun enrichLocation(id: Int, rows: List<RegionalRanking.Item>) {
        if (!useLocation || ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) return
        val manager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val location = runCatching {
            manager.getProviders(true).mapNotNull { manager.getLastKnownLocation(it) }
                .filter { System.currentTimeMillis() - it.time < 3600000 }.maxByOrNull { it.time }
        }.getOrNull() ?: return
        network.execute {
            val ranked = runCatching { CandidateReranker.rerank(rows,location.latitude,location.longitude) }.getOrNull()
            ui { if (id == generation && useLocation && ranked != null) { predictions = ranked; statusKey = if (ranked.any { it.observations == null }) "geoUnavailable" else "locationDone"; render() } }
        }
    }
    private fun search() {
        if (busy) return
        query = input.text.toString().trim()
        if (query.isEmpty()) { setStatus("empty"); return }
        ++generation; predictions = emptyList(); previewUri = null
        loadInfo(query,false)
    }
    private fun loadInfo(name: String, scientific: Boolean) {
        val id = ++infoGeneration
        val language = lang
        infoQuery = name
        if (info?.scientificName != name) info = null
        infoLoading = true; ministry = null; ornamentalText = null
        statusKey = "loading"; render()
        network.execute {
            try {
                val loaded = PlantInfoService.load(name,language,scientific)
                ui {
                    if (id == infoGeneration) {
                        info = loaded; infoQuery = loaded.scientificName; infoLoading = false; statusKey = "infoReady"; render()
                        loadIsraeliInfo(id,loaded)
                    }
                }
            } catch (error: Throwable) {
                ui {
                    if (id == infoGeneration) {
                        infoLoading = false
                        statusKey = if (error is NoSuchElementException) "noResults" else "error"
                        render()
                    }
                }
            }
        }
    }
    private fun loadIsraeliInfo(id: Int, plant: PlantInfoService.PlantInfo) {
        network.execute {
            val water = runCatching { MinistryWaterPlantsService.lookup(plant.hebrewName,plant.scientificName) }.getOrNull()
            val ornamental = runCatching { OrnamentalPlantsRepository.find(applicationContext,plant.scientificName,plant.hebrewName) }.getOrNull()
            ui { if (id == infoGeneration) {
                ministry = water
                ornamentalText = ornamental?.let { OrnamentalPlantsRepository.formatHebrew(it) } ?: OrnamentalPlantsListSource.SUMMARY_HE
                render()
            } }
        }
    }
    private fun loadPhotos(name: String) {
        if (!photosLoading.add(name)) return
        photosFailed.remove(name); render()
        network.execute {
            val photos = runCatching {
                val rows = PlantInfoService.json("https://api.inaturalist.org/v1/taxa?q=" + PlantInfoService.encode(name) + "&per_page=10").getJSONArray("results")
                val taxon = (0 until rows.length()).map { rows.getJSONObject(it) }.firstOrNull { it.optString("name").equals(name,true) }
                    ?: throw NoSuchElementException()
                val observations = PlantInfoService.json("https://api.inaturalist.org/v1/observations?taxon_id=" + taxon.getInt("id") + "&photos=true&quality_grade=research&per_page=4").getJSONArray("results")
                val result = mutableListOf<Photo>()
                for (i in 0 until observations.length()) {
                    val photo = observations.getJSONObject(i).optJSONArray("photos")?.optJSONObject(0) ?: continue
                    result.add(Photo(photo.getString("url").replace("/square.","/medium."),photo.optString("attribution")))
                }
                result
            }
            ui {
                photosLoading.remove(name)
                photos.onSuccess { photoCache[name] = it }.onFailure { photosFailed.add(name) }
                render()
            }
        }
    }
    private fun addRemoteImage(parent: LinearLayout, url: String, caption: String) {
        val image = ImageView(this).apply { contentDescription = caption; scaleType = ImageView.ScaleType.FIT_CENTER; layoutParams = LinearLayout.LayoutParams(-1,dp(210)) }
        parent.addView(image)
        if (caption.isNotBlank()) parent.addView(text(caption,13f))
        bitmaps.get(url)?.let { image.setImageBitmap(it); return }
        network.execute {
            val bitmap = bitmaps.get(url) ?: runCatching {
                require(url.startsWith("https://"))
                val connection = (URL(url).openConnection() as HttpURLConnection).apply { connectTimeout = 8000; readTimeout = 8000 }
                try { connection.inputStream.use { BitmapFactory.decodeStream(it) } } finally { connection.disconnect() }
            }.getOrNull()
            ui { if (bitmap != null) { bitmaps.put(url,bitmap); if (image.isAttachedToWindow) image.setImageBitmap(bitmap) } }
        }
    }
    private fun openUrl(url: String) { runCatching { startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(url))) }.onFailure { setStatus("error") } }
    override fun onDestroy() {
        network.shutdownNow()
        inference.execute { classifier?.close(); classifier = null }
        inference.shutdown()
        super.onDestroy()
    }
}
