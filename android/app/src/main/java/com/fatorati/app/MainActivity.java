package com.fatorati.app;

import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    static final int[] PREFS_NAME = {28, 10, 8, 226, 236, 206, 180, 184, 177, 150, 103, 96, 84, 94, 60, 32};
    static final int[] KEY_SECURE = {41, 14, 31, 248, 236, 202, 147, 178, 144, 150, 97, 123};

    static String d(int[] data) {
        char[] out = new char[data.length];
        for (int i = 0; i < data.length; i++) {
            out[i] = (char) (data[i] ^ ((0x5A + i * 17) & 0xFF));
        }
        return new String(out);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        if (getSharedPreferences(d(PREFS_NAME), MODE_PRIVATE).getBoolean(d(KEY_SECURE), true)) {
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
