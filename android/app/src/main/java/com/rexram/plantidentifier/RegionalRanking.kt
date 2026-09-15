package com.rexram.plantidentifier

import kotlin.math.ln

object RegionalRanking {
    data class Item(val name: String, val modelScore: Float, val observations: Int? = null)
    fun rank(items: List<Item>, counts: List<Int?>): List<Item> {
        require(items.size == counts.size)
        val evidence = items.mapIndexed { i, item -> item.copy(observations = counts[i]) }
        if (counts.any { it == null } || counts.all { it == 0 }) return evidence
        val maxLog = ln(1.0 + counts.filterNotNull().maxOrNull()!!)
        return evidence.sortedByDescending {
            it.modelScore * .68 + ln(1.0 + (it.observations ?: 0)) / maxLog * .32
        }
    }
}
