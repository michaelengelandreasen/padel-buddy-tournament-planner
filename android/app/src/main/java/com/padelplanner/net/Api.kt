package com.padelplanner.net

import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * The server's REST API, over HttpURLConnection.
 *
 * No HTTP client and no JSON library: this makes six calls against an API we
 * also wrote, and `org.json` plus the platform's own connection are enough for
 * that. Every dependency an admin console doesn't need is one more thing to
 * update before a Friday tournament.
 *
 * The server is VPN-only, so the phone must be on the club's WireGuard tunnel to
 * reach it. That is a feature — the console is not on the public internet — but
 * it is also the first thing to check when everything times out.
 */
object Api {

    /** Overridable so a club can point at their own host without a rebuild. */
    @Volatile
    var base: String = "https://padel-tournament-planner.mike.users.ctx7.dev"

    data class Club(val name: String, val address: String, val mapsUrl: String)
    data class Court(val id: Int, val label: String)
    data class Tournament(
        val id: Int, val level: String, val date: String, val courts: Int,
        val durationMin: Int, val roundMin: Int, val status: String,
    )
    data class Team(val name: String, val mixed: Boolean)
    data class Waiting(val name: String, val partner: String)
    data class Match(
        val id: Int, val round: Int, val court: String,
        val teamA: String, val teamB: String, val scoreA: Int?, val scoreB: Int?,
    )
    data class Standing(val team: String, val played: Int, val won: Int, val points: Int, val against: Int)
    data class Detail(
        val t: Tournament, val teams: List<Team>, val waiting: List<Waiting>,
        val matches: List<Match>, val table: List<Standing>, val message: String,
    )

    // ------------------------------------------------------------------ calls

    fun club(): Pair<Club, List<Court>> {
        val o = getJson("/api/club")
        val c = o.getJSONObject("club")
        val courts = o.optJSONArray("courts") ?: JSONArray()
        return Club(
            c.optString("name"), c.optString("address"), c.optString("maps_url"),
        ) to (0 until courts.length()).map {
            val x = courts.getJSONObject(it)
            Court(x.optInt("id"), x.optString("label"))
        }
    }

    fun saveClub(c: Club) = postForm("/settings", mapOf(
        "name" to c.name, "address" to c.address, "maps_url" to c.mapsUrl))

    fun addCourt(label: String) = postForm("/courts", mapOf("label" to label))

    fun tournaments(): List<Tournament> {
        val arr = getArray("/api/tournaments")
        return (0 until arr.length()).map { tournamentOf(arr.getJSONObject(it)) }
    }

    fun detail(id: Int): Detail {
        val o = getJson("/api/tournaments/$id")
        val teams = o.optJSONArray("teams") ?: JSONArray()
        val waiting = o.optJSONArray("waiting") ?: JSONArray()
        val matches = o.optJSONArray("matches") ?: JSONArray()
        val table = o.optJSONArray("table") ?: JSONArray()
        return Detail(
            t = tournamentOf(o.getJSONObject("t")),
            teams = (0 until teams.length()).map {
                val x = teams.getJSONObject(it)
                Team(x.optString("name"), x.optBoolean("mixed"))
            },
            waiting = (0 until waiting.length()).map {
                val x = waiting.getJSONObject(it)
                Waiting(x.optString("name"), x.optString("partner"))
            },
            matches = (0 until matches.length()).map {
                val x = matches.getJSONObject(it)
                Match(
                    x.optInt("id"), x.optInt("round"), x.optString("court"),
                    x.optString("team_a"), x.optString("team_b"),
                    if (x.isNull("score_a")) null else x.optInt("score_a"),
                    if (x.isNull("score_b")) null else x.optInt("score_b"),
                )
            },
            table = (0 until table.length()).map {
                val x = table.getJSONObject(it)
                Standing(
                    x.optString("team"), x.optInt("played"), x.optInt("won"),
                    x.optInt("points"), x.optInt("against"))
            },
            message = o.optString("message"),
        )
    }

    fun createTournament(level: String, date: String, courts: Int, duration: Int, round: Int) =
        postForm("/tournaments", mapOf(
            "level" to level, "play_date" to date, "courts" to courts.toString(),
            "duration_min" to duration.toString(), "round_min" to round.toString()))

    fun draw(id: Int) = postForm("/t/$id/schedule", emptyMap())

    fun score(matchId: Int, a: Int, b: Int) =
        postForm("/matches/$matchId/score", mapOf("a" to a.toString(), "b" to b.toString()))

    /** Send a command as if it arrived from WhatsApp — the host's own console. */
    fun command(text: String): String {
        val o = postJson("/api/whatsapp/incoming", JSONObject().put("text", text))
        return if (o.isNull("reply")) "" else o.optString("reply")
    }

    // ----------------------------------------------------------------- plumbing

    private fun tournamentOf(x: JSONObject) = Tournament(
        x.optInt("id"), x.optString("level"), x.optString("play_date"),
        x.optInt("courts"), x.optInt("duration_min"), x.optInt("round_min"),
        x.optString("status"))

    private fun open(path: String, method: String): HttpURLConnection =
        (URL(base.trimEnd('/') + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 8000
            readTimeout = 12000
            // The server answers form posts with a 303 to the page it just
            // changed. Following it would download HTML we have no use for.
            instanceFollowRedirects = false
        }

    private fun read(c: HttpURLConnection): String {
        val stream = if (c.responseCode in 200..299) c.inputStream else c.errorStream
        return stream?.bufferedReader()?.use(BufferedReader::readText).orEmpty()
    }

    private fun getJson(path: String) = JSONObject(read(open(path, "GET")))
    private fun getArray(path: String) = JSONArray(read(open(path, "GET")))

    private fun postForm(path: String, fields: Map<String, String>): Boolean {
        val c = open(path, "POST")
        c.doOutput = true
        c.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
        val body = fields.entries.joinToString("&") {
            "${enc(it.key)}=${enc(it.value)}"
        }
        c.outputStream.use { it.write(body.toByteArray()) }
        return c.responseCode in 200..399
    }

    private fun postJson(path: String, payload: JSONObject): JSONObject {
        val c = open(path, "POST")
        c.doOutput = true
        c.setRequestProperty("Content-Type", "application/json")
        c.outputStream.use { it.write(payload.toString().toByteArray()) }
        return JSONObject(read(c))
    }

    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")
}
