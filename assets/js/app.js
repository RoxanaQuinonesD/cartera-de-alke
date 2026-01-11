/* =========================
   CONFIG
========================= */
const USER = { email: "user@alkewallet.com", password: "1234", name: "Usuario ejercicio" };
const INITIAL_BALANCE = 25000;

const DEFAULT_CONTACTS = [
  { name: "El Profe", bank: "Banco Estado", account: "11111111" },
  { name: "Batman", bank: "Gotham Bank", account: "22222222" },
  { name: "Robin", bank: "Gotham Bank", account: "33333333" }
];

/* =========================
   HELPERS
========================= */
function norm(s) { return String(s || "").trim().toLowerCase(); }

function formatCLP(v) {
  return Number(v).toLocaleString("es-CL", { style: "currency", currency: "CLP" });
}

/* =========================
   CONTACTS
========================= */
function migrateContacts(list) {
  return list.map((c) => {
    if (typeof c === "string") {
      const found = DEFAULT_CONTACTS.find((d) => norm(d.name) === norm(c));
      return found ? { ...found } : { name: c, bank: "Banco no definido", account: "Sin cuenta" };
    }
    return {
      name: c?.name ? String(c.name).trim() : "Sin nombre",
      bank: c?.bank ? String(c.bank).trim() : "Banco no definido",
      account: c?.account ? String(c.account).trim() : "Sin cuenta"
    };
  });
}

function getContacts() {
  const raw = localStorage.getItem("contacts");
  if (!raw) return [...DEFAULT_CONTACTS];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_CONTACTS];
    const migrated = migrateContacts(parsed);
    localStorage.setItem("contacts", JSON.stringify(migrated));
    return migrated;
  } catch {
    return [...DEFAULT_CONTACTS];
  }
}

function saveContacts(list) {
  localStorage.setItem("contacts", JSON.stringify(list));
}

