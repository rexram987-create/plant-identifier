package com.rexram.plantidentifier

import android.content.Intent
import android.graphics.Color
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
import com.google.android.material.card.MaterialCardView
import com.rexram.plantidentifier.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var classifier: OpenPlantsClassifier
    private var currentInfo: PlantInfoService.PlantInfo? = null

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
                val predictions = classifier.classify(uri, 3)
                runOnUiThread {
                    showPredictions(predictions)
                    binding.choosePhotoButton.isEnabled = true
                }
                if (predictions.isNotEmpty()) {
                    loadPlantInfo(predictions.first().name)
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

    private fun showPredictions(predictions: List<OpenPlantsClassifier.Prediction>) {
        binding.resultsContainer.removeAllViews()
        if (predictions.isEmpty()) {
            binding.resultsTitle.visibility = View.GONE
            setStatus("לא התקבלו תוצאות זיהוי.")
            return
        }

        binding.resultsTitle.visibility = View.VISIBLE
        setStatus("הזיהוי הסתיים. אלה שלוש ההתאמות המובילות:")

        predictions.forEachIndexed { index, prediction ->
            val card = MaterialCardView(this).apply {
                radius = 28f
                cardElevation = 0f
                setCardBackgroundColor(Color.rgb(15, 36, 25))
                strokeColor = if (index == 0) Color.rgb(166, 232, 189) else Color.rgb(54, 87, 70)
                strokeWidth = if (index == 0) 4 else 2
                isFocusable = true
                isClickable = true
                contentDescription = "${prediction.name}, התאמה ${"%.1f".format(prediction.probability * 100)} אחוז. לחץ למידע נוסף"
                setOnClickListener { loadPlantInfo(prediction.name) }
            }

            val label = if (index == 0) "ההתאמה המובילה" else "אפשרות ${index + 1}"
            val text = TextView(this).apply {
                this.text = "$label\n${prediction.name}\nהתאמה: ${"%.1f".format(prediction.probability * 100)}%\nלחץ למידע נוסף"
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
