package com.padelplanner

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Sms
import androidx.compose.material.icons.filled.Stadium
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import com.padelplanner.net.Api
import com.padelplanner.ui.ClubScreen
import com.padelplanner.ui.ConsoleScreen
import com.padelplanner.ui.Failed
import com.padelplanner.ui.Loading
import com.padelplanner.ui.PadelPlannerTheme
import com.padelplanner.ui.TournamentScreen
import com.padelplanner.ui.TournamentsScreen
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * The club's admin console.
 *
 * One source of truth, and it is not this phone: everything here reads and
 * writes the same REST API the WhatsApp bot and the web console use, so a score
 * typed courtside is on the TV before the next round starts, and two people with
 * the app never disagree.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { PadelPlannerTheme { Root() } }
    }
}

private enum class Tab(val label: String) { TOURNAMENTS("Tournaments"), CLUB("Club"), CONSOLE("Console") }

private sealed interface Load {
    data object Busy : Load
    data class Failed(val message: String) : Load
    data object Ready : Load
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun Root() {
    var tab by rememberSaveable { mutableStateOf(Tab.TOURNAMENTS) }
    var openId by rememberSaveable { mutableStateOf<Int?>(null) }

    var state by remember { mutableStateOf<Load>(Load.Busy) }
    var club by remember { mutableStateOf(Api.Club("", "", "")) }
    var courts by remember { mutableStateOf(listOf<Api.Court>()) }
    var tournaments by remember { mutableStateOf(listOf<Api.Tournament>()) }
    var detail by remember { mutableStateOf<Api.Detail?>(null) }
    var reply by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }

    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }
    fun say(m: String) = scope.launch { snackbar.showSnackbar(m) }

    /**
     * Every call goes through here: off the main thread, failures surfaced
     * rather than swallowed, and the list re-read afterwards so the screen
     * always shows the server's answer instead of what we hoped it did.
     */
    fun load(then: (suspend CoroutineScope.() -> Unit)? = null) {
        scope.launch {
            busy = true
            runCatching {
                withContext(Dispatchers.IO) {
                    then?.invoke(this)
                    val c = Api.club()
                    club = c.first; courts = c.second
                    tournaments = Api.tournaments()
                    openId?.let { detail = Api.detail(it) }
                }
            }.onSuccess { state = Load.Ready }
                .onFailure { state = Load.Failed(it.message ?: it.toString()) }
            busy = false
        }
    }

    LaunchedEffect(Unit) { load() }
    LaunchedEffect(openId) { if (openId != null) load() }

    BackHandler(enabled = openId != null) { openId = null; detail = null }

    val wide = LocalConfiguration.current.screenWidthDp >= 600
    val open = detail?.takeIf { openId != null }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        when {
                            open != null -> open.t.level.ifBlank { "Tournament" }
                            else -> club.name.ifBlank { "Padel Planner" }
                        },
                        maxLines = 1,
                    )
                },
                navigationIcon = {
                    if (open != null) IconButton(onClick = { openId = null; detail = null }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back to tournaments")
                    }
                },
                actions = {
                    IconButton(onClick = { load() }) { Icon(Icons.Filled.Refresh, "Refresh") }
                },
            )
        },
        bottomBar = { if (!wide && open == null) Bar(tab) { tab = it } },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { pad ->
        // The padding goes on the Row, not on the screen inside it. Padding only
        // the screen left the navigation rail starting at the top of the window,
        // which put its first destination behind the app bar.
        val inner = Modifier
        Row(Modifier.fillMaxSize().padding(pad).consumeWindowInsets(pad)) {
            if (wide && open == null) Rail(tab) { tab = it }
            when {
                state is Load.Busy && tournaments.isEmpty() -> Loading("Reaching the planner…")
                state is Load.Failed -> Failed((state as Load.Failed).message) { load() }
                open != null -> TournamentScreen(
                    d = open,
                    onDraw = { load { Api.draw(open.t.id) } },
                    onScore = { id, a, b -> load { Api.score(id, a, b) }; say("Score saved") },
                    modifier = inner,
                )
                tab == Tab.TOURNAMENTS -> TournamentsScreen(
                    tournaments = tournaments,
                    onOpen = { openId = it },
                    onCreate = { l, d, c, du, r ->
                        load { Api.createTournament(l, d, c, du, r) }; say("Tournament created")
                    },
                    modifier = inner,
                )
                tab == Tab.CLUB -> ClubScreen(
                    club = club, courts = courts,
                    onSave = { load { Api.saveClub(it) }; say("Club saved") },
                    onAddCourt = { load { Api.addCourt(it) } },
                    modifier = inner,
                )
                else -> ConsoleScreen(
                    reply = reply, busy = busy,
                    onSend = { text ->
                        scope.launch {
                            busy = true
                            runCatching { withContext(Dispatchers.IO) { Api.command(text) } }
                                .onSuccess { reply = it.ifBlank { "(the bot stayed quiet)" }; load() }
                                .onFailure { say(it.message ?: "Failed") }
                            busy = false
                        }
                    },
                    modifier = inner,
                )
            }
        }
    }
}

@Composable
private fun Bar(current: Tab, onSelect: (Tab) -> Unit) {
    NavigationBar {
        Tab.entries.forEach {
            NavigationBarItem(
                selected = current == it,
                onClick = { onSelect(it) },
                icon = { Icon(iconFor(it), null) },
                label = { Text(it.label) },
                alwaysShowLabel = true,
            )
        }
    }
}

@Composable
private fun Rail(current: Tab, onSelect: (Tab) -> Unit) {
    NavigationRail {
        Tab.entries.forEach {
            NavigationRailItem(
                selected = current == it,
                onClick = { onSelect(it) },
                icon = { Icon(iconFor(it), null) },
                label = { Text(it.label) },
                alwaysShowLabel = true,
            )
        }
    }
}

private fun iconFor(t: Tab) = when (t) {
    Tab.TOURNAMENTS -> Icons.Filled.EmojiEvents
    Tab.CLUB -> Icons.Filled.Stadium
    Tab.CONSOLE -> Icons.Filled.Sms
}
