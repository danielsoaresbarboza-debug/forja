package app.dzapps.forja

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BasalMetabolicRateRecord
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import org.json.JSONArray
import org.json.JSONObject
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.util.concurrent.TimeUnit

/** Lê o Samsung Health através do Health Connect e guarda um resumo por dia.
 *  O site (Forja) busca esse resumo quando abre; o SaudeWorker atualiza nos horários escolhidos. */
object Saude {
    const val BACKGROUND = "android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND"
    private const val PREFS = "forja_saude"
    private const val UNICO = "forja-saude"
    val HORAS_PADRAO = listOf(8, 12, 15, 21)

    val LEITURA: Set<String> = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(WeightRecord::class),
        HealthPermission.getReadPermission(BodyFatRecord::class),
        HealthPermission.getReadPermission(BasalMetabolicRateRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(HydrationRecord::class),
    )
    val TODAS: Set<String> = LEITURA + BACKGROUND

    fun disponivel(ctx: Context): Int = HealthConnectClient.getSdkStatus(ctx)
    fun cliente(ctx: Context): HealthConnectClient = HealthConnectClient.getOrCreate(ctx)

    suspend fun concedidas(ctx: Context): Set<String> =
        try { cliente(ctx).permissionController.getGrantedPermissions() } catch (e: Exception) { emptySet() }

    fun segundoPlanoExiste(ctx: Context): Boolean = try {
        cliente(ctx).features.getFeatureStatus(HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND) ==
            HealthConnectFeatures.FEATURE_STATUS_AVAILABLE
    } catch (e: Exception) { false }

    // ---------- leitura ----------
    private fun tipo(t: Int): String = when (t) {
        ExerciseSessionRecord.EXERCISE_TYPE_RUNNING, ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL -> "corrida"
        ExerciseSessionRecord.EXERCISE_TYPE_WALKING, ExerciseSessionRecord.EXERCISE_TYPE_HIKING -> "caminhada"
        ExerciseSessionRecord.EXERCISE_TYPE_BIKING, ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY -> "spinning"
        ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL, ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_OPEN_WATER -> "natacao"
        ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING, ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING,
        ExerciseSessionRecord.EXERCISE_TYPE_CALISTHENICS -> "musculacao"
        ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING, ExerciseSessionRecord.EXERCISE_TYPE_BOOT_CAMP,
        ExerciseSessionRecord.EXERCISE_TYPE_ELLIPTICAL, ExerciseSessionRecord.EXERCISE_TYPE_STAIR_CLIMBING,
        ExerciseSessionRecord.EXERCISE_TYPE_STAIR_CLIMBING_MACHINE, ExerciseSessionRecord.EXERCISE_TYPE_ROWING_MACHINE -> "funcional"
        else -> "outro"
    }

    private suspend fun <T> tenta(bloco: suspend () -> T): T? = try { bloco() } catch (e: Exception) { null }

