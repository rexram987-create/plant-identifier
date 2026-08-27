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
        val gbifUrl: String
    )

    fun load(scientificName: String): PlantInfo {
        val encoded = URLEncoder.encode(scientificName, "UTF-8")
        val wiki = loadWikipedia(scientificName)
        return PlantInfo(
            scientificName = scientificName,
            wikipediaTitle = wiki?.first,
            wikipediaExtract = wiki?.second,
            wikipediaUrl = wiki?.third,
            iNaturalistUrl = "https://www.inaturalist.org/taxa/search?q=$encoded",
            gbifUrl = "https://www.gbif.org/species/search?q=$encoded"
        )
    }

    private fun loadWikipedia(name: String): Triple<String, String, String>? {
        val languages = listOf("he", "en")
        for (language in languages) {
            try {
                val title = searchWikipedia(language, name) ?: continue
                val summary = fetchWikipediaSummary(language, title) ?: continue
                return Triple(title, summary, "https://$language.wikipedia.org/wiki/${URLEncoder.encode(title.replace(' ', '_'), "UTF-8")}")
            } catch (_: Throwable) {
                // Try the next language or return no summary.
            }
        }
        return null
    }

    private fun searchWikipedia(language: String, query: String): String? {
        val url = "https://$language.wikipedia.org/w/api.php?action=query&list=search&srsearch=${URLEncoder.encode(query, "UTF-8")}&format=json&utf8=1&srlimit=1&origin=*"
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
        connection.setRequestProperty("User-Agent", "PlantIdentifierAndroid/0.4")
        connection.inputStream.bufferedReader().use { return it.readText() }
    }
}
