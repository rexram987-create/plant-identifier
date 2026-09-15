package com.rexram.plantidentifier

import org.junit.Assert.*
import org.junit.Test

class RegionalRankingTest {
    @Test fun localityChangesOrderWithoutChangingModelScore() {
        val rows = listOf(RegionalRanking.Item("A", .10f), RegionalRanking.Item("B", .09f))
        val result = RegionalRanking.rank(rows, listOf(0, 100))
        assertEquals("B", result.first().name)
        assertEquals(.09f, result.first().modelScore, .00001f)
    }
    @Test fun incompleteRegionalDataCannotPromoteOneCandidate() {
        val rows = listOf(RegionalRanking.Item("A", .10f), RegionalRanking.Item("B", .09f))
        assertEquals(rows.map { it.name }, RegionalRanking.rank(rows, listOf(null, 100)).map { it.name })
    }
    @Test fun zeroObservationsPreserveScoresAndOrder() {
        val rows = listOf(RegionalRanking.Item("A", .10f), RegionalRanking.Item("B", .09f))
        val result = RegionalRanking.rank(rows, listOf(0, 0))
        assertEquals(.10f, result.first().modelScore, .00001f)
        assertEquals("A", result.first().name)
    }
}
