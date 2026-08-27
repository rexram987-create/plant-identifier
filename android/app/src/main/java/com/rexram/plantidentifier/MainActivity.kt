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
import androidx.core.content.FileProvider
import com.google.android.material.card.MaterialCardView
import com.rexram.plantidentifier.databinding.ActivityMainBinding
import java.io.File

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var classifier: OpenPlantsClassifier
    private var currentInfo: PlantInfoService.PlantInfo? = null
    private var pendingCameraUri: Uri? = null

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { }

    private val photoPicker = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) processImage(uri)
    }

    private val cameraLauncher = registerForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        val uri = pendingCameraUri
        if (success && uri != null) {
            processImage(uri)
        } else {
            setStatus("הצילום בוטל. אפשר לנסות שוב או לבחור תמונה מהגלריה.")
        }
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

        binding.takePhotoButton.setOnClickListener {
            try {
                val uri = createCameraUri()
                pendingCameraUri = uri
                cameraLauncher.launch(uri)
            } catch (error: Throwable) {
                setStatus("לא הצלחנו לפתוח את המצלמה: ${error.message ?: "שגיאה לא ידועה"}")
            }
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

    private fun createCameraUri(): Uri {
        val cameraDir = File(cacheDir, "camera").apply { mkdirs() }
        val photoFile = File.createTempFile("plant_", ".jpg", cameraDir)
        return FileProvider.getUriForFile(
            this,
            "${BuildConfig.APPLICATION_ID}.fileprovider",
            photoFile
        )
    }

    private fun processImage(uri: Uri) {
        binding.previewImage.setImageURI(uri)
        binding.previewCard.visibility = View.VISIBLE
        binding.resultsTitle.visibility = View.GONE
        binding.resultsContainer.removeAllViews()
        binding.infoCard.visibility = View.GONE
        currentInfo = null
        setStatus("מכין את מנוע OpenPlants…")
        setImageButtonsEnabled(false)

        Thread {
            try {
                classifier.prepare { message -> runOnUiThread { setStatus(message) } }
                runOnUiThread { setStatus("מזהה את הצמח בתמונה…") }

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

                runOnUiThread { setStatus("מאתר שמות עבריים לתוצאות…") }
                val hebrewNames = finalPredictions.associate { prediction ->
                    prediction.name to PlantInfoService.findHebrewName(prediction.name)
                }

                runOnUiThread {
                    showPredictions(finalPredictions, locationAdjusted, hebrewNames)
                    setImageButtonsEnabled(true)
                }
                if (finalPredictions.isNotEmpty()) {
                    loadPlantInfo(finalPredictions.first().name)
                }
            } catch (error: Throwable) {
                runOnUiThread {
                    setStatus("הזיהוי נכשל: ${error.message ?: error.javaClass.simpleName}")
                    binding.resultsTitle.visibility = View.GONE
                    binding.infoCard.visibility = View.GONE
                    setImageButtonsEnabled(true)
                }
            }
        }.start()
    }

    private fun setImageButtonsEnabled(enabled: Boolean) {
        binding.choosePhotoButton.isEnabled = enabled
        binding.takePhotoButton.isEnabled = enabled
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
                binding.infoTitle.text = info.hebrewName ?: info.wikipediaTitle ?: "מידע על הצמח"
                binding.infoText.text = info.wikipediaExtract
                    ?: "לא נמצא כרגע תיאור עברי מאומת בוויקיפדיה. השם המדעי הוא ${info.scientificName}. אפשר לבדוק מידע נוסף ב־iNaturalist וב־GBIF."
                binding.wikipediaButton.visibility = if (info.wikipediaUrl != null) View.VISIBLE else View.GONE
                setStatus("החיפוש לפי שם הסתיים.")
                binding.infoCard.announceForAccessibility("נטען מידע על ${info.hebrewName ?: info.scientificName}")
            }
        }.start()
    }

    private fun setStatus(message: String) {
        binding.statusText.text = message
        binding.statusText.announceForAccessibility(message)
    }

    private fun showPredictions(
        predictions: List<OpenPlantsClassifier.Prediction>,
        locationAdjusted: Boolean = false,
        hebrewNames: Map<String, String?> = emptyMap()
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
            val hebrewName = hebrewNames[prediction.name]
            val displayName = hebrewName ?: "שם עברי לא נמצא"
            val card = MaterialCardView(this).apply {
                radius = 28f
                cardElevation = 0f
                setCardBackgroundColor(Color.rgb(15, 36, 25))
                strokeColor = if (index == 0) Color.rgb(166, 232, 189) else Color.rgb(54, 87, 70)
                strokeWidth = if (index == 0) 4 else 2
                isFocusable = true
                isClickable = true
                contentDescription = "$displayName, שם מדעי ${prediction.name}, ציון ${"%.1f".format(prediction.probability * 100)} אחוז. לחץ למידע נוסף"
                setOnClickListener { loadPlantInfo(prediction.name) }
            }

            val label = if (index == 0) "ההתאמה המובילה" else "אפשרות ${index + 1}"
            val scoreLabel = if (locationAdjusted) "ציון משולב" else "התאמה"
            val text = TextView(this).apply {
                this.text = "$label\n$displayName\nשם מדעי: ${prediction.name}\n$scoreLabel: ${"%.1f".format(prediction.probability * 100)}%\nלחץ למידע נוסף"
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
            binding.infoTitle.text = "טוען מידע…"
            binding.infoText.text = "טוען מידע בעברית ממקורות נוספים…"
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
                binding.infoTitle.text = info.hebrewName ?: "שם עברי לא נמצא"
                binding.infoText.text = info.wikipediaExtract
                    ?: "לא נמצא כרגע תיאור עברי מאומת בוויקיפדיה. השם המדעי הוא ${info.scientificName}. אפשר לאמת את הזיהוי מול iNaturalist ו־GBIF באמצעות הכפתורים למטה."
                binding.wikipediaButton.visibility = if (info.wikipediaUrl != null) View.VISIBLE else View.GONE
                binding.infoCard.announceForAccessibility("נטען מידע נוסף על ${info.hebrewName ?: info.scientificName}")
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
