package com.rexram.plantidentifier

import org.json.JSONObject

object CandidateReranker {
    fun rerank(items: List<RegionalRanking.Item>, latitude: Double, longitude: Double): List<RegionalRanking.Item> {
        val counts = items.map { item ->
            runCatching {
                val taxa = PlantInfoService.json("https://api.inaturalist.org/v1/taxa?q=" + PlantInfoService.encode(item.name) + "&per_page=10").optJSONArray("results")
                val taxon = (0 until (taxa?.length() ?: 0)).map { taxa!!.getJSONObject(it) }
                    .firstOrNull { it.optString("name").equals(item.name, true) }
                if (taxon == null) 0 else PlantInfoService.json("https://api.inaturalist.org/v1/observations?taxon_id=" +
                    taxon.getInt("id") + "&lat=$latitude&lng=$longitude&radius=150&quality_grade=research&per_page=1").optInt("total_results")
            }.getOrNull()
        }
        return RegionalRanking.rank(items, counts)
    }
}
