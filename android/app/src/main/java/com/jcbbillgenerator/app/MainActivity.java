package com.jcbbillgenerator.app;

import android.graphics.Color;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GalleryPlugin.class);
        registerPlugin(DirectSmsPlugin.class);
        registerPlugin(NativeSharePlugin.class);
        
        // Ensure native title bar / ActionBar is completely disabled
        requestWindowFeature(android.view.Window.FEATURE_NO_TITLE);
        
        // Prevent window background or splash flash during native Activity creation
        getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(Color.parseColor("#0B0F14")));
        getWindow().getDecorView().setBackgroundColor(Color.parseColor("#0B0F14"));
        
        super.onCreate(savedInstanceState);
        
        if (getSupportActionBar() != null) {
            getSupportActionBar().hide();
        }
        
        // Ensure window background drawable remains solid dark
        getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(Color.parseColor("#0B0F14")));
        
        // Set WebView background to dark to prevent white canvas flash before web content renders
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().setBackgroundColor(Color.parseColor("#0B0F14"));
        }
    }
}
