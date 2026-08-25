package com.padelplanner.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Casino
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.padelplanner.net.Api

/** A column of content that stops widening on a tablet. */
private val MAX_WIDTH = 680.dp

@Composable
private fun Panel(
    modifier: Modifier = Modifier,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    Card(
        modifier.fillMaxWidth().widthIn(max = MAX_WIDTH),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) { Column(Modifier.padding(16.dp), content = content) }
}

@Composable
fun Loading(label: String) {
    Column(
        Modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        CircularProgressIndicator()
        Text(label, Modifier.padding(top = 16.dp),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

/**
 * Failure states say what to check.
 *
 * The one thing that goes wrong with this app is the tunnel: the server is
 * VPN-only, so a phone off WireGuard sees every call time out. "Couldn't
 * connect" would send someone hunting the wrong problem.
 */
@Composable
fun Failed(error: String, onRetry: () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(28.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Can't reach the planner", style = MaterialTheme.typography.titleMedium)
        Text(
            "The server is only reachable over the club's VPN — check WireGuard is on.\n\n$error",
            Modifier.padding(top = 8.dp).widthIn(max = 420.dp),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Button(onClick = onRetry, modifier = Modifier.padding(top = 20.dp)) { Text("Try again") }
    }
}

// ------------------------------------------------------------------ tournaments

@Composable
fun TournamentsScreen(
    tournaments: List<Api.Tournament>,
    onOpen: (Int) -> Unit,
    onCreate: (String, String, Int, Int, Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    var creating by rememberSaveable { mutableStateOf(false) }

    Column(modifier.fillMaxSize()) {
        if (tournaments.isEmpty()) {
            Column(
                Modifier.fillMaxSize().padding(32.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text("No tournaments yet", style = MaterialTheme.typography.titleMedium)
                Text(
                    "Open one here, or from the group with !tournament.",
                    Modifier.padding(top = 6.dp, bottom = 18.dp),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Button(onClick = { creating = true }) { Text("New tournament") }
            }
        } else {
            LazyColumn(
                Modifier.fillMaxSize(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                items(tournaments) { t ->
                    Panel(Modifier.clickableCard { onOpen(t.id) }) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(
                                    t.level.ifBlank { "Open level" },
                                    style = MaterialTheme.typography.titleMedium,
                                    maxLines = 1, overflow = TextOverflow.Ellipsis,
                                )
                                Text(
                                    t.date.ifBlank { "date TBC" },
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            StatusPill(t.status)
                        }
                        Text(
                            "${t.courts} courts · ${t.durationMin} min · ${t.roundMin} min rounds",
                            Modifier.padding(top = 6.dp),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                item {
                    Button(onClick = { creating = true }, modifier = Modifier.padding(top = 6.dp)) {
                        Icon(Icons.Filled.Add, null, Modifier.size(18.dp))
                        Text("New tournament", Modifier.padding(start = 8.dp))
                    }
                }
            }
        }
    }

    if (creating) NewTournamentDialog(
        onDismiss = { creating = false },
        onCreate = { l, d, c, du, r -> creating = false; onCreate(l, d, c, du, r) },
    )
}

@Composable
private fun StatusPill(status: String) {
    val on = status == "scheduled"
    Surface(
        shape = androidx.compose.foundation.shape.RoundedCornerShape(50),
        color = if (on) MaterialTheme.colorScheme.primaryContainer
        else MaterialTheme.colorScheme.surfaceVariant,
    ) {
        Text(
            status,
            Modifier.padding(horizontal = 10.dp, vertical = 3.dp),
            style = MaterialTheme.typography.labelSmall,
            color = if (on) MaterialTheme.colorScheme.onPrimaryContainer
            else MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun NewTournamentDialog(onDismiss: () -> Unit, onCreate: (String, String, Int, Int, Int) -> Unit) {
    var level by remember { mutableStateOf("MX-4") }
    var date by remember { mutableStateOf("") }
    var courts by remember { mutableStateOf("3") }
    var duration by remember { mutableStateOf("90") }
    var round by remember { mutableStateOf("12") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New tournament") },
        text = {
            Column(
                Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                OutlinedTextField(level, { level = it }, label = { Text("Level") }, singleLine = true)
                OutlinedTextField(date, { date = it }, label = { Text("When") },
                    placeholder = { Text("Friday 5 Sep, 19:00") }, singleLine = true)
                NumberField(courts, { courts = it }, "Courts")
                NumberField(duration, { duration = it }, "Duration (min)")
                NumberField(round, { round = it }, "Round (min)")
            }
        },
        confirmButton = {
            TextButton(
                enabled = level.isNotBlank(),
                onClick = {
                    onCreate(level.trim(), date.trim(),
                        courts.toIntOrNull() ?: 3, duration.toIntOrNull() ?: 90,
                        round.toIntOrNull() ?: 12)
                },
            ) { Text("Create") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun NumberField(value: String, onChange: (String) -> Unit, label: String) {
    OutlinedTextField(
        value, { onChange(it.filter(Char::isDigit)) },
        label = { Text(label) }, singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
    )
}

// -------------------------------------------------------------------- detail

@Composable
fun TournamentScreen(
    d: Api.Detail,
    onDraw: () -> Unit,
    onScore: (Int, Int, Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        item {
            Panel {
                Text(
                    "${d.t.level.ifBlank { "Open" }} · ${d.t.date.ifBlank { "date TBC" }}",
                    style = MaterialTheme.typography.titleMedium,
                )
                Text(
                    "${d.t.courts} courts · ${d.t.roundMin} min rounds",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    "Teams (${d.teams.size})",
                    Modifier.padding(top = 14.dp),
                    style = MaterialTheme.typography.labelLarge,
                )
                d.teams.forEachIndexed { i, team ->
                    Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("${i + 1}", Modifier.widthIn(min = 22.dp),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(team.name, Modifier.weight(1f),
                            style = MaterialTheme.typography.bodyMedium,
                            maxLines = 1, overflow = TextOverflow.Ellipsis)
                        if (team.mixed) StatusPill("mixed")
                    }
                }
                if (d.waiting.isNotEmpty()) {
                    Text(
                        "Waiting for a partner (${d.waiting.size})",
                        Modifier.padding(top = 14.dp),
                        style = MaterialTheme.typography.labelLarge,
                    )
                    d.waiting.forEach {
                        Text(
                            if (it.partner.isBlank()) "${it.name} — no partner named"
                            else "${it.name} — waiting on ${it.partner}",
                            Modifier.padding(top = 4.dp),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }

        if (d.matches.isEmpty()) {
            item {
                Panel {
                    Text("No schedule yet", style = MaterialTheme.typography.titleSmall)
                    Text(
                        if (d.teams.size < 2) "At least two teams are needed for a draw."
                        else "Draw it when sign-ups close — teams rotate opponents each round.",
                        Modifier.padding(top = 4.dp, bottom = 12.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Button(onClick = onDraw, enabled = d.teams.size >= 2) {
                        Icon(Icons.Filled.Casino, null, Modifier.size(18.dp))
                        Text("Draw the schedule", Modifier.padding(start = 8.dp))
                    }
                }
            }
        } else {
            val rounds = d.matches.map { it.round }.distinct()
            rounds.forEach { r ->
                item {
                    Panel {
                        Text("Round $r", style = MaterialTheme.typography.titleSmall)
                        d.matches.filter { it.round == r }.forEach { m ->
                            HorizontalDivider(Modifier.padding(vertical = 8.dp),
                                color = MaterialTheme.colorScheme.outlineVariant)
                            MatchRow(m, onScore)
                        }
                    }
                }
            }
        }

        item {
            Panel {
                Text("Standings", style = MaterialTheme.typography.titleSmall)
                if (d.table.isEmpty()) {
                    Text("No results yet.", Modifier.padding(top = 6.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                } else d.table.forEachIndexed { i, row ->
                    Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("${i + 1}", Modifier.widthIn(min = 22.dp),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary)
                        Text(row.team, Modifier.weight(1f),
                            style = MaterialTheme.typography.bodyMedium,
                            maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text("${row.points}", style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.tertiary)
                        Text(" pts · ${row.won}W/${row.played}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }

        item {
            Panel {
                Text("WhatsApp message", style = MaterialTheme.typography.titleSmall)
                Text(
                    d.message,
                    Modifier.padding(top = 8.dp),
                    style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                )
            }
        }
    }
}

/**
 * A match, and the two boxes that decide it.
 *
 * Scores go in courtside between rounds, one-handed, so the fields are wide
 * enough to hit and the save is immediate rather than behind a form.
 */
@Composable
private fun MatchRow(m: Api.Match, onScore: (Int, Int, Int) -> Unit) {
    var a by remember(m.id, m.scoreA) { mutableStateOf(m.scoreA?.toString() ?: "") }
    var b by remember(m.id, m.scoreB) { mutableStateOf(m.scoreB?.toString() ?: "") }

    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(m.court, style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.tertiary)
            Text(m.teamA, Modifier.padding(start = 10.dp).weight(1f),
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Row(Modifier.padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("v", Modifier.widthIn(min = 28.dp),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(m.teamB, Modifier.weight(1f),
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Row(
            Modifier.padding(top = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ScoreBox(a) { a = it }
            ScoreBox(b) { b = it }
            FilledTonalButton(
                enabled = a.isNotBlank() && b.isNotBlank(),
                onClick = { onScore(m.id, a.toIntOrNull() ?: 0, b.toIntOrNull() ?: 0) },
            ) { Text("Save") }
        }
    }
}

@Composable
private fun ScoreBox(value: String, onChange: (String) -> Unit) {
    OutlinedTextField(
        value, { onChange(it.filter(Char::isDigit).take(2)) },
        modifier = Modifier.widthIn(max = 88.dp),
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
    )
}

// ---------------------------------------------------------------------- club

@Composable
fun ClubScreen(
    club: Api.Club,
    courts: List<Api.Court>,
    onSave: (Api.Club) -> Unit,
    onAddCourt: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var name by remember(club) { mutableStateOf(club.name) }
    var address by remember(club) { mutableStateOf(club.address) }
    var maps by remember(club) { mutableStateOf(club.mapsUrl) }
    var court by remember { mutableStateOf("") }

    Column(
        modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Panel {
            Text("Club", style = MaterialTheme.typography.titleSmall)
            OutlinedTextField(name, { name = it }, label = { Text("Club name") },
                singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
            OutlinedTextField(address, { address = it }, label = { Text("Address") },
                singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
            OutlinedTextField(maps, { maps = it }, label = { Text("Google Maps link") },
                singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
            Button(
                onClick = { onSave(Api.Club(name.trim(), address.trim(), maps.trim())) },
                modifier = Modifier.padding(top = 14.dp),
            ) { Text("Save club") }
        }

        Panel {
            Text("Courts", style = MaterialTheme.typography.titleSmall)
            Text(
                "Named, not numbered — the WhatsApp message and the TV view both say these out loud.",
                Modifier.padding(top = 4.dp),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (courts.isEmpty()) {
                Text("None yet.", Modifier.padding(top = 10.dp),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else courts.forEach {
                Text(it.label, Modifier.padding(top = 8.dp),
                    style = MaterialTheme.typography.bodyMedium)
            }
            Row(
                Modifier.padding(top = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OutlinedTextField(
                    court, { court = it },
                    label = { Text("Add a court") },
                    placeholder = { Text("Centre Court") },
                    singleLine = true, modifier = Modifier.weight(1f),
                )
                FilledTonalButton(
                    enabled = court.isNotBlank(),
                    onClick = { onAddCourt(court.trim()); court = "" },
                ) { Icon(Icons.Filled.Add, "Add court") }
            }
        }
    }
}

// ------------------------------------------------------------------- console

/**
 * The host's own command line.
 *
 * The bot's commands are the club's shared language, so the app speaks it too
 * rather than inventing a second one — anything typed here goes through exactly
 * the path a group message would, and the reply is the message that would be
 * posted.
 */
@Composable
fun ConsoleScreen(
    reply: String,
    busy: Boolean,
    onSend: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var text by rememberSaveable { mutableStateOf("") }

    Column(
        modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Panel {
            Text("Send a command", style = MaterialTheme.typography.titleSmall)
            OutlinedTextField(
                text, { text = it },
                label = { Text("Command") },
                placeholder = { Text("!in Mike M partner Sofia") },
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                singleLine = true,
            )
            Row(
                Modifier.padding(top = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Button(enabled = text.isNotBlank() && !busy, onClick = { onSend(text.trim()) }) {
                    Text("Send")
                }
                TextButton(onClick = { text = "!list" }) { Text("!list") }
                TextButton(onClick = { text = "!help" }) { Text("!help") }
            }
        }
        if (reply.isNotBlank()) {
            Panel {
                Text("Reply", style = MaterialTheme.typography.titleSmall)
                Text(
                    reply,
                    Modifier.padding(top = 8.dp),
                    style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                )
            }
        }
    }
}

/** The whole card opens the tournament, and says so to a screen reader. */
private fun Modifier.clickableCard(onClick: () -> Unit): Modifier =
    this.clickable(onClickLabel = "Open tournament", onClick = onClick)
