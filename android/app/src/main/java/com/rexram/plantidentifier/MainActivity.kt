package com.rexram.plantidentifier

import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.View
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

    private val photoPicker = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri == null) return@registerForActivityResult

        binding.previewImage.setImageURI(uri)
        binding.previewCard.visibility = View.VISIBLE
        binding.resultsTitle.visibility = View.GONE
        binding.resultsContainer.removeAllViews()
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
            } catch (error: Throwable) {
                runOnUiThread {
                    setStatus("הזיהוי נכשל: ${error.message ?: error.javaClass.simpleName}")
                    binding.resultsTitle.visibility = View.GONE
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

        binding.versionText.text = "גרסה ${BuildConfig.VERSION_NAME}"

        binding.choosePhotoButton.setOnClickListener {
            photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
        }
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
                strokeColor = Color.rgb(54, 87, 70)
                strokeWidth = 2
                isFocusable = true
            }

            val text = TextView(this).apply {
                this.text = "${index + 1}. ${prediction.name}\nהתאמה: ${"%.1f".format(prediction.probability * 100)}%"
                textSize = 20f
                setTextColor(Color.rgb(243, 248, 244))
                gravity = Gravity.CENTER
                setPadding(28, 26, 28, 26)
                textDirection = View.TEXT_DIRECTION_LOCALE
                contentDescription = this.text
            }
            card.addView(text)

            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = 18 }
            binding.resultsContainer.addView(card, params)
        }
    }

    override fun onDestroy() {
        classifier.close()
        super.onDestroy()
    }
}
