package com.rexram.plantidentifier

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.nio.FloatBuffer
import kotlin.math.exp

class OpenPlantsClassifier(private val context: Context) : AutoCloseable {

    data class Prediction(val name: String, val probability: Float)

    private val env = OrtEnvironment.getEnvironment()
    private var session: OrtSession? = null
    private var labels: List<String> = emptyList()

    private val modelDir = File(context.filesDir, "openplants")
    private val modelFile = File(modelDir, "model-int8.onnx")
    private val labelsFile = File(modelDir, "labels.json")

    companion object {
        private const val MODEL_URL =
            "https://github.com/rexram987-create/plant-identifier/releases/download/v1.0.2/OpenPlants-model-int8.onnx"
        private const val LABELS_ASSET = "openplants/labels.json"
        private const val MIN_MODEL_SIZE = 50_000_000L
        private const val SIZE = 224
    }

    fun prepare(progress: (String) -> Unit = {}) {
        modelDir.mkdirs()

        if (!modelFile.exists() || modelFile.length() < MIN_MODEL_SIZE) {
            progress("מוריד את מודל OpenPlants בפעם הראשונה… ההורדה עשויה להימשך כמה דקות.")
            downloadModel()
        }
        if (!labelsFile.exists() || labelsFile.length() < 1_000L) {
            progress("מכין את רשימת מיני הצמחים…")
            copyAsset(LABELS_ASSET, labelsFile)
        }

        if (labels.isEmpty()) labels = readLabels(labelsFile)
        if (session == null) {
            progress("טוען את מנוע הזיהוי המקומי…")
            session = env.createSession(modelFile.absolutePath, OrtSession.SessionOptions())
        }
    }

    fun classify(uri: Uri, topK: Int = 3): List<Prediction> {
        prepare()
        val bitmap = context.contentResolver.openInputStream(uri).use { stream ->
            requireNotNull(stream) { "לא ניתן לקרוא את התמונה" }
            BitmapFactory.decodeStream(stream)
        } ?: error("לא ניתן לפענח את התמונה")

        val scaled = Bitmap.createScaledBitmap(bitmap, SIZE, SIZE, true)
        if (scaled !== bitmap) bitmap.recycle()
        val input = bitmapToTensor(scaled)
        scaled.recycle()

        val activeSession = requireNotNull(session)
        val inputName = activeSession.inputNames.first()
        OnnxTensor.createTensor(env, FloatBuffer.wrap(input), longArrayOf(1, 3, SIZE.toLong(), SIZE.toLong())).use { tensor ->
            activeSession.run(mapOf(inputName to tensor)).use { result ->
                @Suppress("UNCHECKED_CAST")
                val output = result[0].value as Array<FloatArray>
                return softmaxTop(output[0], topK)
            }
        }
    }

    private fun downloadModel() {
        val temp = File(modelDir, "model-int8.onnx.part")
        if (temp.exists()) temp.delete()

        val connection = (URL(MODEL_URL).openConnection() as HttpURLConnection).apply {
            instanceFollowRedirects = true
            connectTimeout = 30_000
            readTimeout = 120_000
            requestMethod = "GET"
            setRequestProperty("User-Agent", "Plant-Identifier-Android/" + BuildConfig.VERSION_NAME)
        }

        try {
            val code = connection.responseCode
            if (code !in 200..299) error("הורדת המודל נכשלה (HTTP $code)")

            connection.inputStream.use { input ->
                temp.outputStream().buffered().use { output -> input.copyTo(output) }
            }

            if (temp.length() < MIN_MODEL_SIZE) {
                temp.delete()
                error("קובץ המודל שהורד אינו שלם")
            }

            if (!temp.renameTo(modelFile)) {
                temp.copyTo(modelFile, overwrite = true)
                temp.delete()
            }
        } catch (error: Throwable) {
            temp.delete()
            throw IllegalStateException(
                "לא ניתן להוריד את מודל הזיהוי. בדוק חיבור לאינטרנט ונסה שוב.",
                error
            )
        } finally {
            connection.disconnect()
        }
    }

    private fun copyAsset(assetPath: String, destination: File) {
        val temp = File(destination.parentFile, destination.name + ".part")
        context.assets.open(assetPath).use { input ->
            temp.outputStream().buffered().use { output -> input.copyTo(output) }
        }
        if (!temp.renameTo(destination)) {
            temp.copyTo(destination, overwrite = true)
            temp.delete()
        }
    }

    private fun bitmapToTensor(bitmap: Bitmap): FloatArray {
        val pixels = IntArray(SIZE * SIZE)
        bitmap.getPixels(pixels, 0, SIZE, 0, 0, SIZE, SIZE)
        val data = FloatArray(3 * SIZE * SIZE)
        val plane = SIZE * SIZE
        for (i in pixels.indices) {
            val pixel = pixels[i]
            val r = ((pixel shr 16) and 0xFF) / 255f
            val g = ((pixel shr 8) and 0xFF) / 255f
            val b = (pixel and 0xFF) / 255f
            data[i] = (r - 0.5f) / 0.5f
            data[plane + i] = (g - 0.5f) / 0.5f
            data[2 * plane + i] = (b - 0.5f) / 0.5f
        }
        return data
    }

    private fun softmaxTop(logits: FloatArray, topK: Int): List<Prediction> {
        val max = logits.maxOrNull() ?: return emptyList()
        val exps = DoubleArray(logits.size)
        var sum = 0.0
        for (i in logits.indices) {
            exps[i] = exp((logits[i] - max).toDouble())
            sum += exps[i]
        }
        return logits.indices
            .asSequence()
            .map { index ->
                Prediction(labels.getOrElse(index) { "Class $index" }, (exps[index] / sum).toFloat())
            }
            .sortedByDescending { it.probability }
            .take(topK)
            .toList()
    }

    private fun readLabels(file: File): List<String> {
        val json = JSONObject(file.readText(Charsets.UTF_8))
        return json.keys().asSequence()
            .mapNotNull { key -> key.toIntOrNull()?.let { it to json.getString(key) } }
            .sortedBy { it.first }
            .map { it.second }
            .toList()
    }

    override fun close() {
        session?.close()
        session = null
    }
}
