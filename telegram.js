/* Falling Pickaxe — интеграция с Telegram Mini Apps.
   Если игра открыта в обычном браузере, файл ничего не делает. */
(function () {
  "use strict";
  var tg = window.Telegram && window.Telegram.WebApp;
  if (!tg) return;

  // true = на телефоне игра откроется в полноэкранном режиме (Bot API 8.0+).
  // Кнопки Telegram (закрыть / меню) тогда перекрывают верх экрана — по умолчанию выключено.
  var FULLSCREEN = false;

  var root = document.documentElement;
  root.classList.add("tg");

  function at(v) { try { return tg.isVersionAtLeast(v); } catch (_) { return false; } }
  function safe(fn) { try { fn(); } catch (_) {} }

  safe(function () { tg.ready(); });
  safe(function () { tg.expand(); });
  if (FULLSCREEN && at("8.0")) safe(function () { tg.requestFullscreen(); });

  // Запрещаем закрытие приложения свайпом вниз — иначе он сбивает раунд.
  if (at("7.7")) safe(function () { tg.disableVerticalSwipes(); });
  // Подтверждение при закрытии посреди раунда.
  if (at("6.2")) safe(function () { tg.enableClosingConfirmation(); });

  // Цвета шапки и фона под палитру игры.
  if (at("6.1")) safe(function () { tg.setBackgroundColor("#0a0f16"); });
  if (at("6.9")) safe(function () { tg.setHeaderColor("#121b28"); });
  if (at("7.10")) safe(function () { tg.setBottomBarColor("#0a0f16"); });

  // Тактильный отклик на нажатия кнопок.
  if (at("6.1") && tg.HapticFeedback) {
    document.addEventListener("pointerdown", function (e) {
      var t = e.target && e.target.closest ? e.target.closest("button") : null;
      if (!t || t.disabled) return;
      var big = t.id === "playBtn";
      safe(function () { tg.HapticFeedback.impactOccurred(big ? "medium" : "light"); });
    }, { passive: true });
  }

  // Пересчёт раскладки, когда Telegram меняет размер окна (раскрытие, клавиатура и т.п.).
  function relayout() { window.dispatchEvent(new Event("resize")); }
  safe(function () { tg.onEvent("viewportChanged", relayout); });
  safe(function () { tg.onEvent("safeAreaChanged", relayout); });
  safe(function () { tg.onEvent("contentSafeAreaChanged", relayout); });

  // Отступы под системные элементы Telegram в полноэкранном режиме.
  function applyInsets() {
    var s = tg.safeAreaInset || {}, c = tg.contentSafeAreaInset || {};
    root.style.setProperty("--tg-top", ((s.top || 0) + (c.top || 0)) + "px");
    root.style.setProperty("--tg-bottom", ((s.bottom || 0) + (c.bottom || 0)) + "px");
  }
  applyInsets();
  safe(function () { tg.onEvent("safeAreaChanged", applyInsets); });
  safe(function () { tg.onEvent("contentSafeAreaChanged", applyInsets); });

  // Имя игрока из Telegram доступно как window.TG_USER (на будущее: лидерборд и т.п.).
  var u = tg.initDataUnsafe && tg.initDataUnsafe.user;
  window.TG_USER = u ? { id: u.id, name: u.first_name, username: u.username || null } : null;
})();
