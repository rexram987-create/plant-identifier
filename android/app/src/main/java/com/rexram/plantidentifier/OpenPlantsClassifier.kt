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
        private const val MODEL_URL = "https://rexram987-create.github.io/plant-identifier/models/openplants/model-int8.onnx?v=dynamic-v2"
        private const val LABELS_URL = "https://rexram987-create.github.io/plant-identifier/models/openplants/labels.json?v=dynamic-v2"
        private const val SIZE = 224
    }

    fun prepare(progress: (String) -> Unit = {}) {
        modelDir.mkdirs()
        if (!modelFile.exists() || modelFile.length() < 50_000_000L) {
            progress("מוריד את מנוע OpenPlants בפעם הראשונה…")
            download(MODEL_URL, modelFile)
        }
        if (!labelsFile.exists() || labelsFile.length() < 1_000L) {
            progress("מוריד את רשימת מיני הצמחים…")
            download(LABELS_URL, labelsFile)
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

    private fun download(url: String, destination: File) {
        val temp = File(destination.parentFile, destination.name + ".part")
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = 20_000
        connection.readTimeout = 120_000
        connection.instanceFollowRedirects = true
        connection.setRequestProperty("User-Agent", "PlantIdentifier-Android/0.1")
        try {
            if (connection.responseCode !in 200..299) error("Download failed: HTTP ${connection.responseCode}")
            connection.inputStream.use { input ->
                temp.outputStream().buffered().use { output -> input.copyTo(output) }
            }
            if (!temp.renameTo(destination)) {
                temp.copyTo(destination, overwrite = true)
                temp.delete()
            }
        } finally {
            connection.disconnect()
        }
    }

    override fun close() {
        session?.close()
        session = null
    }
}
