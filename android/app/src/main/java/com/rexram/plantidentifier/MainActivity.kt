package com.rexram.plantidentifier

import android.os.Bundle
import android.view.View
import android.widget.TextView
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.rexram.plantidentifier.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var classifier: OpenPlantsClassifier

    private val photoPicker = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri == null) return@registerForActivityResult

        binding.previewImage.setImageURI(uri)
        binding.previewImage.visibility = View.VISIBLE
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
            setStatus("לא התקבלו תוצאות זיהוי.")
            return
        }

        setStatus("הזיהוי הסתיים. אלה שלוש ההתאמות המובילות:")
        predictions.forEachIndexed { index, prediction ->
            val view = TextView(this).apply {
                text = "${index + 1}. ${prediction.name}\nהתאמה: ${"%.1f".format(prediction.probability * 100)}%"
                textSize = 20f
                setTextColor(0xFFF0F7F2.toInt())
                setBackgroundColor(0xFF10291D.toInt())
                setPadding(24, 20, 24, 20)
                contentDescription = text
            }
            val params = android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = 16 }
            binding.resultsContainer.addView(view, params)
        }
    }

    override fun onDestroy() {
        classifier.close()
        super.onDestroy()
    }
}
