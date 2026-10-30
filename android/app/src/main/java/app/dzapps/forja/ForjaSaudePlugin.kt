package app.dzapps.forja

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.activity.result.ActivityResult
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.Scope
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

@CapacitorPlugin(
    name = "ForjaSaude",
    permissions = [Permission(alias = "microfone", strings = [Manifest.permission.RECORD_AUDIO])]
)
class ForjaSaudePlugin : Plugin() {
    private val escopo = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var googleCall: PluginCall? = null
    private var googleLauncher: ActivityResultLauncher<IntentSenderRequest>? = null
    private var reconhecedor: SpeechRecognizer? = null

    override fun load() {
        try {
            googleLauncher = activity.registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { res ->
                val call = googleCall ?: return@registerForActivityResult
                googleCall = null
                try {
                    val r = Identity.getAuthorizationClient(activity).getAuthorizationResultFromIntent(res.data)
                    val t = r.accessToken
                    if (t != null) call.resolve(JSObject().put("token", t)) else call.reject("Acesso ao Google não autorizado.", "negado")
                } catch (e: Exception) { call.reject("Acesso ao Google não autorizado.", "negado") }
            }
        } catch (e: Exception) { }
        try { Saude.agendar(context, false) } catch (e: Exception) { }
    }

    // ---------------- Samsung Health / Health Connect ----------------
    @PluginMethod
    fun status(call: PluginCall) {
        escopo.launch {
            val s = Saude.disponivel(context)
            val o = JSObject()
            o.put("nativo", true)
            o.put("disponivel", s == HealthConnectClient.SDK_AVAILABLE)
            o.put("precisaAtualizar", s == HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED)
            if (s == HealthConnectClient.SDK_AVAILABLE) {
                val ok = Saude.concedidas(context)
                val falta = Saude.LEITURA.filter { !ok.contains(it) }.map { it.substringAfterLast(".") }
                o.put("autorizado", falta.size < Saude.LEITURA.size)
                o.put("tudo", falta.isEmpty())
                o.put("faltando", JSArray(falta))
                o.put("segundoPlanoExiste", Saude.segundoPlanoExiste(context))
                o.put("segundoPlano", ok.contains(Saude.BACKGROUND))
            }
            val g = Saude.guardado(context)
            o.put("horas", JSArray(Saude.horas(context)))
            o.put("proxima", g.opt("proxima"))
            o.put("ultima", g.opt("em"))
            call.resolve(o)
        }
    }

    @PluginMethod
    fun autorizar(call: PluginCall) {
        val s = Saude.disponivel(context)
        if (s != HealthConnectClient.SDK_AVAILABLE) {
            abrirLoja(); call.reject("Instale ou atualize o Health Connect e tente de novo.", "sem-hc"); return
        }
        try {
            val intent = PermissionController.createRequestPermissionResultContract().createIntent(context, Saude.TODAS)
            startActivityForResult(call, intent, "aoAutorizar")
        } catch (e: Exception) {
            call.reject("Não consegui abrir as permissões do Health Connect.", "erro")
        }
    }

    @ActivityCallback
    private fun aoAutorizar(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        try { Saude.agendar(context, true) } catch (e: Exception) { }
        status(call)
    }

    @PluginMethod
    fun ler(call: PluginCall) {
        val dias = call.getInt("dias", 3) ?: 3
        escopo.launch {
            try {
                val arr = Saude.lerESalvar(context, dias.coerceIn(1, 14), "app")
                call.resolve(JSObject().put("dias", JSArray(arr.toString())).put("em", java.time.Instant.now().toString()))
            } catch (e: Exception) {
                call.reject(e.message ?: "Não consegui ler o Samsung Health.", "erro")
            }
        }
    }

    @PluginMethod
    fun guardado(call: PluginCall) {
        call.resolve(JSObject(Saude.guardado(context).toString()))
    }

    @PluginMethod
    fun horarios(call: PluginCall) {
        val arr = call.getArray("horas")
        if (arr != null) {
            val l = (0 until arr.length()).mapNotNull { arr.optInt(it, -1).takeIf { h -> h in 0..23 } }
            if (l.isNotEmpty()) Saude.definirHoras(context, l)
        }
        try { Saude.agendar(context, true) } catch (e: Exception) { }
        call.resolve(JSObject(Saude.guardado(context).toString()))
    }

