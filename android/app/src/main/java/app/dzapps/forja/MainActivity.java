package app.dzapps.forja;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ForjaSaudePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