    suspend fun lerDia(ctx: Context, dia: LocalDate): JSONObject {
        val c = cliente(ctx)
        val z = ZoneId.systemDefault()
        val ini = dia.atStartOfDay(z).toInstant()
        val fimDia = dia.plusDays(1).atStartOfDay(z).toInstant()
        val fim = if (fimDia.isAfter(Instant.now())) Instant.now() else fimDia
        val faixa = TimeRangeFilter.between(ini, fim)
        val o = JSONObject().put("date", dia.toString())

        tenta { c.aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL), faixa))[StepsRecord.COUNT_TOTAL] }
            ?.let { o.put("steps", it) }
        tenta { c.aggregate(AggregateRequest(setOf(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL), faixa))[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL] }
            ?.let { o.put("activeKcal", Math.round(it.inKilocalories)) }
        tenta { c.aggregate(AggregateRequest(setOf(TotalCaloriesBurnedRecord.ENERGY_TOTAL), faixa))[TotalCaloriesBurnedRecord.ENERGY_TOTAL] }
            ?.let { o.put("totalKcal", Math.round(it.inKilocalories)) }
        tenta { c.aggregate(AggregateRequest(setOf(HydrationRecord.VOLUME_TOTAL), faixa))[HydrationRecord.VOLUME_TOTAL] }
            ?.let { if (it.inMilliliters > 0) o.put("waterMl", Math.round(it.inMilliliters)) }

        // treinos
        tenta { c.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class, faixa)).records }?.let { lista ->
            val arr = JSONArray()
            for (s in lista) {
                val min = Duration.between(s.startTime, s.endTime).toMinutes()
                val kcal = tenta {
                    c.aggregate(AggregateRequest(setOf(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL),
                        TimeRangeFilter.between(s.startTime, s.endTime)))[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories
                } ?: tenta {
                    c.aggregate(AggregateRequest(setOf(TotalCaloriesBurnedRecord.ENERGY_TOTAL),
                        TimeRangeFilter.between(s.startTime, s.endTime)))[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories
                }
                arr.put(JSONObject()
                    .put("id", s.metadata.id)
                    .put("tipo", tipo(s.exerciseType))
                    .put("exerciseType", s.exerciseType)
                    .put("title", s.title ?: "")
                    .put("start", s.startTime.toString())
                    .put("end", s.endTime.toString())
                    .put("min", min)
                    .put("kcal", if (kcal != null) Math.round(kcal) else JSONObject.NULL)
                    .put("app", s.metadata.dataOrigin.packageName))
            }
            o.put("exercises", arr)
        }
        // corpo (último do dia)
        tenta { c.readRecords(ReadRecordsRequest(WeightRecord::class, faixa)).records.maxByOrNull { it.time } }?.let {
            o.put("weight", JSONObject().put("id", it.metadata.id).put("kg", Math.round(it.weight.inKilograms * 10) / 10.0).put("time", it.time.toString()))
        }
        tenta { c.readRecords(ReadRecordsRequest(BodyFatRecord::class, faixa)).records.maxByOrNull { it.time } }?.let {
            o.put("bodyFat", JSONObject().put("id", it.metadata.id).put("pct", Math.round(it.percentage.value * 10) / 10.0).put("time", it.time.toString()))
        }
        tenta { c.readRecords(ReadRecordsRequest(BasalMetabolicRateRecord::class, faixa)).records.maxByOrNull { it.time } }?.let {
            o.put("bmr", JSONObject().put("kcal", Math.round(it.basalMetabolicRate.inKilocaloriesPerDay)).put("time", it.time.toString()))
        }
        // sono: sessões que terminaram neste dia (a noite anterior)
        tenta {
            c.readRecords(ReadRecordsRequest(SleepSessionRecord::class,
                TimeRangeFilter.between(ini.minus(Duration.ofHours(12)), fim))).records
                .filter { !it.endTime.isBefore(ini) && it.endTime.isBefore(fimDia) }
        }?.let { lista ->
            val min = lista.sumOf { Duration.between(it.startTime, it.endTime).toMinutes() }
            if (min > 0) o.put("sleepMin", min)
        }
        return o
    }

    suspend fun ler(ctx: Context, dias: Int): JSONArray {
        val arr = JSONArray()
        val hoje = LocalDate.now()
        for (i in (dias - 1) downTo 0) arr.put(lerDia(ctx, hoje.minusDays(i.toLong())))
        return arr
    }

    // ---------- guardar para o site buscar ----------
    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    suspend fun lerESalvar(ctx: Context, dias: Int, origem: String): JSONArray {
        val novos = ler(ctx, dias)
        val p = prefs(ctx)
        val atual = try { JSONArray(p.getString("dias", "[]")) } catch (e: Exception) { JSONArray() }
        val mapa = LinkedHashMap<String, JSONObject>()
        for (i in 0 until atual.length()) atual.optJSONObject(i)?.let { mapa[it.optString("date")] = it }
        for (i in 0 until novos.length()) novos.optJSONObject(i)?.let { mapa[it.optString("date")] = it }
        val limite = LocalDate.now().minusDays(14).toString()
        val saida = JSONArray()
        mapa.values.filter { it.optString("date") >= limite }.sortedBy { it.optString("date") }.forEach { saida.put(it) }
        p.edit().putString("dias", saida.toString()).putString("em", Instant.now().toString()).putString("origem", origem).apply()
        return saida
    }

    fun guardado(ctx: Context): JSONObject {
        val p = prefs(ctx)
        return JSONObject()
            .put("dias", try { JSONArray(p.getString("dias", "[]")) } catch (e: Exception) { JSONArray() })
            .put("em", p.getString("em", null) ?: JSONObject.NULL)
            .put("origem", p.getString("origem", null) ?: JSONObject.NULL)
            .put("horas", JSONArray(horas(ctx)))
            .put("proxima", p.getString("proxima", null) ?: JSONObject.NULL)
    }

    // ---------- agendamento ----------
    fun horas(ctx: Context): List<Int> {
        val s = prefs(ctx).getString("horas", null) ?: return HORAS_PADRAO
        return s.split(",").mapNotNull { it.trim().toIntOrNull() }.filter { it in 0..23 }.sorted().ifEmpty { HORAS_PADRAO }
    }

    fun definirHoras(ctx: Context, h: List<Int>) {
        prefs(ctx).edit().putString("horas", h.filter { it in 0..23 }.distinct().sorted().joinToString(",")).apply()
    }

    fun agendar(ctx: Context, substituir: Boolean) {
        val agora = LocalDateTime.now()
        val hs = horas(ctx)
        var prox: LocalDateTime? = null
        for (h in hs) {
            val t = agora.toLocalDate().atTime(h, 0)
            if (t.isAfter(agora.plusMinutes(1))) { prox = t; break }
        }
        if (prox == null) prox = agora.toLocalDate().plusDays(1).atTime(hs.first(), 0)
        val atraso = Duration.between(agora, prox).toMillis().coerceAtLeast(60_000L)
        val req = OneTimeWorkRequestBuilder<SaudeWorker>().setInitialDelay(atraso, TimeUnit.MILLISECONDS).build()
        WorkManager.getInstance(ctx).enqueueUniqueWork(UNICO,
            if (substituir) ExistingWorkPolicy.REPLACE else ExistingWorkPolicy.KEEP, req)
        prefs(ctx).edit().putString("proxima", prox.toString()).apply()
    }

    /** Usado pelo worker: agenda a próxima depois que a atual terminar. */
    fun agendarProxima(ctx: Context) {
        val agora = LocalDateTime.now()
        val hs = horas(ctx)
        var prox: LocalDateTime? = null
        for (h in hs) {
            val t = agora.toLocalDate().atTime(h, 0)
            if (t.isAfter(agora.plusMinutes(5))) { prox = t; break }
        }
        if (prox == null) prox = agora.toLocalDate().plusDays(1).atTime(hs.first(), 0)
        val atraso = Duration.between(agora, prox).toMillis().coerceAtLeast(60_000L)
        val req = OneTimeWorkRequestBuilder<SaudeWorker>().setInitialDelay(atraso, TimeUnit.MILLISECONDS).build()
        WorkManager.getInstance(ctx).enqueueUniqueWork(UNICO, ExistingWorkPolicy.APPEND_OR_REPLACE, req)
        prefs(ctx).edit().putString("proxima", prox.toString()).apply()
    }
}
