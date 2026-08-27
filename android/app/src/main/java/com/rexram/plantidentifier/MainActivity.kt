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
                radius = dp(24).toFloat()
                cardElevation = 0f
                setCardBackgroundColor(Color.rgb(16, 41, 29))
                strokeColor = Color.rgb(54, 87, 70)
                strokeWidth = dp(1)
                isFocusable = true
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
            }

            val content = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER_HORIZONTAL
                setPadding(dp(20), dp(20), dp(20), dp(20))
            }

            val rank = TextView(this).apply {
                text = "התאמה ${index + 1}"
                textSize = 16f
                setTextColor(Color.rgb(166, 232, 189))
                gravity = Gravity.CENTER
            }

            val name = TextView(this).apply {
                text = prediction.name
                textSize = 23f
                setTextColor(Color.rgb(243, 248, 244))
                gravity = Gravity.CENTER
                setPadding(0, dp(8), 0, 0)
            }

            val score = TextView(this).apply {
                text = "התאמה: ${"%.1f".format(prediction.probability * 100)}%"
                textSize = 19f
                setTextColor(Color.rgb(240, 247, 242))
                gravity = Gravity.CENTER
                setPadding(0, dp(12), 0, 0)
            }

            content.addView(rank)
            content.addView(name)
            content.addView(score)
            card.addView(content)
            card.contentDescription = "התאמה ${index + 1}, ${prediction.name}, ${"%.1f".format(prediction.probability * 100)} אחוז"

            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(14) }

            binding.resultsContainer.addView(card, params)
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    override fun onDestroy() {
        classifier.close()
        super.onDestroy()
    }
}