/* =========================
   TRANSACTIONS
========================= */
function readArrayFromKey(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getTransactions() {

  const tx = readArrayFromKey("tx");
  if (tx) return tx;

  const old1 = readArrayFromKey("transactions");
  if (old1) {
    localStorage.setItem("tx", JSON.stringify(old1));
    return old1;
  }

  const old2 = readArrayFromKey("movements");
  if (old2) {
    localStorage.setItem("tx", JSON.stringify(old2));
    return old2;
  }

  return [];
}

function saveTransactions(list) {
  localStorage.setItem("tx", JSON.stringify(list));
}

/* =========================
   BALANCE
========================= */
function getBalance() {
  const raw = localStorage.getItem("balance");
  const n = Number(raw);
  if (raw === null || Number.isNaN(n)) return INITIAL_BALANCE;
  return n;
}

function saveBalance(n) {
  localStorage.setItem("balance", String(n));
}

/* =========================
   INIT
========================= */
function initOnceSafe() {

  if (!localStorage.getItem("contacts")) {
    saveContacts([...DEFAULT_CONTACTS]);
  }

  
  if (localStorage.getItem("balance") === null) {
    saveBalance(INITIAL_BALANCE);
  }

  if (!localStorage.getItem("tx")) {
    const old = readArrayFromKey("transactions") || readArrayFromKey("movements");
    if (old) localStorage.setItem("tx", JSON.stringify(old));
  }
}

/* =========================
   AUTH
========================= */
function requireLogin(page) {
  const logged = localStorage.getItem("logged");
  if (!logged && page !== "login") location.href = "login.html";
}

/* =========================
   APP
========================= */
$(document).ready(function () {
  initOnceSafe();

  const page = $("body").data("page");

  let balance = getBalance();
  let transactions = getTransactions();

  /* ---------- LOGIN ---------- */
  if (page === "login") {
    $("#loginForm").on("submit", function (e) {
      e.preventDefault();
      const email = $("#email").val();
      const password = $("#password").val();

      if (email === USER.email && password === USER.password) {
        localStorage.setItem("logged", "true");
        location.href = "menu.html";
      } else {
        $("#msg").removeClass("d-none alert-success").addClass("alert-danger").text("Credenciales incorrectas");
      }
    });
    return;
  }

  requireLogin(page);

  /* ---------- COMMON ---------- */
  if ($("#userName").length) $("#userName").text(USER.name);
  if ($("#balance").length) $("#balance").text(formatCLP(balance));

  $("#logout").on("click", function () {
    localStorage.removeItem("logged");
    location.href = "login.html";
  });

  /* ---------- DEPOSIT ---------- */
  if (page === "deposit" && $("#depositForm").length) {
    $("#depositForm").on("submit", function (e) {
      e.preventDefault();
      const amount = Number($("#amount").val());
      if (!amount || amount <= 0) return;

      balance += amount;

      transactions.push({
        date: new Date().toLocaleString("es-CL"),
        type: "Depósito",
        amount: amount
      });

      saveBalance(balance);
      saveTransactions(transactions);
      location.href = "menu.html";
    });
  }

  /* ---------- SEND MONEY ---------- */
  if (page === "send" && $("#sendForm").length) {
    const contacts = getContacts();
    const $select = $("#contactSelect");

    $select.empty();
    $select.append(`<option value="" selected disabled>Selecciona un contacto</option>`);
    contacts.forEach((c, idx) => {
      $select.append(`<option value="${idx}">${c.name} — ${c.bank} — Cuenta: ${c.account}</option>`);
    });

    $("#sendForm").on("submit", function (e) {
      e.preventDefault();

      const idx = $("#contactSelect").val();
      const amount = Number($("#amount").val());

      if (idx === null || idx === "" || idx === undefined) {
        alert("Selecciona un contacto.");
        return;
      }
      if (!amount || amount <= 0) return;
      if (amount > balance) {
        alert("Saldo insuficiente.");
        return;
      }

      const contact = contacts[Number(idx)];
      balance -= amount;

      transactions.push({
        date: new Date().toLocaleString("es-CL"),
        type: `Envío a ${contact.name} (${contact.bank} - ${contact.account})`,
        amount: -amount
      });

      saveBalance(balance);
      saveTransactions(transactions);
      location.href = "menu.html";
    });
  }

  /* ---------- TRANSACTIONS + ADD CONTACT ---------- */
  if (page === "tx") {
    // render movimientos
    const $tbody = $("#txBody");
    $tbody.empty();


    [...transactions].reverse().forEach((t) => {
      $tbody.append(`
        <tr>
          <td>${t.date}</td>
          <td>${t.type}</td>
          <td>${formatCLP(t.amount)}</td>
        </tr>
      `);
    });

    // contactos
    function renderContacts() {
      const contacts = getContacts();
      const $ul = $("#contactsUl");
      if (!$ul.length) return;
      $ul.empty();
      contacts.forEach((c) => {
        $ul.append(`
          <li class="list-group-item">
            <strong>${c.name}</strong><br>
            <small class="text-muted">${c.bank} — Cuenta: ${c.account}</small>
          </li>
        `);
      });
    }

    renderContacts();

    // agregar contacto
    if ($("#addContactForm").length) {
      $("#addContactForm").on("submit", function (e) {
        e.preventDefault();

        const name = $("#contactName").val().trim();
        const bank = $("#contactBank").val().trim();
        const account = $("#contactAccount").val().trim();

        if (!name || !bank || !account) return;

        const contacts = getContacts();
        const exists = contacts.some(
          (c) => norm(c.name) === norm(name) && norm(c.bank) === norm(bank) && norm(c.account) === norm(account)
        );

        if (exists) {
          alert("Ese contacto ya existe.");
          return;
        }

        contacts.push({ name, bank, account });
        saveContacts(contacts);
        renderContacts();
        this.reset();
      });
    }
  }
});