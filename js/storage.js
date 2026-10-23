/*
 * Local accounts and persistence.
 *
 * There is no server: accounts live in localStorage of this browser.
 * Passwords are stored as salted PBKDF2 hashes. "Angemeldet bleiben" keeps
 * the session in localStorage, otherwise it lives in sessionStorage and ends
 * with the tab.
 */
(function (root) {
  "use strict";

  var USERS_KEY = "abiRechner.users";
  var SESSION_KEY = "abiRechner.session";
  var GUEST_KEY = "abiRechner.guest";

  function readJSON(store, key, fallback) {
    try {
      var raw = store.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(store, key, value) {
    try {
      store.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function remove(store, key) {
    try { store.removeItem(key); } catch (e) { /* storage unavailable */ }
  }

  function toHex(buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), function (b) {
      return ("0" + b.toString(16)).slice(-2);
    }).join("");
  }

  function randomHex(bytes) {
    var arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return toHex(arr.buffer);
  }

  function hashPassword(password, salt) {
    if (!root.crypto || !crypto.subtle) {
      return Promise.reject(new Error("Ihr Browser unterstützt keine sichere Passwortverarbeitung. Bitte öffnen Sie die Seite über https:// oder localhost."));
    }
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"])
      .then(function (key) {
        return crypto.subtle.deriveBits(
          { name: "PBKDF2", salt: enc.encode(salt), iterations: 150000, hash: "SHA-256" },
          key,
          256
        );
      })
      .then(toHex);
  }

  function normalize(name) {
    return String(name || "").trim().toLowerCase();
  }

  function users() {
    return readJSON(localStorage, USERS_KEY, {});
  }

  function saveUsers(all) {
    return writeJSON(localStorage, USERS_KEY, all);
  }

  var Storage = {
    currentUser: function () {
      var session = readJSON(sessionStorage, SESSION_KEY, null) || readJSON(localStorage, SESSION_KEY, null);
      if (!session) return null;
      var u = users()[normalize(session.user)];
      return u ? u.displayName : null;
    },

    register: function (name, password, remember) {
      var key = normalize(name);
      if (key.length < 3) return Promise.reject(new Error("Der Benutzername muss mindestens 3 Zeichen haben."));
      if (String(password).length < 6) return Promise.reject(new Error("Das Passwort muss mindestens 6 Zeichen haben."));
      if (users()[key]) return Promise.reject(new Error("Dieser Benutzername ist auf diesem Gerät bereits vergeben."));
      var salt = randomHex(16);
      return hashPassword(password, salt).then(function (hash) {
        var all = users();
        all[key] = { displayName: String(name).trim(), salt: salt, hash: hash, data: null, updated: null };
        if (!saveUsers(all)) throw new Error("Der Browserspeicher ist nicht verfügbar.");
        Storage.startSession(key, remember);
        return all[key].displayName;
      });
    },

    login: function (name, password, remember) {
      var key = normalize(name);
      var u = users()[key];
      if (!u) return Promise.reject(new Error("Benutzername oder Passwort ist falsch."));
      return hashPassword(password, u.salt).then(function (hash) {
        if (hash !== u.hash) throw new Error("Benutzername oder Passwort ist falsch.");
        Storage.startSession(key, remember);
        return u.displayName;
      });
    },

    startSession: function (key, remember) {
      remove(localStorage, SESSION_KEY);
      remove(sessionStorage, SESSION_KEY);
      writeJSON(remember ? localStorage : sessionStorage, SESSION_KEY, { user: key, since: Date.now() });
    },

    logout: function () {
      remove(localStorage, SESSION_KEY);
      remove(sessionStorage, SESSION_KEY);
    },

    deleteAccount: function (name) {
      var all = users();
      delete all[normalize(name)];
      saveUsers(all);
      Storage.logout();
    },

    loadData: function (name) {
      if (!name) return readJSON(sessionStorage, GUEST_KEY, null);
      var u = users()[normalize(name)];
      return u ? u.data : null;
    },

    saveData: function (name, data) {
      if (!name) return writeJSON(sessionStorage, GUEST_KEY, data);
      var all = users();
      var u = all[normalize(name)];
      if (!u) return false;
      u.data = data;
      u.updated = new Date().toISOString();
      return saveUsers(all);
    },

    clearGuest: function () {
      remove(sessionStorage, GUEST_KEY);
    }
  };

  root.AbiStorage = Storage;
})(this);
