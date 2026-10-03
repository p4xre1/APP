package com.fatorati.app;

import android.content.Context;
import android.view.WindowManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ScreenSecurity")
public class ScreenSecurityPlugin extends Plugin {
    private static final int[] KEY_ENABLED = {63, 5, 29, 239, 242, 202, 164};
    private static final int[] ERR_FAILED = {21, 27, 25, 255, 255, 219, 169, 190, 140, 211, 98, 116, 79, 91, 45, 61};

    @PluginMethod
    public void setSecure(PluginCall call) {
        boolean enabled = call.getBoolean(MainActivity.d(KEY_ENABLED), true);
        getActivity().runOnUiThread(() -> {
            boolean saved = getContext().getSharedPreferences(MainActivity.d(MainActivity.PREFS_NAME), Context.MODE_PRIVATE)
                .edit().putBoolean(MainActivity.d(MainActivity.KEY_SECURE), enabled).commit();
            if (!saved) { call.reject(MainActivity.d(ERR_FAILED)); return; }
            if (enabled) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            call.resolve();
        });
    }
}
