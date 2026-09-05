package com.rexram.plantidentifier

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URLEncoder
import java.net.URL

object MinistryWaterPlantsService {
    private const val RESOURCE_ID = "94b22c64-5c80-4eb4-b5e5-79cc9bb89814"
    const val SOURCE_URL = "https://www.gov.il/he/departments/dynamiccollectors/water_saving_plants"

    data class WaterPlant(
        val plantName: String,
        val scientificName: String,
        val lifeForm: String,
        val waterAddition: String,
        val moreInfo: String
    )

    fun lookup(vararg names: String?): WaterPlant? {
        val queries = names
            .filterNotNull()
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .distinct()

        for (query in queries) {
            val result = search(query)

            val scientificExact = result.firstOrNull {
                scientificMatches(it.scientificName, query)
            }
            if (scientificExact != null) return scientificExact

            val hebrewExact = result.firstOrNull {
                normalize(it.plantName) == normalize(query)
            }
            if (hebrewExact != null) return hebrewExact
        }
        return null
    }

    private fun search(query: String): List<WaterPlant> {
        val encoded = URLEncoder.encode(query, "UTF-8")
        val url = "https://data.gov.il/api/3/action/datastore_search" +
            "?resource_id=$RESOURCE_ID&limit=8&q=$encoded"
        val json = JSONObject(get(url))
        if (!json.optBoolean("success")) return emptyList()
        val records = json.optJSONObject("result")?.optJSONArray("records") ?: return emptyList()

        return buildList {
            for (i in 0 until records.length()) {
                val row = records.optJSONObject(i) ?: continue
                add(
                    WaterPlant(
                        plantName = row.optString("plant_name"),
                        scientificName = row.optString("scientific_name"),
                        lifeForm = row.optString("life_form"),
                        waterAddition = row.optString("water_addition"),
                        moreInfo = row.optString("more_info")
                    )
                )
            }
        }
    }

    fun formatHebrew(item: WaterPlant): String = buildString {
        append("מופיע במאגר הצמחים החסכוניים במים של משרד החקלאות וביטחון המזון.\n\n")
        if (item.plantName.isNotBlank()) append("שם במאגר: ").append(item.plantName).append("\n\n")
        if (item.scientificName.isNotBlank()) append("שם מדעי: ").append(item.scientificName).append("\n\n")
        if (item.lifeForm.isNotBlank()) append("צורת חיים: ").append(item.lifeForm).append("\n\n")
        if (item.waterAddition.isNotBlank()) append("תוספת מים: ").append(item.waterAddition).append("\n\n")
        if (item.moreInfo.isNotBlank()) append("הערת המשרד: ").append(item.moreInfo)
    }.trim()

    private fun scientificMatches(value: String, query: String): Boolean {
        val left = canonicalScientificName(value) ?: return false
        val right = canonicalScientificName(query) ?: return false
        return left == right
    }

    private fun canonicalScientificName(value: String): String? {
        val normalized = value
            .trim()
            .lowercase()
            .replace('×', ' ')
            .replace(Regex("[=(),;:]"), " ")
            .replace(Regex("\\s+"), " ")

        val words = normalized.split(" ").filter { token ->
            token.matches(Regex("[a-z][a-z.-]*"))
        }
        if (words.size < 2) return null

        val genus = words[0].trimEnd('.')
        val species = words[1].trimEnd('.')
        if (genus.length < 2 || species.length < 2) return null
        return "$genus $species"
    }

    private fun normalize(value: String): String =
        value.trim().lowercase().replace("-", " ").replace("־", " ").replace(Regex("\\s+"), " ")

    private fun get(urlString: String): String {
        val connection = URL(urlString).openConnection() as HttpURLConnection
        connection.connectTimeout = 10000
        connection.readTimeout = 10000
        connection.requestMethod = "GET"
        connection.setRequestProperty("Accept", "application/json")
        connection.setRequestProperty("User-Agent", "PlantIdentifierAndroid/0.7.5")
        if (connection.responseCode !in 200..299) {
            throw IllegalStateException("HTTP ${connection.responseCode}")
        }
        connection.inputStream.bufferedReader().use { return it.readText() }
    }
}
