const { createClient } = window.supabase;

const supabase = createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY
);

const state = {
    user: null,
    isAdmin: false,
    laws: [],
    favorites: JSON.parse(localStorage.getItem("favorites") || "[]"),
    currentLaw: null,
    registerMode: false
};


// =========================
// ЗАПУСК
// =========================

document.addEventListener("DOMContentLoaded", async () => {

    if (
        !window.SUPABASE_URL ||
        !window.SUPABASE_ANON_KEY ||
        window.SUPABASE_URL.includes("YOUR")
    ) {
        alert("Не настроен config.js");
        return;
    }

    setupButtons();

    const {
        data: { session }
    } = await supabase.auth.getSession();

    await updateSession(session);

    supabase.auth.onAuthStateChange(async (_event, session) => {
        await updateSession(session);
    });

    await loadLaws();
});


// =========================
// КНОПКИ
// =========================

function setupButtons() {

    const authBtn = document.getElementById("authBtn");

    if (authBtn) {
        authBtn.onclick = () => {

            if (state.user) {
                logout();
            } else {
                openAuth(false);
            }
        };
    }

    const registerBtn = document.getElementById("registerBtn");

    if (registerBtn) {
        registerBtn.onclick = () => {
            openAuth(true);
        };
    }

    const form = document.getElementById("authForm");

    if (form) {
        form.addEventListener("submit", handleAuth);
    }

    const search = document.getElementById("search");

    if (search) {
        search.addEventListener("input", renderLaws);
    }

    const type = document.getElementById("type");

    if (type) {
        type.addEventListener("change", renderLaws);
    }

    const status = document.getElementById("status");

    if (status) {
        status.addEventListener("change", renderLaws);
    }
}


// =========================
// АВТОРИЗАЦИЯ
// =========================

function openAuth(register = false) {

    state.registerMode = register;

    const modal = document.getElementById("authModal");

    if (!modal) return;

    modal.classList.remove("hidden");

    updateAuthWindow();
}


function closeAuth() {

    const modal = document.getElementById("authModal");

    if (modal) {
        modal.classList.add("hidden");
    }
}


function updateAuthWindow() {

    const title = document.getElementById("authTitle");
    const error = document.getElementById("authError");

    const button = document.querySelector(
        '#authForm button[type="submit"]'
    );

    const switchButton = document.querySelector(
        '#authForm button[type="button"]'
    );

    if (title) {
        title.textContent =
            state.registerMode
                ? "Регистрация"
                : "Вход";
    }

    if (button) {
        button.textContent =
            state.registerMode
                ? "Зарегистрироваться"
                : "Войти";
    }

    if (switchButton) {
        switchButton.textContent =
            state.registerMode
                ? "У меня уже есть аккаунт"
                : "Регистрация";

        switchButton.onclick = () => {
            state.registerMode = !state.registerMode;
            updateAuthWindow();
        };
    }

    if (error) {
        error.textContent = "";
    }
}


async function handleAuth(event) {

    event.preventDefault();

    const email =
        document.getElementById("email").value.trim();

    const password =
        document.getElementById("password").value;

    const errorElement =
        document.getElementById("authError");

    if (!email || !password) {
        errorElement.textContent =
            "Введите email и пароль.";

        return;
    }

    errorElement.textContent = "Обработка...";

    let result;

    try {

        if (state.registerMode) {

            result = await supabase.auth.signUp({
                email: email,
                password: password
            });

        } else {

            result = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
        }

    } catch (error) {

        errorElement.textContent =
            "Ошибка подключения к Supabase.";

        console.error(error);

        return;
    }

    if (result.error) {

        console.error(result.error);

        errorElement.textContent =
            translateAuthError(result.error);

        return;
    }

    if (state.registerMode) {

        errorElement.textContent =
            "Регистрация выполнена. Проверьте почту, если подтверждение email включено.";

        state.registerMode = false;

        updateAuthWindow();

    } else {

        closeAuth();

    }
}


function translateAuthError(error) {

    const message = error?.message || "";

    if (message.includes("Invalid login credentials")) {
        return "Неверный email или пароль.";
    }

    if (message.includes("User already registered")) {
        return "Этот email уже зарегистрирован.";
    }

    if (message.includes("Password should be")) {
        return "Пароль должен содержать минимум 6 символов.";
    }

    if (message.includes("Email not confirmed")) {
        return "Сначала подтвердите email.";
    }

    if (message.includes("Invalid path")) {
        return "Неверно настроен адрес Supabase. Проверьте config.js.";
    }

    return message;
}


