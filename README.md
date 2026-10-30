# Forja para Android

App Android do Forja (Capacitor). Abre o site publicado (`main`) e acrescenta o que só um app nativo faz:

- **Samsung Health pelo Health Connect**: treinos, passos, calorias, peso, % de gordura, taxa basal, sono (e água, se o Samsung Health passar a enviar). Lê ao abrir o app e em segundo plano às 8h, 12h, 15h e 21h.
- **Ditado** pelo reconhecimento de voz do Android.
- **Login do Google** pelo Android (o Google não permite login dentro de app).

Cada push neste branch compila o APK no GitHub Actions e publica em Releases (`forja-android/Forja.apk`).
O registro da última compilação fica no branch `android-log`.
