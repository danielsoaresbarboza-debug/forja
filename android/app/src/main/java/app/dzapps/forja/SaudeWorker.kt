package app.dzapps.forja

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

/** Roda nos horários escolhidos (padrão 8h, 12h, 15h e 21h), mesmo com o app fechado. */
class SaudeWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        val ctx = applicationContext
        try {
            if (Saude.disponivel(ctx) == HealthConnectClient.SDK_AVAILABLE) {
                val ok = Saude.concedidas(ctx)
                if (ok.contains(Saude.BACKGROUND) && ok.isNotEmpty()) Saude.lerESalvar(ctx, 2, "agendado")
            }
        } catch (e: Exception) { /* tenta de novo no próximo horário */ }
        try { Saude.agendarProxima(ctx) } catch (e: Exception) { }
        return Result.success()
    }
}