async function logout() {

    await supabase.auth.signOut();

    state.user = null;
    state.isAdmin = false;

    showUserState();
}


// =========================
// СЕССИЯ
// =========================

async function updateSession(session) {

    state.user = session?.user || null;
    state.isAdmin = false;

    if (state.user) {

        const { data, error } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", state.user.id)
            .maybeSingle();

        if (!error && data) {
            state.isAdmin = data.role === "admin";
        }
    }

    showUserState();
}


function showUserState() {

    const userLabel =
        document.getElementById("userLabel");

    const authBtn =
        document.getElementById("authBtn");

    const registerBtn =
        document.getElementById("registerBtn");

    if (userLabel) {

        userLabel.textContent =
            state.user
                ? (
                    state.isAdmin
                        ? "Администратор"
                        : state.user.email
                )
                : "Гость";
    }

    if (authBtn) {

        authBtn.textContent =
            state.user
                ? "Выйти"
                : "Войти";
    }

    if (registerBtn) {

        registerBtn.classList.toggle(
            "hidden",
            !!state.user
        );
    }

    document
        .querySelectorAll(".admin-only")
        .forEach(element => {

            element.classList.toggle(
                "hidden",
                !state.isAdmin
            );
        });
}


// =========================
// ЗАКОНЫ
// =========================

async function loadLaws() {

    const { data, error } = await supabase
        .from("laws")
        .select("*")
        .order("title");

    if (error) {

        console.error("Supabase:", error);

        state.laws = [];

        renderLaws();

        return;
    }

    state.laws = data || [];

    fillTypes();

    renderLaws();
    renderFavorites();

    if (state.isAdmin) {
        renderAdmin();
    }
}


function fillTypes() {

    const select =
        document.getElementById("type");

    if (!select) return;

    const types = [
        ...new Set(
            state.laws.map(law => law.type)
        )
    ].sort();

    select.innerHTML =
        `<option value="">Все виды</option>` +
        types.map(type =>
            `<option value="${escapeAttr(type)}">
                ${escapeHtml(type)}
            </option>`
        ).join("");
}


function renderLaws() {

    const list =
        document.getElementById("list");

    if (!list) return;

    const search =
        (
            document.getElementById("search")?.value ||
            ""
        ).toLowerCase();

    const type =
        document.getElementById("type")?.value || "";

    const status =
        document.getElementById("status")?.value || "";

    const filtered =
        state.laws.filter(law => {

            const text = [
                law.title,
                law.number,
                law.description,
                law.current_text,
                ...(law.tags || [])
            ]
                .join(" ")
                .toLowerCase();

            return (
                (!search || text.includes(search)) &&
                (!type || law.type === type) &&
                (!status || law.status === status)
            );
        });

    const count =
        document.getElementById("docCount");

    if (count) {
        count.textContent = state.laws.length;
    }

    const results =
        document.getElementById("results");

    if (results) {
        results.textContent =
            `Найдено документов: ${filtered.length}`;
    }

    list.innerHTML =
        filtered.length
            ? filtered.map(createLawCard).join("")
            : `<div class="law-card">
                    Документы не найдены.
               </div>`;
}


function createLawCard(law) {

    return `
        <div
            class="law-card"
            onclick="app.openLaw('${law.id}')"
        >

            <div class="law-meta">

                <span class="badge">
                    ${escapeHtml(law.type)}
                </span>

                <span class="badge green">
                    ${escapeHtml(law.status)}
                </span>

            </div>

            <h3>
                ${escapeHtml(law.title)}
            </h3>

            <p>
                ${escapeHtml(law.description || "")}
            </p>

            <div class="law-number">

                ${escapeHtml(law.number || "")}

                ·

                ${escapeHtml(law.date || "Дата не указана")}

                ·

                редакция ${law.version || 1}

            </div>

        </div>
    `;
}


// =========================
// ПРОСМОТР
// =========================

