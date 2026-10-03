package com.fatorati.app;

import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        if (getSharedPreferences("FatoratiSecurity", MODE_PRIVATE).getBoolean("secureScreen", true)) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        }
        registerPlugin(ScreenSecurityPlugin.class);
        super.onCreate(savedInstanceState);
        WebView.setWebContentsDebuggingEnabled(false);
    }

    @Override
    public void onResume() {
        super.onResume();
        WebView.setWebContentsDebuggingEnabled(false);
    }
}
