package com.rexram.plantidentifier

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URLEncoder
import java.net.URL

object PlantInfoService {
    data class PlantInfo(
        val scientificName: String,
        val wikipediaTitle: String?,
        val wikipediaExtract: String?,
        val wikipediaUrl: String?,
        val iNaturalistUrl: String,
        val gbifUrl: String,
        val hebrewName: String? = null
    )

    fun load(scientificName: String): PlantInfo {
        val encoded = URLEncoder.encode(scientificName, "UTF-8")
        val hebrewWiki = loadWikipediaForLanguage("he", scientificName)
        val fallbackWiki = hebrewWiki ?: loadWikipediaForLanguage("en", scientificName)
        return PlantInfo(
            scientificName = scientificName,
            wikipediaTitle = fallbackWiki?.first,
            wikipediaExtract = fallbackWiki?.second,
            wikipediaUrl = fallbackWiki?.third,
            iNaturalistUrl = "https://www.inaturalist.org/taxa/search?q=$encoded",
            gbifUrl = "https://www.gbif.org/species/search?q=$encoded",
            hebrewName = hebrewWiki?.first
        )
    }

    fun findHebrewName(scientificName: String): String? {
        return try {
            loadWikipediaForLanguage("he", scientificName)?.first
        } catch (_: Throwable) {
            null
        }
    }

    private fun loadWikipediaForLanguage(language: String, name: String): Triple<String, String, String>? {
        return try {
            val title = searchWikipedia(language, name) ?: return null
            val summary = fetchWikipediaSummary(language, title) ?: return null
            Triple(
                title,
                summary,
                "https://$language.wikipedia.org/wiki/${URLEncoder.encode(title.replace(' ', '_'), "UTF-8")}"
            )
        } catch (_: Throwable) {
            null
        }
    }

    private fun searchWikipedia(language: String, query: String): String? {
        val encoded = URLEncoder.encode("\"$query\"", "UTF-8")
        val url = "https://$language.wikipedia.org/w/api.php?action=query&list=search&srsearch=$encoded&format=json&utf8=1&srlimit=1&origin=*"
        val json = JSONObject(get(url))
        val results = json.getJSONObject("query").getJSONArray("search")
        return if (results.length() > 0) results.getJSONObject(0).getString("title") else null
    }

    private fun fetchWikipediaSummary(language: String, title: String): String? {
        val url = "https://$language.wikipedia.org/api/rest_v1/page/summary/${URLEncoder.encode(title.replace(' ', '_'), "UTF-8")}"
        val json = JSONObject(get(url))
        return json.optString("extract").takeIf { it.isNotBlank() }
    }

    private fun get(urlString: String): String {
        val connection = URL(urlString).openConnection() as HttpURLConnection
        connection.connectTimeout = 10000
        connection.readTimeout = 10000
        connection.requestMethod = "GET"
        connection.setRequestProperty("User-Agent", "PlantIdentifierAndroid/0.7")
        if (connection.responseCode !in 200..299) {
            throw IllegalStateException("HTTP ${connection.responseCode}")
        }
        connection.inputStream.bufferedReader().use { return it.readText() }
    }
}
