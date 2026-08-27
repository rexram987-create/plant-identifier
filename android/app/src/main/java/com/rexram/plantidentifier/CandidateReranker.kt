package com.rexram.plantidentifier

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URLEncoder
import java.net.URL
import kotlin.math.ln

object CandidateReranker {
    data class Evidence(
        val name: String,
        val modelProbability: Float,
        val nearbyObservations: Int,
        val combinedScore: Float
    )

    fun rerank(
        predictions: List<OpenPlantsClassifier.Prediction>,
        latitude: Double,
        longitude: Double
    ): List<Evidence> {
        if (predictions.isEmpty()) return emptyList()

        val counts = predictions.map { prediction ->
            prediction.name to runCatching {
                nearbyObservationCount(prediction.name, latitude, longitude)
            }.getOrDefault(0)
        }

        val logCounts = counts.map { (_, count) -> ln(1.0 + count.toDouble()) }
        val maxLog = logCounts.maxOrNull()?.takeIf { it > 0.0 } ?: 1.0

        return predictions.mapIndexed { index, prediction ->
            val count = counts[index].second
            val localityScore = (logCounts[index] / maxLog).toFloat()
            // Keep the image model dominant, while allowing strong local-distribution
            // evidence to break close calls between visually similar species.
            val combined = prediction.probability * 0.78f + localityScore * 0.22f
            Evidence(prediction.name, prediction.probability, count, combined)
        }.sortedByDescending { it.combinedScore }
    }

    private fun nearbyObservationCount(name: String, latitude: Double, longitude: Double): Int {
        val encoded = URLEncoder.encode(name, "UTF-8")
        val url = "https://api.inaturalist.org/v1/observations?taxon_name=$encoded&lat=$latitude&lng=$longitude&radius=150&quality_grade=research&per_page=1"
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = 10_000
        connection.readTimeout = 10_000
        connection.requestMethod = "GET"
        connection.setRequestProperty("User-Agent", "PlantIdentifierAndroid/0.6")
        try {
            if (connection.responseCode !in 200..299) return 0
            val json = connection.inputStream.bufferedReader().use { JSONObject(it.readText()) }
            return json.optInt("total_results", 0)
        } finally {
            connection.disconnect()
        }
    }
}
