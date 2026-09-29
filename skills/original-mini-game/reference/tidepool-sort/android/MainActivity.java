package com.tidepoolsort.game;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.io.IOException;

// Offline WebView shell: serves the bundled game from assets under https://tidepool.local/.
public class MainActivity extends Activity {
  private static final String HOST = "tidepool.local";
  private WebView game;

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    game = new WebView(this);
    game.setBackgroundColor(Color.rgb(14, 93, 122));
    game.setOnApplyWindowInsetsListener((view, insets) -> {
      view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
          insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
      return insets.consumeSystemWindowInsets();
    });
    setContentView(game);
    WebSettings settings = game.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(false);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    game.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        return !HOST.equals(request.getUrl().getHost());
      }
      @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        String path = request.getUrl().getPath();
        if (HOST.equals(request.getUrl().getHost()) && path != null && !path.contains("..")) {
          if (path.equals("/")) path = "/index.html";
          String mime = path.endsWith(".html") ? "text/html" : path.endsWith(".js") ? "text/javascript"
              : path.endsWith(".css") ? "text/css" : path.endsWith(".png") ? "image/png"
              : path.endsWith(".svg") ? "image/svg+xml" : "text/plain";
          try { return new WebResourceResponse(mime, "UTF-8", getAssets().open(path.substring(1))); }
          catch (IOException e) { /* fall through to 404 */ }
        }
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null, new ByteArrayInputStream(new byte[0]));
      }
    });
    game.loadUrl("https://" + HOST + "/index.html");
  }
  @Override protected void onPause() { super.onPause(); game.onPause(); }
  @Override protected void onResume() { super.onResume(); if (game != null) game.onResume(); }
  @Override protected void onDestroy() { game.destroy(); super.onDestroy(); }
}
