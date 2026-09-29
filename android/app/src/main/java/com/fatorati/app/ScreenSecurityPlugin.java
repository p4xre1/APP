package com.fatorati.app;

import android.content.Context;
import android.view.WindowManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ScreenSecurity")
public class ScreenSecurityPlugin extends Plugin {
    @PluginMethod
    public void setSecure(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", true);
        getActivity().runOnUiThread(() -> {
            boolean saved = getContext().getSharedPreferences("FatoratiSecurity", Context.MODE_PRIVATE)
                .edit().putBoolean("secureScreen", enabled).commit();
            if (!saved) { call.reject("Operation failed"); return; }
            if (enabled) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            call.resolve();
        });
    }
}
