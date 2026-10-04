package com.jcbbillgenerator.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;

@CapacitorPlugin(name = "NativeSharePlugin")
public class NativeSharePlugin extends Plugin {

    private boolean isPackageInstalled(String packageName, PackageManager pm) {
        try {
            pm.getPackageInfo(packageName, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    @PluginMethod
    public void isWhatsAppInstalled(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        boolean installed = isPackageInstalled("com.whatsapp", pm) || isPackageInstalled("com.whatsapp.w4b", pm);
        JSObject ret = new JSObject();
        ret.put("installed", installed);
        call.resolve(ret);
    }

    @PluginMethod
    public void shareImage(PluginCall call) {
        String base64Data = call.getString("base64Data");
        String fileName = call.getString("fileName", "JCB-Bill.png");
        String text = call.getString("text", "");
        String target = call.getString("target", "whatsapp"); // "whatsapp" or "general"

        if (base64Data == null || base64Data.trim().isEmpty()) {
            call.reject("Image data is required.");
            return;
        }

        try {
            // 1. Strip base64 data URL prefix if present (e.g. "data:image/png;base64,")
            if (base64Data.contains(",")) {
                base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
            }
            byte[] imageBytes = Base64.decode(base64Data, Base64.DEFAULT);

            // 2. Save image to cache directory for FileProvider
            Context context = getContext();
            File cacheDir = new File(context.getCacheDir(), "shared_bills");
            if (!cacheDir.exists()) {
                cacheDir.mkdirs();
            }

            File imageFile = new File(cacheDir, fileName);
            try (FileOutputStream fos = new FileOutputStream(imageFile)) {
                fos.write(imageBytes);
                fos.flush();
            }

            // 3. Obtain FileProvider content:// URI
            String authority = context.getPackageName() + ".fileprovider";
            Uri contentUri = FileProvider.getUriForFile(context, authority, imageFile);

            // 4. Resolve target app package if WhatsApp specified
            PackageManager pm = context.getPackageManager();
            String whatsappPackage = null;
            if ("whatsapp".equalsIgnoreCase(target)) {
                if (isPackageInstalled("com.whatsapp", pm)) {
                    whatsappPackage = "com.whatsapp";
                } else if (isPackageInstalled("com.whatsapp.w4b", pm)) {
                    whatsappPackage = "com.whatsapp.w4b";
                } else {
                    call.reject("WhatsApp is not installed on this phone.", "WHATSAPP_NOT_INSTALLED");
                    return;
                }
            }

            // 5. Construct Android ACTION_SEND Intent
            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("image/png");
            shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
            if (text != null && !text.isEmpty()) {
                shareIntent.putExtra(Intent.EXTRA_TEXT, text);
            }
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            if (whatsappPackage != null) {
                shareIntent.setPackage(whatsappPackage);
                context.grantUriPermission(whatsappPackage, contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            }

            // 6. Launch share activity
            if (getActivity() != null) {
                if (whatsappPackage != null) {
                    getActivity().startActivity(shareIntent);
                } else {
                    Intent chooser = Intent.createChooser(shareIntent, "Share JCB Bill");
                    getActivity().startActivity(chooser);
                }
            } else {
                shareIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                if (whatsappPackage != null) {
                    context.startActivity(shareIntent);
                } else {
                    Intent chooser = Intent.createChooser(shareIntent, "Share JCB Bill");
                    chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(chooser);
                }
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("target", target);
            call.resolve(ret);

        } catch (Exception e) {
            call.reject("Failed to share image: " + e.getMessage(), e);
        }
    }
}