function openLaw(id) {

    const law =
        state.laws.find(item => item.id === id);

    if (!law) return;

    state.currentLaw = law;

    document
        .querySelectorAll(".view")
        .forEach(view =>
            view.classList.add("hidden")
        );

    document
        .getElementById("document")
        ?.classList.remove("hidden");

    const doc =
        document.getElementById("doc");

    if (!doc) return;

    doc.innerHTML = `

        <div class="doc-header">

            <div class="law-meta">

                <span class="badge">
                    ${escapeHtml(law.type)}
                </span>

                <span class="badge green">
                    ${escapeHtml(law.status)}
                </span>

            </div>

            <h1>
                ${escapeHtml(law.title)}
            </h1>

            <p>
                ${escapeHtml(law.description || "")}
            </p>

            <div class="law-number">

                ${escapeHtml(law.number || "")}

                ·

                ${escapeHtml(law.date || "Дата не указана")}

                ·

                редакция №${law.version || 1}

            </div>

        </div>

        <div class="doc-body">
            ${escapeHtml(law.current_text || "")}
        </div>
    `;

    const favButton =
        document.getElementById("favDoc");

    if (favButton) {

        favButton.textContent =
            state.favorites.includes(id)
                ? "★ В избранном"
                : "☆ В избранное";

        favButton.onclick = () =>
            toggleFavorite(id);
    }
}


// =========================
// ИЗБРАННОЕ
// =========================

function toggleFavorite(id) {

    if (state.favorites.includes(id)) {

        state.favorites =
            state.favorites.filter(
                item => item !== id
            );

    } else {

        state.favorites.push(id);
    }

    localStorage.setItem(
        "favorites",
        JSON.stringify(state.favorites)
    );

    openLaw(id);
    renderFavorites();
}


function renderFavorites() {

    const list =
        document.getElementById("favList");

    if (!list) return;

    const laws =
        state.laws.filter(law =>
            state.favorites.includes(law.id)
        );

    list.innerHTML =
        laws.length
            ? laws.map(createLawCard).join("")
            : `<div class="law-card">
                    В избранном пока нет документов.
               </div>`;
}


// =========================
// АДМИНИСТРАТОР
// =========================

function openAdmin() {

    if (!state.isAdmin) {

        alert(
            "Доступ разрешён только администраторам."
        );

        return;
    }

    document
        .querySelectorAll(".view")
        .forEach(view =>
            view.classList.add("hidden")
        );

    document
        .getElementById("admin")
        ?.classList.remove("hidden");

    renderAdmin();
}


function renderAdmin() {

    const table =
        document.getElementById("adminTable");

    if (!table) return;

    table.innerHTML = `

        <div class="admin-row header">

            <div>Документ</div>
            <div>Вид</div>
            <div>Статус</div>
            <div>Действия</div>

        </div>

        ${
            state.laws.map(law => `

                <div class="admin-row">

                    <div>
                        <b>
                            ${escapeHtml(law.title)}
                        </b>

                        <div class="law-number">
                            редакция ${law.version || 1}
                        </div>
                    </div>

                    <div>
                        ${escapeHtml(law.type)}
                    </div>

                    <div>
                        ${escapeHtml(law.status)}
                    </div>

                    <div class="admin-actions">

                        <button
                            class="small-btn"
                            onclick="app.openLaw('${law.id}')"
                        >
                            Открыть
                        </button>

                        <button
                            class="small-btn"
                            onclick="app.editLaw('${law.id}')"
                        >
                            Изменить
                        </button>

                        <button
                            class="small-btn danger"
                            onclick="app.deleteLaw('${law.id}')"
                        >
                            Удалить
                        </button>

                    </div>

                </div>

            `).join("")
        }

    `;
}


// =========================
// РЕДАКТИРОВАНИЕ
// =========================

