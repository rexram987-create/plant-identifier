package com.rexram.plantidentifier

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.ConcurrentHashMap

object PlantInfoService {
    data class PlantInfo(
        val scientificName: String,
        val wikipediaTitle: String?,
        val wikipediaExtract: String?,
        val wikipediaUrl: String?,
        val iNaturalistUrl: String,
        val gbifUrl: String,
        val hebrewName: String? = null,
        val imageUrl: String? = null,
        val articleLanguage: String? = null
    )
    private val cache = ConcurrentHashMap<String, PlantInfo>()
    private val known = mapOf(
        "נענע" to "Mentha", "מנטה" to "Mentha", "نعناع" to "Mentha", "النعناع" to "Mentha",
        "גרניום" to "Pelargonium", "פלרגוניום" to "Pelargonium", "פטוניה" to "Petunia",
        "בזיליקום" to "Ocimum basilicum", "ריחן" to "Ocimum basilicum", "ريحان" to "Ocimum basilicum",
        "רוזמרין" to "Salvia rosmarinus", "إكليل الجبل" to "Salvia rosmarinus",
        "קקטוס" to "Cactaceae", "קקטוסים" to "Cactaceae", "בוגנוויליה" to "Bougainvillea",
        "בוגנווילאה" to "Bougainvillea", "פוטוס" to "Epipremnum aureum", "לבנדר" to "Lavandula",
        "פסיפלורה" to "Passiflora", "שעונית" to "Passiflora", "שעונית נאכלת" to "Passiflora edulis"
    )
    fun encode(value: String): String = URLEncoder.encode(value, "UTF-8")

    fun json(url: String): JSONObject {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 8000
            readTimeout = 8000
            setRequestProperty("User-Agent", "PlantIdentifierAndroid/" + BuildConfig.VERSION_NAME)
        }
        return try {
            check(connection.responseCode in 200..299) { "HTTP " + connection.responseCode }
            JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
        } finally { connection.disconnect() }
    }

    private fun exactPlant(name: String): JSONObject? {
        val rows = json("https://api.gbif.org/v1/species/search?q=" + encode(name) + "&highertaxon_key=6&limit=30").optJSONArray("results")
        return (0 until (rows?.length() ?: 0)).map { rows!!.getJSONObject(it) }.firstOrNull {
            (it.optString("kingdom") == "Plantae" || it.optInt("kingdomKey") == 6) &&
                (it.optString("canonicalName").equals(name, true) || it.optString("scientificName").equals(name, true))
        }
    }

    private fun entities(query: String, language: String): List<JSONObject> {
        val found = json("https://www.wikidata.org/w/api.php?action=wbsearchentities&search=" +
            encode(query) + "&language=$language&type=item&limit=6&format=json").optJSONArray("search") ?: return emptyList()
        val ids = (0 until found.length()).map { found.getJSONObject(it).getString("id") }
        if (ids.isEmpty()) return emptyList()
        val data = json("https://www.wikidata.org/w/api.php?action=wbgetentities&ids=" +
            encode(ids.joinToString("|")) + "&props=claims|sitelinks|labels|aliases&format=json").optJSONObject("entities") ?: return emptyList()
        return ids.mapNotNull { data.optJSONObject(it) }
    }

    private fun scientific(entity: JSONObject): String? =
        entity.optJSONObject("claims")?.optJSONArray("P225")?.optJSONObject(0)
            ?.optJSONObject("mainsnak")?.optJSONObject("datavalue")?.optString("value")?.takeIf { it.isNotBlank() }

    private fun localMatch(entity: JSONObject, query: String, language: String): Boolean {
        val label = entity.optJSONObject("labels")?.optJSONObject(language)?.optString("value")
        val title = entity.optJSONObject("sitelinks")?.optJSONObject(language + "wiki")?.optString("title")
        if (label.equals(query, true) || title.equals(query, true)) return true
        val aliases = entity.optJSONObject("aliases")?.optJSONArray(language)
        return (0 until (aliases?.length() ?: 0)).any { aliases!!.getJSONObject(it).optString("value").equals(query, true) }
    }

    fun load(name: String, language: String = "he", scientificInput: Boolean = false): PlantInfo {
        val query = name.trim()
        val key = "$language:$query"
        cache[key]?.let { return it }
        var resolved = known[query] ?: query
        var entity: JSONObject? = null
        if (!scientificInput && exactPlant(resolved) == null) {
            val searchLanguage = when {
                query.any { it in '\u0590'..'\u05ff' } -> "he"
                query.any { it in '\u0600'..'\u06ff' } -> "ar"
                else -> "en"
            }
            entity = entities(query, searchLanguage).firstOrNull {
                localMatch(it, query, searchLanguage) && scientific(it)?.let(::exactPlant) != null
            }
            resolved = entity?.let(::scientific) ?: throw NoSuchElementException("No verified plant match")
        }
        if (entity == null) entity = runCatching {
            entities(resolved, "en").firstOrNull { scientific(it).equals(resolved, true) }
        }.getOrNull()
        val sites = entity?.optJSONObject("sitelinks")
        val lang = if (sites?.has(language + "wiki") == true) language else "en"
        val title = sites?.optJSONObject(lang + "wiki")?.optString("title")
        val summary = title?.let { runCatching { json("https://$lang.wikipedia.org/api/rest_v1/page/summary/" + encode(it.replace(' ', '_'))) }.getOrNull() }
        val encoded = encode(resolved)
        return PlantInfo(resolved, summary?.optString("title"), summary?.optString("extract")?.takeIf { it.isNotBlank() },
            if (summary != null && title != null) "https://$lang.wikipedia.org/wiki/" + encode(title.replace(' ', '_')) else null,
            "https://www.inaturalist.org/taxa/search?q=$encoded", "https://www.gbif.org/species/search?q=$encoded",
            entity?.optJSONObject("labels")?.optJSONObject("he")?.optString("value"),
            summary?.optJSONObject("thumbnail")?.optString("source"), if (summary != null) lang else null
        ).also { if (summary != null) cache[key] = it }
    }
    fun findHebrewName(name: String): String? = runCatching { load(name, "he", true).hebrewName }.getOrNull()
}
