package com.rexram.plantidentifier

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.location.Location
import android.location.LocationManager
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.material.card.MaterialCardView
import com.rexram.plantidentifier.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var classifier: OpenPlantsClassifier
    private var currentInfo: PlantInfoService.PlantInfo? = null

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { }

    private val photoPicker = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri == null) return@registerForActivityResult

        binding.previewImage.setImageURI(uri)
        binding.previewCard.visibility = View.VISIBLE
        binding.resultsTitle.visibility = View.GONE
        binding.resultsContainer.removeAllViews()
        binding.infoCard.visibility = View.GONE
        currentInfo = null
        setStatus("מכין את מנוע OpenPlants…")
        binding.choosePhotoButton.isEnabled = false

        Thread {
            try {
                classifier.prepare { message -> runOnUiThread { setStatus(message) } }
                runOnUiThread { setStatus("מזהה את הצמח בתמונה…") }

                // Ask OpenPlants for a few candidates, then use local occurrence
                // evidence to resolve close visual matches when location is available.
                val rawPredictions = classifier.classify(uri, 5)
                val location = getBestLastKnownLocation()
                val finalPredictions: List<OpenPlantsClassifier.Prediction>
                val locationAdjusted: Boolean

                if (location != null && rawPredictions.isNotEmpty()) {
                    runOnUiThread { setStatus("מאמת את התוצאות לפי תצפיות צמחים באזור שלך…") }
                    val reranked = CandidateReranker.rerank(
                        rawPredictions,
                        location.latitude,
                        location.longitude
                    ).take(3)
                    finalPredictions = reranked.map {
                        OpenPlantsClassifier.Prediction(it.name, it.combinedScore)
                    }
                    locationAdjusted = true
                } else {
                    finalPredictions = rawPredictions.take(3)
                    locationAdjusted = false
                }

                runOnUiThread {
                    showPredictions(finalPredictions, locationAdjusted)
                    binding.choosePhotoButton.isEnabled = true
                }
                if (finalPredictions.isNotEmpty()) {
                    loadPlantInfo(finalPredictions.first().name)
                }
            } catch (error: Throwable) {
                runOnUiThread {
                    setStatus("הזיהוי נכשל: ${error.message ?: error.javaClass.simpleName}")
                    binding.resultsTitle.visibility = View.GONE
                    binding.infoCard.visibility = View.GONE
                    binding.choosePhotoButton.isEnabled = true
                }
            }
        }.start()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        classifier = OpenPlantsClassifier(applicationContext)
        binding.versionText.text = "גרסה ${BuildConfig.VERSION_NAME} • Android Native"

        requestLocationPermissionIfNeeded()

        binding.choosePhotoButton.setOnClickListener {
            photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
        }

        binding.nameSearchButton.setOnClickListener { searchByName() }
        binding.nameSearchInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                searchByName()
                true
            } else false
        }

        binding.wikipediaButton.setOnClickListener { currentInfo?.wikipediaUrl?.let(::openUrl) }
        binding.inaturalistButton.setOnClickListener { currentInfo?.iNaturalistUrl?.let(::openUrl) }
        binding.gbifButton.setOnClickListener { currentInfo?.gbifUrl?.let(::openUrl) }
    }

    private fun requestLocationPermissionIfNeeded() {
        val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
        val coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
        if (fine != PackageManager.PERMISSION_GRANTED && coarse != PackageManager.PERMISSION_GRANTED) {
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                    Manifest.permission.ACCESS_FINE_LOCATION
                )
            )
        }
    }

    private fun getBestLastKnownLocation(): Location? {
        val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
        val coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
        if (fine != PackageManager.PERMISSION_GRANTED && coarse != PackageManager.PERMISSION_GRANTED) return null

        val manager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        return manager.getProviders(true)
            .mapNotNull { provider -> runCatching { manager.getLastKnownLocation(provider) }.getOrNull() }
            .maxByOrNull { it.time }
    }

    private fun searchByName() {
        val query = binding.nameSearchInput.text?.toString()?.trim().orEmpty()
        if (query.isBlank()) {
            setStatus("כתוב שם של צמח כדי לחפש.")
            return
        }

        binding.resultsTitle.visibility = View.GONE
        binding.resultsContainer.removeAllViews()
        binding.previewCard.visibility = View.GONE
        binding.infoCard.visibility = View.VISIBLE
        binding.infoTitle.text = query
        binding.infoText.text = "מחפש מידע על הצמח…"
        binding.wikipediaButton.visibility = View.GONE
        currentInfo = null
        setStatus("מחפש את $query במקורות המידע…")
        binding.nameSearchButton.isEnabled = false

        Thread {
            val info = try {
                PlantInfoService.load(query)
            } catch (_: Throwable) {
                PlantInfoService.PlantInfo(
                    query,
                    null,
                    null,
                    null,
                    "https://www.inaturalist.org/taxa/search?q=${Uri.encode(query)}",
                    "https://www.gbif.org/species/search?q=${Uri.encode(query)}"
                )
            }
            currentInfo = info
            runOnUiThread {
                binding.nameSearchButton.isEnabled = true
                binding.infoTitle.text = info.wikipediaTitle ?: info.scientificName
                binding.infoText.text = info.wikipediaExtract
                    ?: "לא נמצא כרגע תקציר בוויקיפדיה. אפשר לבדוק את השם מול iNaturalist ו־GBIF באמצעות הכפתורים למטה."
                binding.wikipediaButton.visibility = if (info.wikipediaUrl != null) View.VISIBLE else View.GONE
                setStatus("החיפוש לפי שם הסתיים.")
                binding.infoCard.announceForAccessibility("נטען מידע על ${info.scientificName}")
            }
        }.start()
    }

    private fun setStatus(message: String) {
        binding.statusText.text = message
        binding.statusText.announceForAccessibility(message)
    }

    private fun showPredictions(
        predictions: List<OpenPlantsClassifier.Prediction>,
        locationAdjusted: Boolean = false
    ) {
        binding.resultsContainer.removeAllViews()
        if (predictions.isEmpty()) {
            binding.resultsTitle.visibility = View.GONE
            setStatus("לא התקבלו תוצאות זיהוי.")
            return
        }

        binding.resultsTitle.visibility = View.VISIBLE
        setStatus(
            if (locationAdjusted)
                "הזיהוי הסתיים. הדירוג משלב את התמונה עם תפוצת צמחים בקרבתך."
            else
                "הזיהוי הסתיים. לא היה מיקום זמין, ולכן הדירוג מבוסס על התמונה בלבד."
        )

        predictions.forEachIndexed { index, prediction ->
            val card = MaterialCardView(this).apply {
                radius = 28f
                cardElevation = 0f
                setCardBackgroundColor(Color.rgb(15, 36, 25))
                strokeColor = if (index == 0) Color.rgb(166, 232, 189) else Color.rgb(54, 87, 70)
                strokeWidth = if (index == 0) 4 else 2
                isFocusable = true
                isClickable = true
                contentDescription = "${prediction.name}, ציון ${"%.1f".format(prediction.probability * 100)} אחוז. לחץ למידע נוסף"
                setOnClickListener { loadPlantInfo(prediction.name) }
            }

            val label = if (index == 0) "ההתאמה המובילה" else "אפשרות ${index + 1}"
            val scoreLabel = if (locationAdjusted) "ציון משולב" else "התאמה"
            val text = TextView(this).apply {
                this.text = "$label\n${prediction.name}\n$scoreLabel: ${"%.1f".format(prediction.probability * 100)}%\nלחץ למידע נוסף"
                textSize = 20f
                setTextColor(Color.rgb(243, 248, 244))
                gravity = Gravity.CENTER
                setPadding(28, 26, 28, 26)
                textDirection = View.TEXT_DIRECTION_LOCALE
            }
            card.addView(text)

            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = 18 }
            binding.resultsContainer.addView(card, params)
        }
    }

    private fun loadPlantInfo(scientificName: String) {
        runOnUiThread {
            binding.infoCard.visibility = View.VISIBLE
            binding.infoTitle.text = scientificName
            binding.infoText.text = "טוען מידע ממקורות נוספים…"
            binding.wikipediaButton.visibility = View.GONE
        }

        Thread {
            val info = try { PlantInfoService.load(scientificName) } catch (_: Throwable) {
                PlantInfoService.PlantInfo(
                    scientificName,
                    null,
                    null,
                    null,
                    "https://www.inaturalist.org/taxa/search?q=${Uri.encode(scientificName)}",
                    "https://www.gbif.org/species/search?q=${Uri.encode(scientificName)}"
                )
            }
            currentInfo = info
            runOnUiThread {
                binding.infoTitle.text = info.wikipediaTitle ?: info.scientificName
                binding.infoText.text = info.wikipediaExtract
                    ?: "לא נמצא כרגע תקציר בוויקיפדיה. אפשר לבדוק את המין מול iNaturalist ו־GBIF באמצעות הכפתורים למטה."
                binding.wikipediaButton.visibility = if (info.wikipediaUrl != null) View.VISIBLE else View.GONE
                binding.infoCard.announceForAccessibility("נטען מידע נוסף על ${info.scientificName}")
            }
        }.start()
    }

    private fun openUrl(url: String) {
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    }

    override fun onDestroy() {
        classifier.close()
        super.onDestroy()
    }
}