function editLaw(id = null) {

    if (!state.isAdmin) {

        alert("Недостаточно прав.");

        return;
    }

    const law =
        id
            ? state.laws.find(item => item.id === id)
            : {
                title: "",
                type: "Федеральный закон",
                number: "",
                date: "",
                status: "Действует",
                tags: [],
                description: "",
                current_text: ""
            };

    if (!law) return;

    const modal =
        document.getElementById("lawModal");

    const form =
        document.getElementById("lawForm");

    if (!modal || !form) return;

    document
        .getElementById("lawModalTitle")
        .textContent =
            id
                ? "Редактирование документа"
                : "Новый документ";

    form.innerHTML = `

        <div class="grid">

            <label class="full">
                Название

                <input
                    name="title"
                    required
                    value="${escapeAttr(law.title || "")}"
                >
            </label>

            <label>
                Вид

                <select name="type">

                    <option>Конституция</option>
                    <option>Кодекс</option>
                    <option>Федеральный закон</option>
                    <option>Подзаконный акт</option>
                    <option>Иной документ</option>

                </select>
            </label>

            <label>
                Номер

                <input
                    name="number"
                    value="${escapeAttr(law.number || "")}"
                >
            </label>

            <label>
                Дата

                <input
                    name="date"
                    type="date"
                    value="${escapeAttr(law.date || "")}"
                >
            </label>

            <label>
                Статус

                <select name="status">

                    <option>Действует</option>
                    <option>Утратил силу</option>

                </select>

            </label>

            <label class="full">
                Теги

                <input
                    name="tags"
                    value="${escapeAttr(
                        (law.tags || []).join(", ")
                    )}"
                >
            </label>

            <label class="full">
                Описание

                <input
                    name="description"
                    value="${escapeAttr(
                        law.description || ""
                    )}"
                >
            </label>

            <label class="full">
                Полный текст

                <textarea
                    name="text"
                    required
                >${escapeHtml(
                    law.current_text || ""
                )}</textarea>

            </label>

        </div>

        <div class="form-actions">

            <button
                type="button"
                class="secondary-btn"
                onclick="app.closeLawModal()"
            >
                Отмена
            </button>

            <button
                type="submit"
                class="primary-btn"
            >
                Опубликовать
            </button>

        </div>
    `;

    form.type.value =
        law.type || "Федеральный закон";

    form.status.value =
        law.status || "Действует";

    form.onsubmit = async event => {

        event.preventDefault();

        await saveLaw(
            id,
            new FormData(form)
        );
    };

    modal.classList.remove("hidden");
}


async function saveLaw(id, formData) {

    if (!state.isAdmin) {

        alert("Недостаточно прав.");

        return;
    }

    const law = {

        title:
            String(formData.get("title") || "")
                .trim(),

        type:
            formData.get("type"),

        number:
            String(formData.get("number") || "")
                .trim(),

        date:
            formData.get("date") || null,

        status:
            formData.get("status"),

        tags:
            String(formData.get("tags") || "")
                .split(",")
                .map(item => item.trim())
                .filter(Boolean),

        description:
            String(formData.get("description") || "")
                .trim(),

        current_text:
            String(formData.get("text") || "")
    };

    let result;

    if (id) {

        result =
            await supabase
                .from("laws")
                .update(law)
                .eq("id", id);

    } else {

        result =
            await supabase
                .from("laws")
                .insert(law);
    }

    if (result.error) {

        console.error(result.error);

        alert(
            "Ошибка публикации: " +
            result.error.message
        );

        return;
    }

    closeLawModal();

    await loadLaws();

    alert(
        id
            ? "Новая редакция опубликована."
            : "Документ опубликован."
    );
}


async function deleteLaw(id) {

    if (!state.isAdmin) return;

    if (
        !confirm(
            "Удалить этот документ?"
        )
    ) {
        return;
    }

    const { error } =
        await supabase
            .from("laws")
            .delete()
            .eq("id", id);

    if (error) {

        alert(
            "Ошибка удаления: " +
            error.message
        );

        return;
    }

    await loadLaws();
}


function closeLawModal() {

    document
        .getElementById("lawModal")
        ?.classList.add("hidden");
}


// =========================
// НАВИГАЦИЯ
// =========================

function showView(id) {

    document
        .querySelectorAll(".view")
        .forEach(view =>
            view.classList.add("hidden")
        );

    const view =
        document.getElementById(id);

    if (view) {
        view.classList.remove("hidden");
    }

    if (id === "admin") {
        openAdmin();
    }

    window.scrollTo(0, 0);
}


// =========================
// БЕЗОПАСНЫЙ HTML
// =========================

function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function escapeAttr(value) {

    return escapeHtml(value);
}


// =========================
// ГЛОБАЛЬНЫЙ APP
// =========================

window.app = {

    openLaw,
    editLaw,
    deleteLaw,
    closeLawModal,

    go: showView,

    openAuth,
    closeAuth,

    toggleAuth: () => {
        state.registerMode =
            !state.registerMode;

        updateAuthWindow();
    }
};
