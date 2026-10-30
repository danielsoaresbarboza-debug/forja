package app.dzapps.forja;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

/** Tela que o Health Connect abre quando a pessoa pergunta "por que o Forja quer esses dados?". */
public class PrivacidadeActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            startActivity(new Intent(Intent.ACTION_VIEW,
                Uri.parse("https://danielsoaresbarboza-debug.github.io/forja/privacidade.html")));
        } catch (Exception ignored) { }
        finish();
    }
}
