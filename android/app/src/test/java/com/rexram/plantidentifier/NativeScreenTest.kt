package com.rexram.plantidentifier

import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class NativeScreenTest {
    @org.junit.Before fun clearPreferences() {
        org.robolectric.RuntimeEnvironment.getApplication().getSharedPreferences("native-settings",0).edit().clear().commit()
    }
    private fun all(view: View): List<View> = listOf(view) + if (view is ViewGroup) (0 until view.childCount).flatMap { all(view.getChildAt(it)) } else emptyList()
    private fun text(root: View, value: String): TextView = all(root).filterIsInstance<TextView>().first { it.text.toString() == value }
    @Test fun settingsExpandAndLargeTextActuallyGrows() {
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        val activity = controller.get()
        var root = activity.window.decorView
        val before = text(root, "מגדיר הצמחים").textSize
        text(root, "הגדרות").performClick()
        text(root, "טקסט גדול").performClick()
        root = activity.window.decorView
        assertTrue(text(root, "מגדיר הצמחים").textSize > before)
        controller.pause().stop().destroy()
    }
    @Test fun changingLanguageKeepsTheSearchText() {
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        val activity = controller.get()
        var root = activity.window.decorView
        all(root).filterIsInstance<android.widget.EditText>().first().setText("Mentha")
        text(root, "הגדרות").performClick()
        text(root, "English").performClick()
        root = activity.window.decorView
        assertEquals("Mentha", all(root).filterIsInstance<android.widget.EditText>().first().text.toString())
        assertNotNull(text(root, "Plant Identifier"))
        assertEquals(View.LAYOUT_DIRECTION_LTR, root.findViewById<View>(android.R.id.content).layoutDirection)
        controller.pause().stop().destroy()
    }
}
