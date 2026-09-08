package com.rexram.plantidentifier

import android.content.Context
import org.json.JSONArray

object OrnamentalPlantsRepository {
    data class Plant(
        val hebrewName: String,
        val scientificName: String,
        val familyHebrew: String,
        val familyScientific: String,
        val growthForm: String,
        val hybrid: Boolean,
        val sourcePage: Int
    )

    @Volatile private var cache: List<Plant>? = null

    private fun all(context: Context): List<Plant> {
        return cache ?: synchronized(this) {
            cache ?: run {
                val assetName = runCatching {
                    context.assets.open("ornamental_plants.json").close()
                    "ornamental_plants.json"
                }.getOrElse { "ornamental_plants_sample.json" }

                val text = context.assets.open(assetName)
                    .bufferedReader()
                    .use { it.readText() }
                val array = JSONArray(text)
                buildList {
                    for (i in 0 until array.length()) {
                        val item = array.getJSONObject(i)
                        add(
                            Plant(
                                hebrewName = item.optString("hebrewName"),
                                scientificName = item.optString("scientificName"),
                                familyHebrew = item.optString("familyHebrew"),
                                familyScientific = item.optString("familyScientific"),
                                growthForm = item.optString("growthForm"),
                                hybrid = item.optBoolean("hybrid", false),
                                sourcePage = item.optInt("sourcePage", 0)
                            )
                        )
                    }
                }
            }.also { cache = it }
        }
    }

    private fun normalize(value: String?): String =
        value.orEmpty()
            .trim()
            .lowercase()
            .replace('×', 'x')
            .replace(Regex("[\\u0591-\\u05C7]"), "")
            .replace(Regex("\\s+"), " ")

    fun find(
        context: Context,
        scientificName: String? = null,
        hebrewName: String? = null
    ): Plant? {
        val plants = all(context)
        val scientific = normalize(scientificName)
        if (scientific.isNotBlank()) {
            plants.firstOrNull { normalize(it.scientificName) == scientific }?.let { return it }
        }

        val hebrew = normalize(hebrewName)
        if (hebrew.isNotBlank()) {
            plants.firstOrNull { normalize(it.hebrewName) == hebrew }?.let { return it }
        }

        return null
    }

    fun formatHebrew(plant: Plant): String = buildString {
        append("מופיע ברשימת צמחי הנוי בישראל של משרד החקלאות.\n\n")
        append("שם עברי: ").append(plant.hebrewName).append("\n")
        append("שם מדעי: ").append(plant.scientificName).append("\n")
        append("משפחה: ").append(plant.familyHebrew)
        if (plant.familyScientific.isNotBlank()) {
            append(" (").append(plant.familyScientific).append(")")
        }
        append("\n")
        append("צורת חיים/צמיחה: ").append(plant.growthForm)
        if (plant.hybrid) append("\nמכלוא: כן")
        if (plant.sourcePage > 0) append("\nעמוד במקור: ").append(plant.sourcePage)
    }
}