    @PluginMethod
    fun abrirHealthConnect(call: PluginCall) {
        try {
            val i = Intent("android.health.connect.action.MANAGE_HEALTH_PERMISSIONS")
                .putExtra(Intent.EXTRA_PACKAGE_NAME, context.packageName)
            activity.startActivity(i)
        } catch (e: Exception) {
            try { activity.startActivity(Intent("androidx.health.ACTION_HEALTH_CONNECT_SETTINGS")) } catch (e2: Exception) { abrirLoja() }
        }
        call.resolve()
    }

    private fun abrirLoja() {
        try {
            activity.startActivity(Intent(Intent.ACTION_VIEW,
                Uri.parse("market://details?id=com.google.android.apps.healthdata")))
        } catch (e: Exception) { }
    }

    // ---------------- Ditado (reconhecimento de voz do Android) ----------------
    @PluginMethod
    fun ouvir(call: PluginCall) {
        if (getPermissionState("microfone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microfone", call, "aoMicrofone"); return
        }
        comecarOuvir(call)
    }

    @PermissionCallback
    private fun aoMicrofone(call: PluginCall) {
        if (getPermissionState("microfone") == PermissionState.GRANTED) comecarOuvir(call)
        else call.reject("Permita o microfone para ditar.", "sem-microfone")
    }

    private fun comecarOuvir(call: PluginCall) {
        activity.runOnUiThread {
            if (!SpeechRecognizer.isRecognitionAvailable(context)) {
                call.reject("Reconhecimento de voz indisponível neste celular.", "sem-voz"); return@runOnUiThread
            }
            reconhecedor?.destroy()
            val r = SpeechRecognizer.createSpeechRecognizer(context)
            reconhecedor = r
            var terminou = false
            r.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) { notifyListeners("ouvindo", JSObject()) }
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {}
                override fun onEvent(eventType: Int, params: Bundle?) {}
                override fun onPartialResults(partial: Bundle?) {
                    val t = partial?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: return
                    notifyListeners("parcial", JSObject().put("texto", t))
                }
                override fun onResults(results: Bundle?) {
                    if (terminou) return; terminou = true
                    val t = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: ""
                    call.resolve(JSObject().put("texto", t))
                    r.destroy(); if (reconhecedor === r) reconhecedor = null
                }
                override fun onError(error: Int) {
                    if (terminou) return; terminou = true
                    if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT)
                        call.resolve(JSObject().put("texto", ""))
                    else call.reject("Não consegui ouvir (erro $error).", "erro-$error")
                    r.destroy(); if (reconhecedor === r) reconhecedor = null
                }
            })
            val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR")
                .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                .putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2500L)
                .putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 2500L)
            r.startListening(i)
        }
    }

    @PluginMethod
    fun parar(call: PluginCall) {
        activity.runOnUiThread { try { reconhecedor?.stopListening() } catch (e: Exception) { } }
        call.resolve()
    }

    // ---------------- Google (planilha) pelo login do Android ----------------
    @PluginMethod
    fun googleToken(call: PluginCall) {
        val scope = call.getString("scope") ?: "https://www.googleapis.com/auth/drive.file"
        val interativo = call.getBoolean("interativo", true) ?: true
        val req = AuthorizationRequest.builder().setRequestedScopes(listOf(Scope(scope))).build()
        Identity.getAuthorizationClient(activity).authorize(req)
            .addOnSuccessListener { r ->
                if (r.hasResolution()) {
                    val pi = r.pendingIntent
                    if (!interativo || pi == null || googleLauncher == null) {
                        call.reject("Toque em Sincronizar para entrar no Google.", "needs-tap"); return@addOnSuccessListener
                    }
                    googleCall = call
                    googleLauncher?.launch(IntentSenderRequest.Builder(pi.intentSender).build())
                } else {
                    val t = r.accessToken
                    if (t != null) call.resolve(JSObject().put("token", t)) else call.reject("Sem acesso ao Google.", "negado")
                }
            }
            .addOnFailureListener { e ->
                val m = e.message ?: ""
                if (m.contains("10:") || m.contains("DEVELOPER_ERROR"))
                    call.reject("Falta liberar o app Android no Google Cloud (Client ID do tipo Android).", "android-client")
                else call.reject("Não consegui entrar no Google: $m", "erro")
            }
    }
}
