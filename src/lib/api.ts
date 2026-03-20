import { invoke } from '@tauri-apps/api/core';

export const WEB_TOKEN_STORAGE_KEY = 'aichv_token';

// ==================== 类型定义 ====================

/** 会话元信息（来自 Rust SessionMeta） */
export interface SessionMeta {
    providerId: string;       // 'claude' | 'codex' | 'gemini' | 'openclaw' | 'opencode'
    sessionId: string;
    title?: string;           // 提取自第一条用户消息
    summary?: string;         // 截断后的摘要
    projectDir?: string | null; // Gemini 为 null（目录哈希不可逆）
    createdAt?: number;       // 毫秒时间戳
    lastActiveAt?: number;    // 毫秒时间戳
    sourcePath?: string;      // 源文件路径，用于加载消息详情
    resumeCommand?: string;   // 恢复会话的 CLI 命令
}

/** 会话消息 */
export interface SessionMessage {
    role: string;    // 'user' | 'assistant' | 'tool' | 'system'
    content: string;
    ts?: number;     // 毫秒时间戳（可选）
}

export interface DeleteSessionOptions {
    providerId: string;
    sessionId: string;
    sourcePath: string;
}

interface ApiResponse<T> {
    ok: boolean;
    data: T;
    error?: string;
}

interface BackendAdapter {
    listSessions: () => Promise<SessionMeta[]>;
    getSessionMessages: (providerId: string, sourcePath: string) => Promise<SessionMessage[]>;
    deleteSession: (options: DeleteSessionOptions) => Promise<boolean>;
    launchTerminal: (
        command: string,
        cwd?: string | null,
        terminalKind?: 'cmd' | 'powershell' | null,
    ) => Promise<boolean>;
    openInFileExplorer: (path: string) => Promise<boolean>;
}

function isTauriRuntime(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as Record<string, unknown>;
    return Boolean(win.__TAURI_INTERNALS__ || win.__TAURI__ || win.__TAURI_IPC__);
}

export function isWebMode(): boolean {
    return !isTauriRuntime();
}

function getWebToken(): string {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(WEB_TOKEN_STORAGE_KEY)?.trim() ?? '';
}

function assertWebToken(): string {
    const token = getWebToken();
    if (!token) {
        throw new Error('Missing web token. Set ?token=... once, then refresh.');
    }
    return token;
}

async function fetchApi<T>(path: string, init: RequestInit): Promise<T> {
    const token = assertWebToken();
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(path, {
        ...init,
        headers,
    });

    let payload: ApiResponse<T> | null = null;
    try {
        payload = await response.json() as ApiResponse<T>;
    } catch {
        // keep payload as null and throw fallback message below
    }

    if (!response.ok || !payload?.ok) {
        const errorMessage = payload?.error ?? `Request failed: ${response.status}`;
        throw new Error(errorMessage);
    }

    return payload.data;
}

const tauriAdapter: BackendAdapter = {
    listSessions: () => invoke('list_sessions'),
    getSessionMessages: (providerId, sourcePath) =>
        invoke('get_session_messages', { providerId, sourcePath }),
    deleteSession: ({ providerId, sessionId, sourcePath }) =>
        invoke('delete_session', { providerId, sessionId, sourcePath }),
    launchTerminal: (command, cwd, terminalKind) =>
        invoke('launch_session_terminal', { command, cwd, terminalKind }),
    openInFileExplorer: (path) =>
        invoke('open_in_file_explorer', { path }),
};

const webAdapter: BackendAdapter = {
    listSessions: () => fetchApi('/api/sessions', { method: 'GET' }),
    getSessionMessages: (providerId, sourcePath) =>
        fetchApi('/api/session/messages', {
            method: 'POST',
            body: JSON.stringify({ providerId, sourcePath }),
        }),
    deleteSession: ({ providerId, sessionId, sourcePath }) =>
        fetchApi('/api/session/delete', {
            method: 'POST',
            body: JSON.stringify({ providerId, sessionId, sourcePath }),
        }),
    launchTerminal: async () => {
        throw new Error('Not supported in web mode');
    },
    openInFileExplorer: async () => {
        throw new Error('Not supported in web mode');
    },
};

function getAdapter(): BackendAdapter {
    return isTauriRuntime() ? tauriAdapter : webAdapter;
}

// ==================== API 函数 ====================

/** 扫描并获取所有会话列表（已按 lastActiveAt 降序排列） */
export async function listSessions(): Promise<SessionMeta[]> {
    return getAdapter().listSessions();
}

/** 获取指定会话的消息列表 */
export async function getSessionMessages(
    providerId: string,
    sourcePath: string,
): Promise<SessionMessage[]> {
    return getAdapter().getSessionMessages(providerId, sourcePath);
}

/** 删除指定会话及 provider 关联资源 */
export async function deleteSession(
    options: DeleteSessionOptions,
): Promise<boolean> {
    return getAdapter().deleteSession(options);
}

/**
 * 在终端执行恢复命令（仅 Tauri 支持）
 * Web 模式会返回 not supported
 */
export async function launchTerminal(
    command: string,
    cwd?: string | null,
    terminalKind?: 'cmd' | 'powershell' | null,
): Promise<boolean> {
    return getAdapter().launchTerminal(command, cwd, terminalKind);
}

/** 在文件管理器中打开目录或定位文件（仅 Tauri 支持） */
export async function openInFileExplorer(path: string): Promise<boolean> {
    return getAdapter().openInFileExplorer(path);
}
