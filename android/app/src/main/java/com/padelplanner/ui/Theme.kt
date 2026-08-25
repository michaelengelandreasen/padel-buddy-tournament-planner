package com.padelplanner.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * The same palette the web console wears, so the club sees one product.
 *
 * Every Material role is named, containers included — naming only the obvious
 * ones leaves the dialogs, chips and the navigation indicator on Material's
 * baseline purple, which is a different app's colours showing through yours.
 */
private val Scheme = darkColorScheme(
    primary = Color(0xFF3DDC97),
    onPrimary = Color(0xFF04231A),
    primaryContainer = Color(0xFF11402F),
    onPrimaryContainer = Color(0xFFA9F2D2),
    inversePrimary = Color(0xFF11402F),

    secondary = Color(0xFF7FB3FF),
    onSecondary = Color(0xFF04203F),
    secondaryContainer = Color(0xFF24405F),
    onSecondaryContainer = Color(0xFFD3E4FF),

    // Amber marks a number worth reading: points, and the court a match is on.
    tertiary = Color(0xFFFFC857),
    onTertiary = Color(0xFF2A1D00),
    tertiaryContainer = Color(0xFF463200),
    onTertiaryContainer = Color(0xFFFFE3A3),

    error = Color(0xFFFF8A7A),
    onError = Color(0xFF3A0A05),
    errorContainer = Color(0xFF5C1D16),
    onErrorContainer = Color(0xFFFFDAD4),

    background = Color(0xFF0B1220),
    onBackground = Color(0xFFE8EEF7),
    surface = Color(0xFF141C2B),
    onSurface = Color(0xFFE8EEF7),
    surfaceVariant = Color(0xFF1B2536),
    onSurfaceVariant = Color(0xFF9FB0C6),

    surfaceContainerLowest = Color(0xFF080D18),
    surfaceContainerLow = Color(0xFF101827),
    surfaceContainer = Color(0xFF141C2B),
    surfaceContainerHigh = Color(0xFF1A2434),
    surfaceContainerHighest = Color(0xFF212C3E),
    surfaceDim = Color(0xFF0A101C),
    surfaceBright = Color(0xFF273245),
    surfaceTint = Color(0xFF3DDC97),

    outline = Color(0xFF60708A),
    outlineVariant = Color(0xFF2A3549),
    inverseSurface = Color(0xFFE8EEF7),
    inverseOnSurface = Color(0xFF141C2B),
    scrim = Color(0xFF000000),
)

@Composable
fun PadelPlannerTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Scheme, content = content)
}
