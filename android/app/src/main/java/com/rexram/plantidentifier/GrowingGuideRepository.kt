package com.rexram.plantidentifier

import android.content.Context
import org.json.JSONObject

object GrowingGuideRepository {
    data class Guide(
        val hebrewName: String,
        val light: String,
        val watering: String,
        val soil: String,
        val feeding: String,
        val care: String,
        val balcony: String,
        val tip: String
    )

    @Volatile private var cache: JSONObject? = null

    fun find(context: Context, scientificName: String): Guide? {
        val root = cache ?: synchronized(this) {
            cache ?: JSONObject(
                context.assets.open("growing_guides.json").bufferedReader().use { it.readText() }
            ).also { cache = it }
        }

        val key = root.keys().asSequence().firstOrNull {
            it.equals(scientificName.trim(), ignoreCase = true)
        } ?: return null

        val item = root.optJSONObject(key) ?: return null
        return Guide(
            hebrewName = item.optString("hebrewName"),
            light = item.optString("light"),
            watering = item.optString("watering"),
            soil = item.optString("soil"),
            feeding = item.optString("feeding"),
            care = item.optString("care"),
            balcony = item.optString("balcony"),
            tip = item.optString("tip")
        )
    }

    fun formatHebrew(guide: Guide): String = buildString {

        append("אור: ").append(guide.light).append("\n\n")
        append("השקיה: ").append(guide.watering).append("\n")
        append("מצע וניקוז: ").append(guide.soil).append("\n")
        append("דישון: ").append(guide.feeding).append("\n")
        append("טיפול וגיזום: ").append(guide.care).append("\n")
        append("התאמה למרפסת: ").append(guide.balcony).append("\n")
        append("טיפ חשוב: ").append(guide.tip)
    }
}
