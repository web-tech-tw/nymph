import { Html } from "@elysiajs/html";

export interface TokensPageProps {
    saraInteHost?: string;
    baseUrl?: string;
}

export function TokensPage({
    saraInteHost = Bun.env.SARA_INTE_HOST || "https://web-tech.tw/sara",
    baseUrl = Bun.env.BASE_URL || "",
}: TokensPageProps = {}) {
    const configJson = JSON.stringify({
        saraInteHost,
        baseUrl,
    });

    return (
        <html lang="zh-TW">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>MCP Tokens - Nymph - Web Tech TW</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
                <style>{`
                    [x-cloak] { display: none !important; }
                `}</style>
                <script>{`
                    function app(config) {
                        return {
                            isLoad: true,
                            isLoggedIn: false,
                            userId: '',
                            nickname: '',
                            avatarUrl: '',
                            email: '',
                            saraHost: config.saraInteHost,
                            saraLoginUrl: config.saraInteHost,

                            // Token management state
                            tokens: [],
                            isTokensLoading: false,
                            newTokenLabel: '',
                            isCreatingToken: false,
                            editingTokenId: null,
                            editingTokenLabel: '',
                            notification: '',
                            notificationType: 'success',
                            copiedTokenId: null,
                            visibleSecrets: {},

                            showNotification(msg, type = 'success') {
                                this.notification = msg;
                                this.notificationType = type;
                                setTimeout(() => {
                                    if (this.notification === msg) {
                                        this.notification = '';
                                    }
                                }, 4000);
                            },

                            toggleSecretVisibility(id) {
                                this.visibleSecrets[id] = !this.visibleSecrets[id];
                            },

                            async copyToClipboard(text, id) {
                                try {
                                    await navigator.clipboard.writeText(text);
                                    this.copiedTokenId = id;
                                    setTimeout(() => {
                                        if (this.copiedTokenId === id) {
                                            this.copiedTokenId = null;
                                        }
                                    }, 2000);
                                } catch (err) {
                                    this.showNotification('複製失敗', 'error');
                                }
                            },

                            async fetchTokens() {
                                const saraToken = localStorage.getItem('unified_token');
                                if (!saraToken) return;

                                this.isTokensLoading = true;
                                try {
                                    const apiBaseUrl = new URL(config.baseUrl || '', window.location.origin);
                                    const endpoint = new URL('mcp/tokens?format=json', apiBaseUrl.href.endsWith('/') ? apiBaseUrl : apiBaseUrl.href + '/');
                                    const res = await fetch(endpoint, {
                                        headers: {
                                            'Authorization': ['SARA', saraToken].join(' '),
                                        },
                                    });
                                    if (res.ok) {
                                        const data = await res.json();
                                        this.tokens = data.tokens || [];
                                    }
                                } catch (e) {
                                    console.warn('Failed to fetch MCP tokens:', e);
                                } finally {
                                    this.isTokensLoading = false;
                                }
                            },

                            async createToken() {
                                const label = this.newTokenLabel.trim();
                                if (!label) return;

                                const saraToken = localStorage.getItem('unified_token');
                                if (!saraToken) return;

                                this.isCreatingToken = true;
                                try {
                                    const apiBaseUrl = new URL(config.baseUrl || '', window.location.origin);
                                    const endpoint = new URL('mcp/tokens', apiBaseUrl.href.endsWith('/') ? apiBaseUrl : apiBaseUrl.href + '/');
                                    const res = await fetch(endpoint, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': ['SARA', saraToken].join(' '),
                                        },
                                        body: JSON.stringify({ label }),
                                    });

                                    if (res.ok) {
                                        const data = await res.json();
                                        if (data.token) {
                                            this.tokens.unshift(data.token);
                                            this.visibleSecrets[data.token.id] = true;
                                            this.newTokenLabel = '';
                                            this.showNotification('成功簽發新的 MCP 權杖！請妥善保存金鑰。');
                                        }
                                    } else {
                                        const err = await res.json();
                                        this.showNotification(err.error || '簽發失敗', 'error');
                                    }
                                } catch (e) {
                                    this.showNotification('簽發連線發生錯誤', 'error');
                                } finally {
                                    this.isCreatingToken = false;
                                }
                            },

                            startEditing(token) {
                                this.editingTokenId = token.id;
                                this.editingTokenLabel = token.label;
                            },

                            cancelEditing() {
                                this.editingTokenId = null;
                                this.editingTokenLabel = '';
                            },

                            async saveTokenLabel(token) {
                                const newLabel = this.editingTokenLabel.trim();
                                if (!newLabel || newLabel === token.label) {
                                    this.cancelEditing();
                                    return;
                                }

                                const saraToken = localStorage.getItem('unified_token');
                                if (!saraToken) return;

                                try {
                                    const apiBaseUrl = new URL(config.baseUrl || '', window.location.origin);
                                    const endpoint = new URL('mcp/tokens', apiBaseUrl.href.endsWith('/') ? apiBaseUrl : apiBaseUrl.href + '/');
                                    const res = await fetch(endpoint, {
                                        method: 'PATCH',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': ['SARA', saraToken].join(' '),
                                        },
                                        body: JSON.stringify({ id: token.id, label: newLabel }),
                                    });

                                    if (res.ok) {
                                        const data = await res.json();
                                        token.label = data.token.label;
                                        this.showNotification('權杖名稱已成功更新');
                                        this.cancelEditing();
                                    } else {
                                        const err = await res.json();
                                        this.showNotification(err.error || '重新命名失敗', 'error');
                                    }
                                } catch (e) {
                                    this.showNotification('連線發生錯誤', 'error');
                                }
                            },

                            async rotateToken(token) {
                                if (!confirm('確定要輪替此權杖的金鑰嗎？舊金鑰將立即失效。')) {
                                    return;
                                }

                                const saraToken = localStorage.getItem('unified_token');
                                if (!saraToken) return;

                                try {
                                    const apiBaseUrl = new URL(config.baseUrl || '', window.location.origin);
                                    const endpoint = new URL('mcp/tokens', apiBaseUrl.href.endsWith('/') ? apiBaseUrl : apiBaseUrl.href + '/');
                                    const res = await fetch(endpoint, {
                                        method: 'PUT',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': ['SARA', saraToken].join(' '),
                                        },
                                        body: JSON.stringify({ id: token.id }),
                                    });

                                    if (res.ok) {
                                        const data = await res.json();
                                        token.token = data.token.token;
                                        token.updatedAt = data.token.updatedAt;
                                        this.visibleSecrets[token.id] = true;
                                        this.showNotification('權杖金鑰已成功輪替！');
                                    } else {
                                        const err = await res.json();
                                        this.showNotification(err.error || '輪替失敗', 'error');
                                    }
                                } catch (e) {
                                    this.showNotification('連線發生錯誤', 'error');
                                }
                            },

                            async deleteToken(token) {
                                if (!confirm('確定要刪除權杖「' + token.label + '」嗎？此操作無法復原。')) {
                                    return;
                                }

                                const saraToken = localStorage.getItem('unified_token');
                                if (!saraToken) return;

                                try {
                                    const apiBaseUrl = new URL(config.baseUrl || '', window.location.origin);
                                    const endpoint = new URL('mcp/token', apiBaseUrl.href.endsWith('/') ? apiBaseUrl : apiBaseUrl.href + '/');
                                    const res = await fetch(endpoint, {
                                        method: 'DELETE',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': ['SARA', saraToken].join(' '),
                                        },
                                        body: JSON.stringify({ id: token.id }),
                                    });

                                    if (res.ok) {
                                        this.tokens = this.tokens.filter(t => t.id !== token.id);
                                        this.showNotification('權杖已成功刪除');
                                    } else {
                                        const err = await res.json();
                                        this.showNotification(err.error || '刪除失敗', 'error');
                                    }
                                } catch (e) {
                                    this.showNotification('連線發生錯誤', 'error');
                                }
                            },

                            async init() {
                                const loginUrl = new URL(config.saraInteHost, window.location.origin);
                                loginUrl.searchParams.set('refer', window.location.href);
                                this.saraLoginUrl = loginUrl.toString();

                                const saraToken = localStorage.getItem('unified_token');
                                if (!saraToken) {
                                    this.isLoad = false;
                                    return;
                                }

                                try {
                                    const apiBaseUrl = new URL(config.baseUrl || '', window.location.origin);
                                    const endpoint = new URL('mcp/me', apiBaseUrl.href.endsWith('/') ? apiBaseUrl : apiBaseUrl.href + '/');
                                    const res = await fetch(endpoint, {
                                        headers: {
                                            'Authorization': ['SARA', saraToken].join(' '),
                                        },
                                    });
                                    if (res.ok) {
                                        const data = await res.json();
                                        const user = data.profile;
                                        this.userId = data.id;
                                        this.nickname = user.nickname;
                                        this.email = user.email;
                                        this.avatarUrl = 'https://api.gravatar.com/avatar/' + user.avatar_hash + '?d=identicon&s=200';
                                        this.isLoggedIn = true;

                                        // Load user's MCP tokens
                                        await this.fetchTokens();
                                    }
                                } catch (e) {
                                    console.warn('Sara token verification failed:', e);
                                } finally {
                                    this.isLoad = false;
                                }
                            }
                        };
                    }
                `}</script>
            </head>
            <body
                class="relative bg-white text-gray-900 min-h-screen flex flex-col antialiased"
                x-data={`app(${configJson})`}
            >
                {/* Header matching Sara AppHeader.vue */}
                <header class="app-header bg-white">
                    <div class="max-w-7xl mx-auto px-4 sm:px-6">
                        <div class="flex justify-between items-center border-b-2 border-gray-100 py-6 md:justify-start md:space-x-10">
                            <div class="flex justify-start lg:w-0 lg:flex-1">
                                <a href="/">
                                    <h1 class="flex-auto text-lg font-semibold text-gray-900">
                                        Nymph
                                    </h1>
                                    <p class="flex-auto text-sm font-normal text-gray-500">
                                        MCP 權杖簽發
                                    </p>
                                </a>
                            </div>
                            <nav class="flex items-center space-x-6" x-cloak>
                                <template x-if="isLoggedIn">
                                    <a
                                        x-bind:href="saraHost"
                                        class="inline-flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
                                    >
                                        <img
                                            x-bind:src="avatarUrl"
                                            x-bind:alt="nickname"
                                            class="rounded-full w-7 h-7 mr-2"
                                        />
                                        <span x-text="nickname"></span>
                                    </a>
                                </template>
                                <template x-if="!isLoggedIn && !isLoad">
                                    <a
                                        x-bind:href="saraLoginUrl"
                                        class="text-sm font-medium text-gray-500 hover:text-gray-900"
                                    >
                                        登入
                                    </a>
                                </template>
                            </nav>
                        </div>
                    </div>
                </header>

                {/* Main Content matching Sara Card layout */}
                <main class="flex-grow my-8 py-8 px-4 sm:px-6" x-cloak>
                    {/* Toast Notification */}
                    <div
                        x-show="notification"
                        x-transition
                        class="fixed bottom-6 right-6 max-w-md p-4 rounded shadow-lg text-sm font-medium z-50"
                        x-bind:class="notificationType === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'"
                        style="display: none;"
                    >
                        <span x-text="notification"></span>
                    </div>

                    <div class="flex flex-col max-w-3xl mx-auto space-y-8">
                        {/* Loading State */}
                        <div x-show="isLoad" class="overflow-hidden shadow-md rounded p-6 bg-white border-b border-gray-200 text-center text-gray-500 text-sm">
                            載入中...
                        </div>

                        {/* Authenticated View */}
                        <div x-show="!isLoad && isLoggedIn" class="space-y-8">
                            {/* Profile Card */}
                            <div class="flex flex-col overflow-hidden shadow-md rounded">
                                <div class="px-6 py-4 bg-white border-b border-gray-200 font-bold text-gray-900">
                                    Nymph 眼中的你...
                                </div>
                                <div class="px-6 py-4 bg-white border-b border-gray-200 md:flex items-center">
                                    <div class="px-3 mb-3 md:mb-0 flex-shrink-0">
                                        <img
                                            x-bind:src="avatarUrl"
                                            x-bind:alt="nickname"
                                            x-bind:title="nickname"
                                            class="rounded-full w-20 h-20 mx-auto md:w-16 md:h-16 shadow-sm border border-gray-100"
                                        />
                                    </div>
                                    <div class="ml-3 text-sm leading-relaxed">
                                        <span class="text-gray-600">暱稱：</span>
                                        <span x-text="nickname"></span>
                                        <br />
                                        <span class="text-gray-600">電子郵件地址：</span>
                                        <span x-text="email"></span>
                                        <br />
                                        <span class="text-gray-600">Sara 系統使用者識別碼：</span>
                                        <span x-text="userId"></span>
                                    </div>
                                </div>
                            </div>

                            {/* MCP Tokens Card */}
                            <div class="flex flex-col overflow-hidden shadow-md rounded bg-white">
                                <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                                    <div>
                                        <h2 class="font-bold text-gray-900">MCP 連線權杖管理</h2>
                                        <p class="text-xs text-gray-500 mt-0.5">簽發並管理用於 Antigravity、Claude Code/Desktop、Codex、Cursor 等工具的專屬連線權杖</p>
                                    </div>
                                </div>

                                {/* Issue Token Form */}
                                <div class="p-6 border-b border-gray-200 bg-gray-50/50">
                                    <form x-on:submit="createToken($event); $event.preventDefault();" class="flex flex-col sm:flex-row gap-3">
                                        <input
                                            type="text"
                                            x-model="newTokenLabel"
                                            placeholder="請輸入權杖名稱（例如：Antigravity、Claude Code/Desktop、Codex、Cursor）"
                                            class="flex-1 border border-gray-300 rounded px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                                            required
                                        />
                                        <button
                                            type="submit"
                                            x-bind:disabled="isCreatingToken || !newTokenLabel.trim()"
                                            class="bg-sky-500 shadow text-sm text-white font-bold py-2 px-6 hover:bg-sky-600 rounded disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                        >
                                            <span x-show="!isCreatingToken">簽發新權杖</span>
                                            <span x-show="isCreatingToken">簽發中...</span>
                                        </button>
                                    </form>
                                </div>

                                {/* Token List */}
                                <div class="divide-y divide-gray-200">
                                    <template x-if="tokens.length === 0">
                                        <div class="p-8 text-center text-gray-500 text-sm">
                                            尚未簽發任何 MCP 連線權杖。在上方輸入名稱即可立即簽發。
                                        </div>
                                    </template>

                                    <template x-for="t in tokens" x-bind:key="t.id">
                                        <div class="p-6 hover:bg-gray-50/50 transition-colors">
                                            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                                {/* Label Display / Edit Mode */}
                                                <div class="flex items-center space-x-2">
                                                    <template x-if="editingTokenId !== t.id">
                                                        <div class="flex items-center space-x-2">
                                                            <span class="font-bold text-gray-900 text-sm md:text-base" x-text="t.label"></span>
                                                            <button
                                                                type="button"
                                                                x-on:click="startEditing(t)"
                                                                title="重新命名"
                                                                class="text-xs text-sky-600 hover:text-sky-800 font-medium hover:underline"
                                                            >
                                                                重新命名
                                                            </button>
                                                        </div>
                                                    </template>
                                                    <template x-if="editingTokenId === t.id">
                                                        <div class="flex items-center space-x-2">
                                                            <input
                                                                type="text"
                                                                x-model="editingTokenLabel"
                                                                class="border border-gray-300 rounded px-2.5 py-1 text-sm focus:ring-1 focus:ring-sky-500"
                                                                x-on:keydown="if ($event.key === 'Enter') { saveTokenLabel(t); $event.preventDefault(); } if ($event.key === 'Escape') cancelEditing();"
                                                            />
                                                            <button
                                                                type="button"
                                                                x-on:click="saveTokenLabel(t)"
                                                                class="bg-sky-500 hover:bg-sky-600 text-white text-xs md:text-sm px-3.5 py-1.5 rounded font-medium shadow-sm transition"
                                                            >
                                                                儲存
                                                            </button>
                                                            <button
                                                                type="button"
                                                                x-on:click="cancelEditing"
                                                                class="bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 text-xs md:text-sm px-3.5 py-1.5 rounded font-medium shadow-sm transition"
                                                            >
                                                                取消
                                                            </button>
                                                        </div>
                                                    </template>
                                                </div>

                                                {/* Token ID */}
                                                <div class="text-xs text-gray-400 font-mono">
                                                    ID: <span x-text="t.id"></span>
                                                </div>
                                            </div>

                                            {/* Token Secret & Actions */}
                                            <div class="flex items-center bg-gray-100 rounded px-3 py-2 text-xs font-mono text-gray-800 mb-3 overflow-x-auto">
                                                <span class="flex-1 truncate mr-2" x-text="visibleSecrets[t.id] ? t.token : t.token.slice(0, 14) + '••••••••••••••••••••••••••••'"></span>
                                                <button
                                                    type="button"
                                                    x-on:click="toggleSecretVisibility(t.id)"
                                                    class="text-gray-500 hover:text-gray-800 mr-2 text-xs"
                                                    x-text="visibleSecrets[t.id] ? '隱藏' : '顯示'"
                                                ></button>
                                                <button
                                                    type="button"
                                                    x-on:click="copyToClipboard(t.token, t.id)"
                                                    class="bg-white border border-gray-300 hover:bg-gray-50 px-2.5 py-1 rounded text-xs font-sans text-gray-700 shadow-sm"
                                                    x-text="copiedTokenId === t.id ? '已複製！' : '複製'"
                                                ></button>
                                            </div>

                                            {/* Action Buttons */}
                                            <div class="flex justify-between items-center text-xs text-gray-500">
                                                <div>
                                                    <template x-if="t.createdAt">
                                                        <span>建立於 <span x-text="new Date(t.createdAt).toLocaleDateString()"></span></span>
                                                    </template>
                                                </div>
                                                <div class="flex items-center space-x-2">
                                                    <button
                                                        type="button"
                                                        x-on:click="rotateToken(t)"
                                                        class="inline-flex items-center bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 text-xs md:text-sm font-medium px-3.5 py-1.5 rounded shadow-sm transition"
                                                    >
                                                        輪替金鑰
                                                    </button>
                                                    <button
                                                        type="button"
                                                        x-on:click="deleteToken(t)"
                                                        class="inline-flex items-center bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 text-xs md:text-sm font-medium px-3.5 py-1.5 rounded shadow-sm transition"
                                                    >
                                                        刪除
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </template>
                                </div>
                            </div>
                        </div>

                        {/* Unauthenticated View */}
                        <div x-show="!isLoad && !isLoggedIn" class="overflow-hidden shadow-md rounded">
                            <div class="px-6 py-4 bg-white border-b border-gray-200 font-bold">
                                Sara 身分認證
                            </div>
                            <div class="p-6 bg-white border-b border-gray-200 text-sm text-gray-700 leading-relaxed">
                                您好，此頁面需要透過 Sara 進行身分認證以檢視個人資料並簽發專屬的 MCP 連線權杖。
                            </div>
                            <div class="p-6 bg-white border-b border-gray-200 text-right">
                                <a
                                    x-bind:href="saraLoginUrl"
                                    class="inline-block bg-sky-500 shadow-md text-sm text-white font-bold py-3 md:px-8 px-4 hover:bg-sky-600 rounded"
                                >
                                    使用 Sara 登入
                                </a>
                            </div>
                        </div>
                    </div>
                </main>

                {/* Footer matching Sara AppFooter.vue 1:1 */}
                <footer class="mt-16 pb-16 text-sm leading-6">
                    <div class="max-w-7xl mx-auto mt-5 divide-y divide-gray-200 px-4 sm:px-6 md:px-8 text-sky-700">
                        <a
                            class="mr-3"
                            href="https://github.com/web-tech-tw/nymph"
                            target="_blank"
                            rel="noreferrer"
                        >
                            網站原始碼
                        </a>
                        <a
                            class="mr-3"
                            href="https://web-tech.tw/#/privacy"
                            target="_blank"
                            rel="noreferrer"
                        >
                            隱私權政策
                        </a>
                    </div>
                    <div class="max-w-7xl mx-auto mt-5 divide-y divide-gray-200 px-4 sm:px-6 md:px-8 text-gray-500">
                        &copy; {new Date().getFullYear()}
                        <a
                            class="ml-1 hover:text-slate-900"
                            href="https://web-tech.tw"
                            target="_blank"
                            rel="noreferrer"
                        >
                            臺灣網際網路技術推廣組織
                            Taiwan Web Technology Promotion Organization (Web Tech TW)
                        </a>
                    </div>
                </footer>
            </body>
        </html>
    );
}
